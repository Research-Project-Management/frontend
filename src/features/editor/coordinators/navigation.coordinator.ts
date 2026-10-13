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

import { useTabsStore, type EditorTab } from '../store/tabs.store';
import { usePageStore } from '../store/editor.store';
import { useCompileStore } from '../store/compiler.store';
import { useLayoutStore } from '../store/layout.store';
import { lruDocumentCache } from '../domain/document/lru-document-cache';
import { diagnosticsCoordinator } from './diagnostics.coordinator';
import { editorCommandBus } from './command-bus';
import { sessionCoordinator } from './session.coordinator';
import { getActiveEditorInstance } from './command-bus';
import { toast } from 'sonner';

export interface NavigationNotificationPort {
  info(message: string, options?: { id?: string }): void;
}

export const defaultNavigationNotifier: NavigationNotificationPort = {
  info(message, options) {
    if (typeof window !== 'undefined') {
      try {
        toast.info(message, options);
      } catch {}
    }
  },
};

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
  private lastDiagnosticIndex: number = -1;
  private lastDiagnosticLine: number | null = null;
  private lastDiagnosticFile: string | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private notifier: NavigationNotificationPort;

  constructor(options: { notifier?: NavigationNotificationPort } = {}) {
    this.notifier = options.notifier || defaultNavigationNotifier;
    this.initCommandSubscriptions();
  }

  public resetDiagnosticState(): void {
    this.lastDiagnosticIndex = -1;
    this.lastDiagnosticLine = null;
    this.lastDiagnosticFile = null;
  }

  public getBroadcastChannel(): BroadcastChannel | null {
    return this.broadcastChannel;
  }

  public setBroadcastChannel(channel: BroadcastChannel | null): void {
    this.broadcastChannel = channel;
    if (this.broadcastChannel) {
      this.attachBroadcastChannelListeners();
    }
  }

  public attachBroadcastChannelListeners(): void {
    if (!this.broadcastChannel) return;
    this.broadcastChannel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'synctex:jump-to-code' && payload?.line) {
        if (payload.fileId || payload.filePath) {
          this.openDocument({
            fileId: payload.fileId || payload.filePath,
            title: payload.filePath || payload.fileId || 'main.tex',
            path: payload.filePath,
            line: payload.line,
            column: payload.column,
            highlight: payload.highlight || 'synctex',
          });
        } else {
          this.jumpToLine({
            line: payload.line,
            column: payload.column,
            highlight: payload.highlight || 'synctex',
          });
        }
        try {
          window.focus?.();
        } catch {}
      } else if (type === 'preview:ready') {
        const compileState = useCompileStore.getState();
        if (compileState.pdfUrl) {
          this.broadcastChannel?.postMessage({
            type: 'compiler:sync-state',
            payload: {
              pdfUrl: compileState.pdfUrl,
              compileStatus: compileState.compileStatus,
              lastCompiledAt: compileState.lastCompiledAt?.toISOString() || null,
              logs: compileState.compileLog,
            },
          });
        }
      } else if (type === 'editor:scroll-to-line' && payload?.line) {
        editorCommandBus.dispatch({
          type: 'editor:scroll-to-line',
          line: payload.line,
          smooth: payload.smooth ?? true,
        });
      } else if (type === 'preview:window-closed') {
        useLayoutStore.getState().setPdfDetached(false);
      }
    };
  }

  public isDetachedPreviewWindow(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.includes('/preview') ||
      (useLayoutStore.getState().isPdfDetached && !getActiveEditorInstance())
    );
  }

  public initCommandSubscriptions(force = false): void {
    if (typeof window === 'undefined') return;
    if (this.initialized && !force) return;
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

    // Multi-Pane Split Editor Subscriptions
    editorCommandBus.subscribe('editor:split', (cmd) => {
      const layoutStore = useLayoutStore.getState();
      layoutStore.setEditorSplitMode(cmd.direction);
      if (cmd.fileId) {
        layoutStore.setSecondaryFileId(cmd.fileId);
      }
    });

    editorCommandBus.subscribe('editor:open-to-side', (cmd) => {
      const layoutStore = useLayoutStore.getState();
      layoutStore.setEditorSplitMode('vertical');
      layoutStore.setSecondaryFileId(cmd.fileId);
      layoutStore.setActiveEditorPane('secondary');
    });

    editorCommandBus.subscribe('editor:close-split', () => {
      const layoutStore = useLayoutStore.getState();
      layoutStore.setEditorSplitMode('none');
      layoutStore.setSecondaryFileId(null);
      layoutStore.setActiveEditorPane('primary');
    });

    editorCommandBus.subscribe('editor:focus-pane', (cmd) => {
      useLayoutStore.getState().setActiveEditorPane(cmd.paneId);
    });

    editorCommandBus.subscribe('editor:swap-panes', () => {
      const layoutStore = useLayoutStore.getState();
      const pageStore = usePageStore.getState();
      const primaryId = pageStore.getActiveDocumentId();
      const secondaryId = layoutStore.secondaryFileId;
      if (primaryId && secondaryId) {
        this.openDocument({ fileId: secondaryId, title: '' });
        layoutStore.setSecondaryFileId(primaryId);
      }
    });

    // Cross-window BroadcastChannel for Detached PDF & SyncTeX
    if (!this.broadcastChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('flux-synctex-bus');
        this.attachBroadcastChannelListeners();
      } catch (err) {
        console.warn('[NavigationCoordinator] BroadcastChannel initialization failed:', err);
      }
    }

    // Main window -> Detached preview window event bridges
    editorCommandBus.subscribe('synctex:forward', (cmd) => {
      const activeDoc = usePageStore.getState().getActiveDocument();
      const activePath = activeDoc?.path || activeDoc?.title;
      this.broadcastChannel?.postMessage({
        type: 'synctex:forward',
        payload: {
          line: cmd.line,
          column: cmd.column,
          filePath: cmd.filePath || activePath,
          fileId: cmd.fileId || activeDoc?.id,
        },
      });
    });

    editorCommandBus.subscribe('viewer:jump-to-line', (cmd) => {
      this.broadcastChannel?.postMessage({
        type: 'viewer:jump-to-line',
        payload: { line: cmd.line },
      });
    });

    editorCommandBus.subscribe('viewer:goto-page', (cmd) => {
      this.broadcastChannel?.postMessage({
        type: 'viewer:goto-page',
        payload: { page: cmd.page },
      });
    });

    editorCommandBus.subscribe('sync:editor-scrolled', (cmd) => {
      this.broadcastChannel?.postMessage({
        type: 'sync:editor-scrolled',
        payload: { line: cmd.line, totalLines: cmd.totalLines, fraction: cmd.fraction },
      });
    });

    editorCommandBus.subscribe('compiler:finished', (cmd) => {
      if (cmd.success) {
        const compileState = useCompileStore.getState();
        this.broadcastChannel?.postMessage({
          type: 'compiler:sync-state',
          payload: {
            pdfUrl: compileState.pdfUrl,
            compileStatus: compileState.compileStatus,
            lastCompiledAt: compileState.lastCompiledAt?.toISOString() || null,
            logs: compileState.compileLog,
          },
        });
      }
    });

    editorCommandBus.subscribe('preview:detach', () => {
      useLayoutStore.getState().setPdfDetached(true);
      const projectId = usePageStore.getState().projectId;
      if (projectId && typeof window !== 'undefined') {
        const previewUrl = `/projects/${projectId}/preview`;
        window.open(previewUrl, `flux_pdf_preview_${projectId}`, 'width=900,height=1000,menubar=no,toolbar=no');
        this.notifier.info('PDF preview opened in a separate window', { id: 'pdf-preview-detach' });
      }
    });

    editorCommandBus.subscribe('preview:attach', () => {
      useLayoutStore.getState().setPdfDetached(false);
      this.broadcastChannel?.postMessage({ type: 'preview:attached' });
      this.notifier.info('PDF preview reattached to main window', { id: 'pdf-preview-detach' });
    });
  }

  /**
   * Opens or focuses a document tab in 0ms with LRU Cache hydration
   */
  public openDocument(options: OpenDocumentOptions): void {
    const { fileId, title, path: optPath, line, column, highlight } = options;

    if (this.isDetachedPreviewWindow()) {
      this.broadcastChannel?.postMessage({
        type: 'synctex:jump-to-code',
        payload: {
          fileId,
          filePath: optPath || title,
          line,
          column,
          highlight: highlight || 'synctex',
        },
      });
      return;
    }

    const tabsStore = useTabsStore.getState();
    const pageStore = usePageStore.getState();

    const currentActiveId = pageStore.getActiveDocumentId();

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
    const rootPageId = pageStore.currentPage?.id || pageStore.projectId || fileId;
    pageStore.setActiveFilePage({
      id: fileId,
      title,
      path: optPath || title,
      content: existingModel?.content || '',
      pageId: rootPageId,
      projectId: pageStore.projectId,
    });

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
    const projectId = pageStore.projectId || pageStore.currentPage?.id || 'default';

    // 1. Save and evict from session coordinator
    sessionCoordinator.closeTab(fileId);

    // 2. Close in tabsStore and gracefully route to adjacent tab
    tabsStore.closeTab(projectId, fileId, (nextId) => {
      const rootPageId = pageStore.currentPage?.id || projectId;
      const isNextRoot = !nextId || nextId === rootPageId || nextId === `${rootPageId}-main`;

      if (!isNextRoot && nextId) {
        tabsStore.setActive(projectId, nextId);
        const tabs = tabsStore.tabsByProject[projectId] || [];
        const nextActiveTab = tabs.find((t) => t.id === nextId);
        if (nextActiveTab) {
          this.openDocument({
            fileId: nextActiveTab.id,
            title: nextActiveTab.title,
            path: nextActiveTab.path,
          });
        }
      } else {
        // Revert to root document
        tabsStore.setActive(projectId, rootPageId);
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
    });
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
    const { fileId, filePath, line, column, highlight = 'synctex' } = options;

    if (this.isDetachedPreviewWindow()) {
      this.broadcastChannel?.postMessage({
        type: 'synctex:jump-to-code',
        payload: {
          fileId,
          filePath,
          line,
          column,
          highlight,
        },
      });
      return;
    }

    const pageStore = usePageStore.getState();
    const activePage = pageStore.getActiveDocument();

    // Resolve target fileId & title if filePath was provided
    let resolvedFileId = fileId;
    let resolvedTitle = filePath || fileId || 'main.tex';

    if (!resolvedFileId && filePath) {
      const model = lruDocumentCache.findByPath(filePath);
      if (model) {
        resolvedFileId = model.fileId;
        resolvedTitle = model.filePath;
      } else {
        const tabsByProject = useTabsStore.getState().tabsByProject;
        const allTabs = Object.values(tabsByProject).flat();
        const matchingTab = allTabs.find(
          (t: EditorTab) => t.path === filePath || t.title === filePath || t.id === filePath
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

    // 1. Direct engine jump for instant 0ms response
    const engine = getActiveEditorInstance();
    if (engine && typeof engine.jumpToLine === 'function') {
      engine.jumpToLine(line, highlight);
    }

    // 2. Dispatch jump command across global command bus
    editorCommandBus.dispatch({
      type: 'editor:jump-to-line',
      line,
      highlight,
    });
  }

  /**
   * Aggregates diagnostics of given severity across the entire project (Overleaf Parity).
   * Falls back to compileStore errors if coordinator index has not been populated.
   */
  private getProjectDiagnostics(severity: 'error' | 'warning' = 'error'): Array<{
    file: string;
    line: number;
    message: string;
  }> {
    const all = diagnosticsCoordinator.getAllDiagnostics().filter((d) => d.severity === severity);
    if (all.length > 0) {
      return all.map((d) => ({
        file: d.file || d.normalizedPath || 'main.tex',
        line: d.line,
        message: d.message,
      }));
    }

    const compileErrors = useCompileStore.getState().compileErrors || [];
    return compileErrors
      .filter((e) => (e.severity || 'error') === severity && e.line !== null && e.line !== undefined)
      .map((e) => ({
        file: e.file || 'main.tex',
        line: e.line!,
        message: e.message,
      }));
  }

  /**
   * Jumps to the next diagnostic error across the project (Overleaf Parity: F8).
   * Citation: overleaf.com/learn/how-to/Debugging_LaTeX_errors_with_Overleaf#Navigating_errors
   */
  public jumpToNextDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    const list = this.getProjectDiagnostics(severity);
    if (list.length === 0) {
      if (severity === 'error') {
        const warnings = this.getProjectDiagnostics('warning');
        if (warnings.length > 0) {
          this.jumpToNextDiagnostic('warning');
          return;
        }
      }
      this.notifier.info('No compilation errors in project', { id: 'compiler-diagnostic-step' });
      return;
    }

    const activePage = usePageStore.getState().getActiveDocument();
    const currentFile = activePage?.title || activePage?.path || activePage?.id || '';
    const engine = getActiveEditorInstance();
    const currentCursor = engine?.getCursorPosition();
    const isCurrentFileSameAsLast =
      this.lastDiagnosticFile === currentFile ||
      currentFile.endsWith(`/${this.lastDiagnosticFile}`) ||
      (this.lastDiagnosticFile ? this.lastDiagnosticFile.endsWith(`/${currentFile}`) : false);
    const currentLine =
      currentCursor?.line ??
      (isCurrentFileSameAsLast && this.lastDiagnosticLine !== null ? this.lastDiagnosticLine : 0);

    // 1. First, search forward in current file below current line
    let targetIndex = list.findIndex(
      (d) => (d.file === currentFile || currentFile.endsWith(`/${d.file}`) || d.file.endsWith(`/${currentFile}`)) && d.line > currentLine
    );

    // 2. If not found in current file after cursor, find the next item in project array
    if (targetIndex === -1) {
      const lastSameFileIndex = list.map(
        (d) => d.file === currentFile || currentFile.endsWith(`/${d.file}`) || d.file.endsWith(`/${currentFile}`)
      ).lastIndexOf(true);

      if (lastSameFileIndex !== -1) {
        targetIndex = (lastSameFileIndex + 1) % list.length;
      } else {
        targetIndex = 0; // wrap around to first
      }
    }

    const target = list[targetIndex];
    if (target) {
      this.lastDiagnosticIndex = targetIndex;
      this.lastDiagnosticLine = target.line;
      this.lastDiagnosticFile = target.file;

      this.jumpToLine({
        filePath: target.file,
        line: target.line,
        highlight: 'error',
      });

      this.notifier.info(
        `Error ${targetIndex + 1}/${list.length}: ${target.message}${
          target.file ? ` (${target.file}:${target.line})` : ` (line ${target.line})`
        }`,
        { id: 'compiler-diagnostic-step' }
      );

      editorCommandBus.dispatch({
        type: 'editor:error-stepped',
        errorIndex: targetIndex,
        file: target.file,
        line: target.line,
        message: target.message,
      });
    }
  }

  /**
   * Jumps to the previous diagnostic error across the project (Overleaf Parity: Shift+F8).
   * Citation: overleaf.com/learn/how-to/Debugging_LaTeX_errors_with_Overleaf#Navigating_errors
   */
  public jumpToPrevDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    const list = this.getProjectDiagnostics(severity);
    if (list.length === 0) {
      if (severity === 'error') {
        const warnings = this.getProjectDiagnostics('warning');
        if (warnings.length > 0) {
          this.jumpToPrevDiagnostic('warning');
          return;
        }
      }
      this.notifier.info('No compilation errors in project', { id: 'compiler-diagnostic-step' });
      return;
    }

    const activePage = usePageStore.getState().getActiveDocument();
    const currentFile = activePage?.title || activePage?.path || activePage?.id || '';
    const engine = getActiveEditorInstance();
    const currentCursor = engine?.getCursorPosition();
    const isCurrentFileSameAsLast =
      this.lastDiagnosticFile === currentFile ||
      currentFile.endsWith(`/${this.lastDiagnosticFile}`) ||
      (this.lastDiagnosticFile ? this.lastDiagnosticFile.endsWith(`/${currentFile}`) : false);
    const currentLine =
      currentCursor?.line ??
      (isCurrentFileSameAsLast && this.lastDiagnosticLine !== null ? this.lastDiagnosticLine : 999999);

    // 1. Search backward in current file above current line
    let targetIndex = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      const isSameFile = d.file === currentFile || currentFile.endsWith(`/${d.file}`) || d.file.endsWith(`/${currentFile}`);
      if (isSameFile && d.line < currentLine) {
        targetIndex = i;
        break;
      }
    }

    // 2. If not found in current file before cursor, step to previous item before this file in the project
    if (targetIndex === -1) {
      const firstSameFileIndex = list.findIndex(
        (d) => d.file === currentFile || currentFile.endsWith(`/${d.file}`) || d.file.endsWith(`/${currentFile}`)
      );
      if (firstSameFileIndex !== -1) {
        targetIndex = (firstSameFileIndex - 1 + list.length) % list.length;
      } else {
        targetIndex = list.length - 1; // wrap around to last
      }
    }

    const target = list[targetIndex];
    if (target) {
      this.lastDiagnosticIndex = targetIndex;
      this.lastDiagnosticLine = target.line;
      this.lastDiagnosticFile = target.file;

      this.jumpToLine({
        filePath: target.file,
        line: target.line,
        highlight: 'error',
      });

      this.notifier.info(
        `Error ${targetIndex + 1}/${list.length}: ${target.message}${
          target.file ? ` (${target.file}:${target.line})` : ` (line ${target.line})`
        }`,
        { id: 'compiler-diagnostic-step' }
      );

      editorCommandBus.dispatch({
        type: 'editor:error-stepped',
        errorIndex: targetIndex,
        file: target.file,
        line: target.line,
        message: target.message,
      });
    }
  }
}

export const navigationCoordinator = new NavigationCoordinatorRegistry();

/**
 * Dispatches jump-to-line commands to CodeMirror editor and PDF viewer
 */
export function jumpToEditorLine(line: number): void {
  if (line <= 0) return;
  editorCommandBus.dispatch({ type: 'editor:jump-to-line', line, highlight: 'synctex' });
  editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
}
