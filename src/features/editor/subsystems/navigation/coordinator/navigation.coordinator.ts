/**
 * navigation.coordinator.ts
 *
 * Unified Document Navigation & Focus Coordinator (Coordinators Layer).
 * Location: `features/editor/subsystems/navigation/coordinator/navigation.coordinator.ts`
 *
 * Single Source of Truth for:
 * - Switching active documents and tab management (0ms instant hydration).
 * - Bi-directional SyncTeX navigation to source code lines.
 * - Diagnostic jump (Next Error / Previous Error).
 * - CodeMirror focus and selection restoration.
 */

import {
  type EditorTab,
  usePageStore,
  useWorkspaceStore,
  editorCommandBus,
  sessionCoordinator,
  workspaceCoordinator,
  documentAuthority,
  getActiveEditorEngine,
  getEditorEngineForFile,
  syncShallowFileUrlParam,
} from '@/features/editor/core';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { useCompileStore } from '@/features/editor/subsystems/compiler';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics';
import { DetachedPreviewBridge } from './detached-preview.bridge';
import { toast } from 'sonner';

export interface NavigationNotificationPort {
  info(message: string, options?: { id?: string }): void;
}

export const defaultNavigationNotifier: NavigationNotificationPort = {
  info(message, options) {
    if (typeof window !== 'undefined') {
      try {
        toast.info(message, options);
      } catch (err) {
        console.warn('[NavigationCoordinator] Notification toast failed:', err);
      }
    }
  },
};

export interface OpenDocumentOptions {
  fileId: string;
  title: string;
  path?: string;
  content?: string;
  line?: number;
  column?: number;
  highlight?: 'error' | 'synctex';
  preview?: boolean;
}

export interface PendingLineJump {
  fileId?: string;
  filePath?: string;
  line: number;
  column?: number;
  highlight?: 'error' | 'synctex';
}

export class NavigationCoordinatorRegistry {
  private initialized = false;
  private lastDiagnosticIndex: number = -1;
  private lastDiagnosticLine: number | null = null;
  private lastDiagnosticFile: string | null = null;
  private notifier: NavigationNotificationPort;
  private pendingLineJump: PendingLineJump | null = null;
  private readonly detachedPreviewBridge: DetachedPreviewBridge;

