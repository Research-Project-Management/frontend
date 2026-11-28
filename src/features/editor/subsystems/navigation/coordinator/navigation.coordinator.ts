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

import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  getActiveEditorEngine,
  getEditorEngineForFile,
} from '@/features/editor/core/bus/engine-registry';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { workspaceCoordinator } from '@/features/editor/core/coordinator/workspace.coordinator';
import { documentFacade } from '@/features/editor/core/coordinator/document.facade';
import { resolveDocumentLocalFirst } from '@/features/editor/core/queries/document.queries';
import { syncShallowFileUrlParam } from '@/features/editor/domain/constants/editor.constants';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { DetachedPreviewBridge } from './detached-preview.bridge';
import {
  executeCloseDocument,
  executeCloseOtherDocuments,
  executeCloseDocumentsToRight,
  executeCloseSavedDocuments,
  executeActivateAdjacentTab,
  executeCloseActiveDocument,
  type TabNavigationHost,
} from './tab-close-navigation';
import {
  resolveJumpTargetByFilePath,
  computeDiagnosticStep,
} from './diagnostic-stepper';

interface OpenDocumentOptions {
  fileId: string;
  title: string;
  path?: string;
  content?: string;
  line?: number;
  column?: number;
  highlight?: 'error' | 'synctex';
  preview?: boolean;
}

interface PendingLineJump {
  fileId?: string;
  filePath?: string;
  line: number;
  column?: number;
  highlight?: 'error' | 'synctex';
}

export class NavigationCoordinator {
  private initialized = false;
  private lastDiagnosticLine: number | null = null;
  private lastDiagnosticFile: string | null = null;
  private pendingLineJump: PendingLineJump | null = null;
  private inFlightPrefetches = new Map<string, Promise<void>>();
  private readonly detachedPreviewBridge: DetachedPreviewBridge;
  private readonly busUnsubscribers: Array<() => void> = [];

