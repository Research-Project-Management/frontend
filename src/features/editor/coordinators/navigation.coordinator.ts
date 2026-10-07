/**
 * navigation.coordinator.ts
 *
 * Unified Document Navigation & Focus Coordinator (Coordinators Layer).
 * Location: `features/editor/coordinators/navigation.coordinator.ts`
 *
 * Single Source of Truth for:
 * - Switching active documents and tab management (0ms instant hydration).
 * - Bi-directional SyncTeX navigation to source code lines.
 * - Diagnostic jump (Next Error / Previous Error).
 * - CodeMirror focus and selection restoration.
 */

import { useTabsStore } from '../store/tabs.store';
import { usePageStore } from '../store/editor.store';
import { lruDocumentCache } from '../domain/lru-document-cache';
import { diagnosticsCoordinator } from './diagnostics.coordinator';
import { editorCommandBus } from './command-bus';
import { sessionCoordinator } from './session.coordinator';
import { getActiveEditorInstance } from '../core/context/editor-instance.context';

export interface OpenDocumentOptions {
  fileId: string;
  title: string;
  path?: string;
  line?: number;
  column?: number;
  highlight?: 'error' | 'synctex';
  preview?: boolean;
}

export class NavigationCoordinatorRegistry {
  private initialized = false;

  constructor() {
    this.initCommandSubscriptions();
  }

  private initCommandSubscriptions(): void {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    editorCommandBus.subscribe('navigation:open-tab', (cmd) => {
      this.openDocument({
        fileId: cmd.fileId,
        title: cmd.title,
        path: cmd.path,
      });
    });

    editorCommandBus.subscribe('navigation:close-tab', (cmd) => {
      this.closeDocument(cmd.fileId);
    });

    editorCommandBus.subscribe('navigation:jump-to-line', (cmd) => {
      this.jumpToLine({
        fileId: cmd.fileId,
        filePath: cmd.filePath,
        line: cmd.line,
        column: cmd.column,
        highlight: cmd.highlight,
      });
    });

    editorCommandBus.subscribe('navigation:next-error', () => {
      this.jumpToNextDiagnostic('error');
    });

    editorCommandBus.subscribe('navigation:prev-error', () => {
      this.jumpToPrevDiagnostic('error');
    });
  }

  /**
   * Opens or focuses a document tab in 0ms with LRU Cache hydration
   */
  public openDocument(options: OpenDocumentOptions): void {
    const { fileId, title, path: optPath, line, column, highlight } = options;
    const tabsStore = useTabsStore.getState();
    const pageStore = usePageStore.getState();

    const currentActiveId = pageStore.activeFilePage?.id || pageStore.currentPage?.id;

    // 1. If switching to a different file, preserve current buffer in LRU cache
    if (currentActiveId && currentActiveId !== fileId) {
      sessionCoordinator.switchTab(currentActiveId, fileId);
    }

    // 2. Open or activate tab in tabs store
    tabsStore.openTab({
      id: fileId,
      title,
      path: optPath || title,
    });

    // 3. Set active in pageStore
    const existingModel = lruDocumentCache.getModel(fileId);
    pageStore.setActiveFilePage({
      id: fileId,
      title,
      content: existingModel?.content || '',
      parentId: null,
    } as any);

    // 3b. Synchronize shallow URL history (0ms latency, zero page refresh)
    if (typeof window !== 'undefined') {
      try {
        const rootPageId = pageStore.currentPage?.id || pageStore.projectId;
        const isRoot = fileId === rootPageId || fileId === `${rootPageId}-main`;
        const url = new URL(window.location.href);
        if (isRoot) {
          url.searchParams.delete('file');
        } else {
          url.searchParams.set('file', fileId);
        }
        window.history.replaceState(window.history.state, '', url.pathname + url.search);
      } catch {}
    }

    // 4. If target coordinates are specified, jump to line
    if (line !== undefined) {
      setTimeout(() => {
        this.jumpToLine({ fileId, line, column, highlight });
      }, 50);
    } else {
      // Focus editor
      setTimeout(() => {
        editorCommandBus.dispatch({ type: 'editor:focus' });
      }, 50);
    }
  }