  constructor(options: { notifier?: NavigationNotificationPort } = {}) {
    this.notifier = options.notifier || defaultNavigationNotifier;
    this.detachedPreviewBridge = new DetachedPreviewBridge({
      onJumpToCode: (payload) => {
        if (payload.fileId || payload.filePath) {
          this.openDocument({
            fileId: payload.fileId || payload.filePath || 'main.tex',
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
      },
    });
    this.initCommandSubscriptions();
  }

  public getPendingLineJump(): PendingLineJump | null {
    return this.pendingLineJump;
  }

  public clearPendingLineJump(): void {
    this.pendingLineJump = null;
  }

  /**
   * Notifies the coordinator that an editor view has mounted or switched to a document,
   * deterministically draining any pending line jump for that document.
   */
  public notifyDocumentReady(fileId?: string, filePath?: string): void {
    if (!this.pendingLineJump) return;
    const pending = this.pendingLineJump;
    const matchesFileId = !pending.fileId || !fileId || pending.fileId === fileId;
    const matchesFilePath =
      !pending.filePath ||
      !filePath ||
      pending.filePath === filePath ||
      filePath.endsWith(`/${pending.filePath}`) ||
      pending.filePath.endsWith(`/${filePath}`);

    if (matchesFileId || matchesFilePath) {
      this.pendingLineJump = null;
      this.executeLineJump(pending);
    }
  }

  /**
   * Alias for notifyDocumentReady when an editor view registers for a file.
   */
  public registerEditorView(fileId?: string, filePath?: string): void {
    this.notifyDocumentReady(fileId, filePath);
  }

  private executeLineJump(target: PendingLineJump): void {
    const { fileId, line, column, highlight = 'synctex' } = target;
    if (fileId) {
      const targetEngine = getEditorEngineForFile?.(fileId);
      if (targetEngine?.jumpToLine) {
        targetEngine.jumpToLine(line, highlight);
      }
    }
    editorCommandBus.dispatch({
      type: 'editor:jump-to-line',
      line,
      column,
      highlight,
    });
  }

  private scheduleDeterministicAction(action: () => void): void {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(() => {
        action();
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => action());
        }
      });
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => action());
    } else {
      action();
    }
  }

  public resetDiagnosticState(): void {
    this.lastDiagnosticIndex = -1;
    this.lastDiagnosticLine = null;
    this.lastDiagnosticFile = null;
  }

  public getBroadcastChannel(): BroadcastChannel | null {
    return this.detachedPreviewBridge.getChannel();
  }

  public setBroadcastChannel(channel: BroadcastChannel | null): void {
    this.detachedPreviewBridge.setChannel(channel);
  }

  public attachBroadcastChannelListeners(): void {
    this.detachedPreviewBridge.attachChannelListeners();
  }

  private readonly busUnsubscribers: Array<() => void> = [];

  public isDetachedPreviewWindow(): boolean {
    return this.detachedPreviewBridge.isDetachedPreviewWindow();
  }

  public initCommandSubscriptions(force = false): void {
    if (typeof window === 'undefined') return;
    if (this.initialized && !force) return;
    this.initialized = true;

    for (const unsub of this.busUnsubscribers.splice(0)) {
      try {
        unsub();
      } catch {
        // Ignore cleanup error
      }
    }

    this.busUnsubscribers.push(
      editorCommandBus.subscribe('navigation:open-tab', (cmd) => {
        this.openDocument({
          fileId: cmd.fileId,
          title: cmd.title,
          path: cmd.path,
        });
      }),
      editorCommandBus.subscribe('navigation:close-tab', (cmd) => {
        this.closeDocument(cmd.fileId);
      }),
      editorCommandBus.subscribe('navigation:jump-to-line', (cmd) => {
        this.jumpToLine({
          fileId: cmd.fileId,
          filePath: cmd.filePath,
          line: cmd.line,
          column: cmd.column,
          highlight: cmd.highlight,
        });
      }),
      editorCommandBus.subscribe('navigation:next-error', () => {
        this.jumpToNextDiagnostic('error');
      }),
      editorCommandBus.subscribe('navigation:prev-error', () => {
        this.jumpToPrevDiagnostic('error');
      }),
      // Multi-Pane Split Editor Subscriptions
      editorCommandBus.subscribe('editor:split', (cmd) => {
        const layoutStore = useWorkspaceStore.getState();
        layoutStore.setEditorSplitMode(cmd.direction);
        if (cmd.fileId) {
          layoutStore.setSecondaryFileId(cmd.fileId);
        }
      }),
      editorCommandBus.subscribe('editor:open-to-side', (cmd) => {
        const layoutStore = useWorkspaceStore.getState();
        layoutStore.setEditorSplitMode('vertical');
        layoutStore.setSecondaryFileId(cmd.fileId);
        layoutStore.setActiveEditorPane('secondary');
      }),
      editorCommandBus.subscribe('editor:close-split', () => {
        const layoutStore = useWorkspaceStore.getState();
        layoutStore.setEditorSplitMode('none');
        layoutStore.setSecondaryFileId(null);
        layoutStore.setActiveEditorPane('primary');
      }),
      editorCommandBus.subscribe('editor:focus-pane', (cmd) => {
        useWorkspaceStore.getState().setActiveEditorPane(cmd.paneId);
      }),
      editorCommandBus.subscribe('editor:swap-panes', () => {
        const layoutStore = useWorkspaceStore.getState();
        const pageStore = usePageStore.getState();
        const primaryId = pageStore.getActiveDocumentId();
        const secondaryId = layoutStore.secondaryFileId;
        if (primaryId && secondaryId) {
          this.openDocument({ fileId: secondaryId, title: '' });
          layoutStore.setSecondaryFileId(primaryId);
        }
      }),
    );

    // Delegate Cross-Window BroadcastChannel & Detached Preview Bridges to DetachedPreviewBridge
    this.detachedPreviewBridge.initChannelIfSupported();
    this.detachedPreviewBridge.registerCommandBusBridges();
  }

  /**
   * Opens or focuses a document tab in 0ms with LRU Cache hydration
   */
  public openDocument(options: OpenDocumentOptions): void {
    const { fileId, title, path: optPath, content: optContent, line, column, highlight } = options;

    if (this.isDetachedPreviewWindow()) {
      this.detachedPreviewBridge.postMessage({
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

    const tabsStore = useWorkspaceStore.getState();
    const pageStore = usePageStore.getState();

    const currentActiveId = pageStore.getActiveDocumentId() || lruDocumentCache.getActiveFileId();

    // 1. If switching to a different file, preserve current buffer in LRU cache and activate session
    if (currentActiveId !== fileId) {
      sessionCoordinator.switchTab(currentActiveId || null, fileId);
    }

    // 2. Open or activate tab in tabs store
    const effectiveProjectId = pageStore.projectId || pageStore.currentPage?.id || 'default';
    const tabItem = {
      id: fileId,
      title,
      path: optPath || title,
      isPinned: false,
      isDirty: false,
    };
    tabsStore.openTab(effectiveProjectId, tabItem);
    tabsStore.setActiveTab(effectiveProjectId, fileId);
    const parentId = pageStore.parentPageId || pageStore.currentPage?.id;
    if (parentId && parentId !== effectiveProjectId) {
      tabsStore.openTab(parentId, tabItem);
      tabsStore.setActiveTab(parentId, fileId);
    }

    // 3. Ensure in-memory model exists in LRU cache (resolving initial content from project files/hierarchy)
    let existingModel = lruDocumentCache.getModel(fileId);
    const resolveFallbackContent = (): string => {
      if (typeof optContent === 'string' && optContent.length > 0) {
        return optContent;
      }
      const authorityContent = documentAuthority.getDocumentContent(fileId);
      if (authorityContent) {
        return authorityContent;
      }
      const wsFiles = workspaceCoordinator.getProjectFiles() || [];
      const targetPathLower = (optPath || title || '').replace(/\\/g, '/').toLowerCase();
      const wsMatch = wsFiles.find((f) => {
        if (f.id === fileId) return true;
        const fPath = (f.path || f.title || '').replace(/\\/g, '/').toLowerCase();
        return Boolean(targetPathLower && fPath && (fPath === targetPathLower || fPath.endsWith(`/${targetPathLower}`) || targetPathLower.endsWith(`/${fPath}`)));
      });
      if (wsMatch?.content !== undefined) {
        return extractDocumentContentString(wsMatch.content);
      }
      if (pageStore.currentPage?.id === fileId && pageStore.currentPage?.content !== undefined) {
        return extractDocumentContentString(pageStore.currentPage.content);
      }
      return '';
    };

    if (!existingModel) {
      const resolvedContent = resolveFallbackContent();
      lruDocumentCache.registerModel(fileId, {
        content: resolvedContent,
        filePath: optPath || title,
        projectId: effectiveProjectId,
      });
      existingModel = lruDocumentCache.getModel(fileId);
    } else if (!existingModel.content) {
      const resolvedContent = resolveFallbackContent();
      if (resolvedContent) {
        lruDocumentCache.updateContent(fileId, resolvedContent, false);
        existingModel = lruDocumentCache.getModel(fileId);
      }
    }

    // 4. Set active in pageStore
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
    const rootId = pageStore.currentPage?.id || pageStore.projectId;
    const isRoot = fileId === rootId || fileId === `${rootId}-main`;
    this.syncFileUrlParam(isRoot ? undefined : fileId);

    // 4. If target coordinates are specified, queue deterministic jump and trigger microtask/rAF fallback
    if (line !== undefined) {
      this.pendingLineJump = {
        fileId,
        filePath: optPath || title,
        line,
        column,
        highlight,
      };
      this.scheduleDeterministicAction(() => {
        if (this.pendingLineJump && this.pendingLineJump.fileId === fileId) {
          const pending = this.pendingLineJump;
          if (getActiveEditorEngine()) {
            this.pendingLineJump = null;
          }
          this.executeLineJump(pending);
        }
      });
    } else {
      // Focus editor deterministically via microtask/rAF without arbitrary 50ms timeout
      this.scheduleDeterministicAction(() => {
        editorCommandBus.dispatch({ type: 'editor:focus' });
      });
    }
  }

  /**
   * Synchronizes or clears the shallow `?file=` query parameter without a page reload.
   */
  private syncFileUrlParam(fileId?: string): void {
    syncShallowFileUrlParam(fileId);
  }

  /**
   * Closes a document tab and gracefully activates the adjacent tab
   */
  public closeDocument(fileId: string): void {
    const tabsStore = useWorkspaceStore.getState();
    const pageStore = usePageStore.getState();
    const projectId = pageStore.projectId || pageStore.parentPageId || pageStore.currentPage?.id || 'default';
    const parentId = pageStore.parentPageId || pageStore.currentPage?.id;

    // 1. Save and evict from session coordinator
    sessionCoordinator.closeTab(fileId);

    // 2. Close in parentId scope if distinct from projectId
    if (parentId && parentId !== projectId) {
      tabsStore.closeTab(parentId, fileId);
    }

    // 3. Close in primary projectId scope and gracefully route to adjacent tab
    tabsStore.closeTab(projectId, fileId, (nextId) => {
      const rootPageId = parentId || pageStore.currentPage?.id || projectId;
      const isNextRoot = !nextId || nextId === rootPageId || nextId === `${rootPageId}-main`;

      if (!isNextRoot && nextId) {
        tabsStore.setActiveTab(projectId, nextId);
        if (parentId && parentId !== projectId) {
          tabsStore.setActiveTab(parentId, nextId);
        }
        const tabs = tabsStore.tabsByProject[projectId] || (parentId ? tabsStore.tabsByProject[parentId] : []) || [];
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
        tabsStore.setActiveTab(projectId, rootPageId);
        if (parentId && parentId !== projectId) {
          tabsStore.setActiveTab(parentId, rootPageId);
        }
        const rootPage = pageStore.currentPage;
        if (rootPage) {
          pageStore.setActiveFilePage(rootPage);
          this.syncFileUrlParam(undefined);
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
      this.detachedPreviewBridge.postMessage({
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
      const normalizedTarget = filePath.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
      const matchesTargetPath = (candidate?: string): boolean => {
        if (!candidate) return false;
        const norm = candidate.replace(/\\/g, '/').replace(/^\.?\//, '').toLowerCase();
        return Boolean(
          norm &&
            (norm === normalizedTarget ||
              norm.endsWith(`/${normalizedTarget}`) ||
              normalizedTarget.endsWith(`/${norm}`))
        );
      };

      const model = lruDocumentCache.findByPath(filePath);
      if (model) {
        resolvedFileId = model.fileId;
        resolvedTitle = model.filePath;
      } else {
        const tabsByProject = useWorkspaceStore.getState().tabsByProject;
        const allTabs = Object.values(tabsByProject).flat();
        const matchingTab = allTabs.find(
          (t: EditorTab) =>
            t.path === filePath ||
            t.title === filePath ||
            t.id === filePath ||
            matchesTargetPath(t.path || t.title)
        );
        if (matchingTab) {
          resolvedFileId = matchingTab.id;
          resolvedTitle = matchingTab.title;
        } else {
          const projectFiles = workspaceCoordinator.getProjectFiles() || [];
          const matchingWsFile = projectFiles.find(
            (f) => f.id === filePath || matchesTargetPath(f.path || f.title)
          );
          if (matchingWsFile) {
            resolvedFileId = matchingWsFile.id;
            resolvedTitle = matchingWsFile.title || matchingWsFile.path || filePath;
          } else {
            const overlayFiles = documentAuthority.getOverlayFiles() || [];
            const matchingOverlay = overlayFiles.find(
              (f) => f.id === filePath || matchesTargetPath(f.path)
            );
            if (matchingOverlay) {
              resolvedFileId = matchingOverlay.id;
              resolvedTitle = matchingOverlay.path || filePath;
            }
          }
        }
      }
    }

    const layoutState = useWorkspaceStore.getState();
    const isMountedInSecondaryPane =
      Boolean(resolvedFileId) &&
      layoutState.editorSplitMode !== 'none' &&
      layoutState.secondaryFileId === resolvedFileId;

    if (isMountedInSecondaryPane && resolvedFileId) {
      layoutState.setActiveEditorPane('secondary');
      this.executeLineJump({
        fileId: resolvedFileId,
        filePath,
        line,
        column,
        highlight,
      });
      return;
    }

    // If target file differs from currently active file, open it first
    if (resolvedFileId && (!activePage || resolvedFileId !== activePage.id)) {
      this.openDocument({
        fileId: resolvedFileId,
        title: resolvedTitle,
        path: filePath || resolvedTitle,
        line,
        column,
        highlight,
      });
      return;
    }

    this.executeLineJump({
      fileId: resolvedFileId,
      filePath,
      line,
      column,
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
   * Steps forward (+1) or backward (-1) across project diagnostics with wrap-around.
   */
  private stepDiagnostic(direction: 1 | -1, severity: 'error' | 'warning' = 'error'): void {
    const list = this.getProjectDiagnostics(severity);
    if (list.length === 0) {
      if (severity === 'error') {
        const warnings = this.getProjectDiagnostics('warning');
        if (warnings.length > 0) {
          this.stepDiagnostic(direction, 'warning');
          return;
        }
      }
      return;
    }

    const activePage = usePageStore.getState().getActiveDocument();
    const currentFile = activePage?.title || activePage?.path || activePage?.id || '';
    const engine = getActiveEditorEngine();
    const currentCursor = engine?.getCursorPosition();
    const isSameFile = (file: string) =>
      file === currentFile || currentFile.endsWith(`/${file}`) || file.endsWith(`/${currentFile}`);
    const isCurrentFileSameAsLast =
      Boolean(this.lastDiagnosticFile) && isSameFile(this.lastDiagnosticFile!);
    const fallbackLine = direction === 1 ? 0 : 999999;
    const currentLine =
      currentCursor?.line ??
      (isCurrentFileSameAsLast && this.lastDiagnosticLine !== null ? this.lastDiagnosticLine : fallbackLine);

    let targetIndex = -1;
    if (direction === 1) {
      // 1. Search forward in current file below current line
      targetIndex = list.findIndex((d) => isSameFile(d.file) && d.line > currentLine);
      // 2. Wrap to next item in project array
      if (targetIndex === -1) {
        const lastSameFileIndex = list.map((d) => isSameFile(d.file)).lastIndexOf(true);
        targetIndex = lastSameFileIndex !== -1 ? (lastSameFileIndex + 1) % list.length : 0;
      }
    } else {
      // 1. Search backward in current file above current line
      for (let i = list.length - 1; i >= 0; i--) {
        if (isSameFile(list[i].file) && list[i].line < currentLine) {
          targetIndex = i;
          break;
        }
      }
      // 2. Wrap to previous item in project array
      if (targetIndex === -1) {
        const firstSameFileIndex = list.findIndex((d) => isSameFile(d.file));
        targetIndex = firstSameFileIndex !== -1 ? (firstSameFileIndex - 1 + list.length) % list.length : list.length - 1;
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
   * Jumps to the next diagnostic error across the project (Overleaf Parity: F8).
   * Citation: overleaf.com/learn/how-to/Debugging_LaTeX_errors_with_Overleaf#Navigating_errors
   */
  public jumpToNextDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    this.stepDiagnostic(1, severity);
  }

  /**
   * Jumps to the previous diagnostic error across the project (Overleaf Parity: Shift+F8).
   * Citation: overleaf.com/learn/how-to/Debugging_LaTeX_errors_with_Overleaf#Navigating_errors
   */
  public jumpToPrevDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    this.stepDiagnostic(-1, severity);
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