  constructor() {
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

  /** Alias for notifyDocumentReady when an editor view registers for a file. */
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

  public isDetachedPreviewWindow(): boolean {
    return this.detachedPreviewBridge.isDetachedPreviewWindow();
  }

  private resolveCanonicalTabScope(pageStore = usePageStore.getState()): string {
    return (
      pageStore.parentPageId ||
      pageStore.rootPageId ||
      pageStore.projectId ||
      pageStore.spaceId ||
      pageStore.currentPage?.id ||
      'default'
    );
  }

  private getTabNavigationHost(): TabNavigationHost {
    return {
      resolveCanonicalTabScope: (ps) => this.resolveCanonicalTabScope(ps),
      openDocument: (opts) => this.openDocument(opts),
    };
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
          preview: cmd.preview,
        });
      }),
      editorCommandBus.subscribe('workspace:open-file', (cmd) => {
        this.openDocument({
          fileId: cmd.fileId,
          title: cmd.filePath || cmd.fileId,
          path: cmd.filePath,
          preview: cmd.preview,
        });
      }),
      editorCommandBus.subscribe('navigation:pin-tab', (cmd) => {
        useWorkspaceStore.getState().pinTab(this.resolveCanonicalTabScope(), cmd.fileId);
      }),
      editorCommandBus.subscribe('navigation:close-tab', (cmd) => {
        this.closeDocument(cmd.fileId);
      }),
      editorCommandBus.subscribe('navigation:close-other-tabs', (cmd) => {
        this.closeOtherDocuments(cmd.keepFileId);
      }),
      editorCommandBus.subscribe('navigation:close-tabs-to-right', (cmd) => {
        this.closeDocumentsToRight(cmd.fromFileId);
      }),
      editorCommandBus.subscribe('navigation:close-saved-tabs', () => {
        this.closeSavedDocuments();
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
      editorCommandBus.subscribe('editor:split', (cmd) => {
        const layoutStore = useWorkspaceStore.getState();
        layoutStore.setEditorSplitMode(cmd.direction);
        if (cmd.fileId) {
          layoutStore.pinTabForFile(cmd.fileId);
          layoutStore.setSecondaryActiveTab(this.resolveCanonicalTabScope(), cmd.fileId);
          layoutStore.setSecondaryFileId(cmd.fileId);
        }
      }),
      editorCommandBus.subscribe('editor:open-to-side', (cmd) => {
        const layoutStore = useWorkspaceStore.getState();
        layoutStore.pinTabForFile(cmd.fileId);
        layoutStore.setEditorSplitMode('vertical');
        layoutStore.setSecondaryActiveTab(this.resolveCanonicalTabScope(), cmd.fileId);
        layoutStore.setSecondaryFileId(cmd.fileId);
        layoutStore.setActiveEditorPane('secondary');
      }),
      editorCommandBus.subscribe('editor:close-split', () => {
        const layoutStore = useWorkspaceStore.getState();
        layoutStore.setEditorSplitMode('none');
        layoutStore.setSecondaryActiveTab(this.resolveCanonicalTabScope(), null);
        layoutStore.setSecondaryFileId(null);
        layoutStore.setActiveEditorPane('primary');
      }),
      editorCommandBus.subscribe('editor:focus-pane', (cmd) => {
        useWorkspaceStore.getState().setActiveEditorPane(cmd.paneId);
      }),
      editorCommandBus.subscribe('editor:swap-panes', () => {
        const layoutStore = useWorkspaceStore.getState();
        const pageStore = usePageStore.getState();
        const tabGroupId = this.resolveCanonicalTabScope(pageStore);
        const primaryId = pageStore.getActiveDocumentId();
        const secondaryId = layoutStore.secondaryActiveByProject[tabGroupId] ?? layoutStore.secondaryFileId;
        if (primaryId && secondaryId) {
          this.openDocument({ fileId: secondaryId, title: '' });
          layoutStore.setSecondaryActiveTab(tabGroupId, primaryId);
          layoutStore.setSecondaryFileId(primaryId);
        }
      }),
    );

    this.detachedPreviewBridge.initChannelIfSupported();
    this.detachedPreviewBridge.registerCommandBusBridges();
  }

  /** Opens or focuses a document tab in 0ms with LRU Cache hydration. */
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

    if (currentActiveId !== fileId) {
      sessionCoordinator.switchTab(currentActiveId || null, fileId);
    }

    const tabGroupId = this.resolveCanonicalTabScope(pageStore);
    const prevTabIds = (tabsStore.tabsByProject[tabGroupId] ?? []).map((t) => t.id);
    const isPreview = Boolean(options.preview);
    tabsStore.openTab(tabGroupId, {
      id: fileId,
      title,
      path: optPath || title,
      isPinned: !isPreview,
      isPreview,
      isDirty: false,
    });
    tabsStore.setActiveTab(tabGroupId, fileId);

    const afterTabIds = new Set(
      (useWorkspaceStore.getState().tabsByProject[tabGroupId] ?? []).map((t) => t.id),
    );
    for (const prevId of prevTabIds) {
      if (prevId !== fileId && !afterTabIds.has(prevId)) {
        sessionCoordinator.closeTab(prevId);
      }
    }

    let existingModel = lruDocumentCache.getModel(fileId);
    const hasExplicitOptContent = typeof optContent === 'string';
    const authorityContent = documentFacade.getDocumentContent(fileId);
    const wsFiles = workspaceCoordinator.getProjectFiles() || [];
    const targetPathLower = (optPath || title || '').replace(/\\/g, '/').toLowerCase();
    const wsMatch = wsFiles.find((f) => {
      if (f.id === fileId) return true;
      const fPath = (f.path || f.title || '').replace(/\\/g, '/').toLowerCase();
      return Boolean(
        targetPathLower &&
          fPath &&
          (fPath === targetPathLower ||
            fPath.endsWith(`/${targetPathLower}`) ||
            targetPathLower.endsWith(`/${fPath}`)),
      );
    });
    const isRootAlias =
      fileId === pageStore.currentPage?.id ||
      fileId === pageStore.parentPageId ||
      fileId === pageStore.rootPageId ||
      fileId === pageStore.rootDocId;
    const hasPageStoreMatch =
      isRootAlias && pageStore.currentPage?.content !== undefined;
    const hasAuthoritativeFallback =
      hasExplicitOptContent ||
      Boolean(authorityContent) ||
      Boolean(wsMatch?.content !== undefined && String(wsMatch.content).length > 0) ||
      hasPageStoreMatch;

    const resolveFallbackContent = (): string => {
      if (hasExplicitOptContent) return optContent!;
      if (authorityContent) return authorityContent;
      if (wsMatch?.content !== undefined) return extractDocumentContentString(wsMatch.content);
      if (hasPageStoreMatch) return extractDocumentContentString(pageStore.currentPage!.content);
      return '';
    };

    if (!existingModel) {
      lruDocumentCache.registerModel(fileId, {
        content: resolveFallbackContent(),
        filePath: optPath || title,
        projectId: tabGroupId,
        isAuthoritative: hasAuthoritativeFallback,
      });
      existingModel = lruDocumentCache.getModel(fileId);
    } else if (!existingModel.content && hasAuthoritativeFallback) {
      const resolvedContent = resolveFallbackContent();
      if (resolvedContent || hasExplicitOptContent) {
        lruDocumentCache.updateContent(fileId, resolvedContent, false);
        existingModel = lruDocumentCache.getModel(fileId);
      }
    }

    const rootPageId = pageStore.currentPage?.id || tabGroupId || fileId;
    pageStore.setActiveFilePage({
      id: fileId,
      title,
      path: optPath || title,
      content: existingModel?.content || '',
      pageId: rootPageId,
      spaceId: pageStore.spaceId,
      projectId: pageStore.projectId,
    });

    const rootId = pageStore.currentPage?.id || tabGroupId;
    const isRoot = fileId === rootId || fileId === `${rootId}-main`;
    syncShallowFileUrlParam(isRoot ? undefined : fileId);

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
      this.scheduleDeterministicAction(() => {
        editorCommandBus.dispatch({ type: 'editor:focus' });
      });
    }
  }

  /** Closes a document tab and gracefully activates the adjacent tab. */
  public closeDocument(fileId: string): void {
    executeCloseDocument(this.getTabNavigationHost(), fileId);
  }

  /** Closes all non-root, clean tabs except `keepFileId` in the canonical page scope. */
  public closeOtherDocuments(keepFileId: string): void {
    executeCloseOtherDocuments(this.getTabNavigationHost(), keepFileId);
  }

  /** Closes clean non-root tabs strictly to the right of `fromFileId` in the canonical page scope. */
  public closeDocumentsToRight(fromFileId: string): void {
    executeCloseDocumentsToRight(this.getTabNavigationHost(), fromFileId);
  }

  /** Closes all saved (clean), non-root tabs in the canonical page scope. */
  public closeSavedDocuments(): void {
    executeCloseSavedDocuments(this.getTabNavigationHost());
  }

  /** Activates the next (`delta: 1`) or previous (`delta: -1`) tab in cyclic order. */
  public activateAdjacentTab(delta: 1 | -1): void {
    executeActivateAdjacentTab(this.getTabNavigationHost(), delta);
  }

  /** Closes the currently active tab unless it is the protected root document. */
  public closeActiveDocument(): void {
    executeCloseActiveDocument(this.getTabNavigationHost());
  }

  /** Best-effort local-first background prefetch on tab hover with in-flight request deduplication. */
  public async prefetchDocument(fileId: string, fallbackPath?: string): Promise<void> {
    const existingModel = lruDocumentCache.getModel(fileId);
    if (
      !fileId ||
      fileId.startsWith('asset:') ||
      (existingModel && existingModel.isAuthoritative !== false)
    ) {
      return;
    }

    const existing = this.inFlightPrefetches.get(fileId);
    if (existing) return existing;

    const promise = (async () => {
      try {
        await resolveDocumentLocalFirst(fileId, { fallbackPath });
      } catch {
        // Ignore background prefetch errors
      } finally {
        this.inFlightPrefetches.delete(fileId);
      }
    })();

    this.inFlightPrefetches.set(fileId, promise);
    return promise;
  }

  /** Scrolls CodeMirror smoothly to line/column with pulse highlight. */
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
        payload: { fileId, filePath, line, column, highlight },
      });
      return;
    }

    const activePage = usePageStore.getState().getActiveDocument();
    const { resolvedFileId, resolvedTitle } = resolveJumpTargetByFilePath(fileId, filePath);

    const layoutState = useWorkspaceStore.getState();
    const isMountedInSecondaryPane =
      Boolean(resolvedFileId) &&
      layoutState.editorSplitMode !== 'none' &&
      layoutState.secondaryFileId === resolvedFileId;

    if (isMountedInSecondaryPane && resolvedFileId) {
      layoutState.setActiveEditorPane('secondary');
      this.executeLineJump({ fileId: resolvedFileId, filePath, line, column, highlight });
      return;
    }

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

    this.executeLineJump({ fileId: resolvedFileId, filePath, line, column, highlight });
  }

  private stepDiagnostic(direction: 1 | -1, severity: 'error' | 'warning' = 'error'): void {
    const result = computeDiagnosticStep({
      direction,
      severity,
      lastDiagnosticLine: this.lastDiagnosticLine,
      lastDiagnosticFile: this.lastDiagnosticFile,
    });
    if (!result) return;

    const { targetIndex, target } = result;
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

  /** Jumps to the next diagnostic error across the project (Overleaf Parity: F8). */
  public jumpToNextDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    this.stepDiagnostic(1, severity);
  }

  /** Jumps to the previous diagnostic error across the project (Overleaf Parity: Shift+F8). */
  public jumpToPrevDiagnostic(severity: 'error' | 'warning' = 'error'): void {
    this.stepDiagnostic(-1, severity);
  }
}

export const navigationCoordinator = new NavigationCoordinator();

/** Dispatches jump-to-line commands to CodeMirror editor and PDF viewer. */
export function jumpToEditorLine(line: number): void {
  if (line <= 0) return;
  editorCommandBus.dispatch({ type: 'editor:jump-to-line', line, highlight: 'synctex' });
  editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line });
}