  /**
   * Closes a document tab and gracefully activates the adjacent tab
   */
  public closeDocument(fileId: string): void {
    const tabsStore = useTabsStore.getState();
    const pageStore = usePageStore.getState();

    // 1. Save and evict from session coordinator
    sessionCoordinator.closeTab(fileId);

    // 2. Close in tabsStore
    tabsStore.closeTab(fileId);

    // 3. If closing the currently active tab, activate next tab
    const nextActiveTab = tabsStore.tabs.find((t) => t.id === tabsStore.activeTabId);
    if (nextActiveTab) {
      this.openDocument({
        fileId: nextActiveTab.id,
        title: nextActiveTab.title,
        path: nextActiveTab.path,
      });
    } else {
      // Revert to root document
      const rootPage = pageStore.currentPage;
      if (rootPage) {
        pageStore.setActiveFilePage(rootPage);
        if (typeof window !== 'undefined') {
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('file');
            window.history.replaceState(window.history.state, '', url.pathname + url.search);
          } catch {}
        }
      }
    }
  }

  /**
   * Scrolls CodeMirror smoothly to line/column with pulse highlight
   */
  public jumpToLine(options: {
    fileId?: string;
    filePath?: string;
    line: number;
    column?: number;
    highlight?: 'error' | 'synctex';
  }): void {
    const { fileId, filePath, line, highlight = 'synctex' } = options;
    const pageStore = usePageStore.getState();
    const activePage = pageStore.activeFilePage || pageStore.currentPage;

    // Resolve target fileId & title if filePath was provided
    let resolvedFileId = fileId;
    let resolvedTitle = filePath || fileId || 'main.tex';

    if (!resolvedFileId && filePath) {
      const model = lruDocumentCache.findByPath(filePath);
      if (model) {
        resolvedFileId = model.fileId;
        resolvedTitle = model.filePath;
      } else {
        const tabs = useTabsStore.getState().tabs;
        const matchingTab = tabs.find(
          (t) => t.path === filePath || t.title === filePath || t.id === filePath
        );
        if (matchingTab) {
          resolvedFileId = matchingTab.id;
          resolvedTitle = matchingTab.title;
        }
      }
    }

    // If target file differs from currently active file, open it first
    if (resolvedFileId && activePage && resolvedFileId !== activePage.id) {
      this.openDocument({
        fileId: resolvedFileId,
        title: resolvedTitle,
        path: filePath || resolvedTitle,
        line,
        highlight,
      });
      return;
    }

    // Dispatch jump command directly to active CodeMirror instance
    editorCommandBus.dispatch({
      type: 'editor:jump-to-line',
      line,
      highlight,
    });
  }

  /**
   * Jumps to the next diagnostic error in the active file
   */
  public jumpToNextDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    const activePage = usePageStore.getState().activeFilePage;
    if (!activePage) return;

    const fileDiagnostics = diagnosticsCoordinator.getDiagnosticsForFile(activePage.title || activePage.id);
    const filtered = fileDiagnostics.filter((d) => d.severity === severity);
    if (filtered.length === 0) return;

    const engine = getActiveEditorInstance();
    const currentCursor = engine?.getCursorPosition();
    const currentLine = currentCursor?.line ?? 1;

    // Find first diagnostic below current line
    const next = filtered.find((d) => d.line > currentLine) || filtered[0];
    if (next) {
      this.jumpToLine({
        fileId: activePage.id,
        line: next.line,
        highlight: 'error',
      });
    }
  }

  /**
   * Jumps to the previous diagnostic error in the active file
   */
  public jumpToPrevDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    const activePage = usePageStore.getState().activeFilePage;
    if (!activePage) return;

    const fileDiagnostics = diagnosticsCoordinator.getDiagnosticsForFile(activePage.title || activePage.id);
    const filtered = fileDiagnostics.filter((d) => d.severity === severity);
    if (filtered.length === 0) return;

    const engine = getActiveEditorInstance();
    const currentCursor = engine?.getCursorPosition();
    const currentLine = currentCursor?.line ?? 1;

    // Find last diagnostic above current line
    const prev = [...filtered].reverse().find((d) => d.line < currentLine) || filtered[filtered.length - 1];
    if (prev) {
      this.jumpToLine({
        fileId: activePage.id,
        line: prev.line,
        highlight: 'error',
      });
    }
  }
}

export const navigationCoordinator = new NavigationCoordinatorRegistry();
