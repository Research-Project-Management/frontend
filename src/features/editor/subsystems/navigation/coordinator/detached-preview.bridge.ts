/**
 * detached-preview.bridge.ts
 *
 * Mediator / Adapter Pattern: Encapsulates Cross-Window BroadcastChannel
 * synchronization between the Main Editor Window and the Detached PDF Preview Window.
 */

import { logger } from '@/shared/lib/logger';
import {
  buildPageScopeHref,
  resolveEditorScopeFromState,
} from '@/features/editor/core/coordinator/editor-scope';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import {
  editorCommandBus,
  getActiveEditorEngine,
} from '@/features/editor/core/bus/command-bus';
import { getSyncTexChannelName } from '@/features/editor/domain/constants/editor.constants';
import {
  compilerCoordinator,
  useCompileStore,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler';

export interface DetachedPreviewNavigationCallbacks {
  onJumpToCode: (payload: {
    fileId?: string;
    filePath?: string;
    line: number;
    column?: number;
    highlight?: 'error' | 'synctex';
  }) => void;
}

export class DetachedPreviewBridge {
  private broadcastChannel: BroadcastChannel | null = null;
  private isCustomChannel = false;
  private currentChannelName: string | null = null;
  private pageStoreUnsub: (() => void) | null = null;
  private readonly busUnsubscribers: Array<() => void> = [];

  constructor(private readonly callbacks: DetachedPreviewNavigationCallbacks) {}

  public getChannel(): BroadcastChannel | null {
    return this.broadcastChannel;
  }

  public setChannel(channel: BroadcastChannel | null): void {
    this.broadcastChannel = channel;
    this.isCustomChannel = channel !== null;
    this.currentChannelName = channel?.name ?? null;
    if (this.broadcastChannel) {
      this.attachChannelListeners();
    }
  }

  public resolveActiveTargetId(): string | null {
    const pageStore = usePageStore.getState();
    const scope = resolveEditorScopeFromState(pageStore);
    return (
      pageStore.parentPageId ||
      scope.rootPageId ||
      scope.effectiveScopeId ||
      null
    );
  }

  public syncScopedChannel(): void {
    if (
      this.isCustomChannel ||
      typeof window === 'undefined' ||
      !('BroadcastChannel' in window)
    ) {
      return;
    }

    const targetName = getSyncTexChannelName(this.resolveActiveTargetId());
    if (this.broadcastChannel && this.currentChannelName === targetName) {
      return;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Ignore close error
      }
      this.broadcastChannel = null;
    }

    try {
      this.broadcastChannel = new BroadcastChannel(targetName);
      this.currentChannelName = targetName;
      this.attachChannelListeners();
    } catch (err) {
      this.currentChannelName = null;
      logger.warn(
        '[DetachedPreviewBridge] BroadcastChannel initialization failed',
        { error: err },
      );
    }
  }

  public initChannelIfSupported(): void {
    this.syncScopedChannel();
    if (!this.pageStoreUnsub && typeof window !== 'undefined') {
      this.pageStoreUnsub = usePageStore.subscribe(() => {
        this.syncScopedChannel();
      });
    }
  }

  public isDetachedPreviewWindow(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.includes('/preview') ||
      (useWorkspaceStore.getState().isPdfDetached && !getActiveEditorEngine())
    );
  }

  public postMessage(message: { type: string; payload?: unknown; targetId?: string }): void {
    if (!this.isCustomChannel) {
      this.syncScopedChannel();
    }
    this.broadcastChannel?.postMessage(message);
  }

  private postCompilerSyncState(synctexOverride?: SyncTeXMap | null, coerceIdleToDone = false): void {
    const compileState = useCompileStore.getState();
    const synctexMap = synctexOverride ?? compilerCoordinator.getSynctexMap();
    const compileStatus =
      coerceIdleToDone && compileState.compileStatus === 'idle'
        ? 'done'
        : compileState.compileStatus;
    this.postMessage({
      type: 'compiler:sync-state',
      payload: {
        pdfUrl: compileState.pdfUrl,
        compileStatus,
        lastCompiledAt: compileState.lastCompiledAt?.toISOString() || null,
        logs: compileState.compileLog,
        synctexMap,
      },
    });
  }

  public attachChannelListeners(): void {
    if (!this.broadcastChannel) return;
    this.broadcastChannel.onmessage = (event) => {
      const msgTarget = (event.data as { targetId?: unknown } | undefined)?.targetId;
      if (typeof msgTarget === 'string' && msgTarget.length > 0) {
        const activeTarget = this.resolveActiveTargetId();
        if (activeTarget && msgTarget !== activeTarget) {
          return;
        }
      }

      const { type, payload } = event.data || {};
      if (type === 'synctex:jump-to-code' && payload?.line) {
        this.callbacks.onJumpToCode(payload);
        try {
          window.focus?.();
        } catch (err) {
          logger.debug('[DetachedPreviewBridge] Window focus ignored', { err });
        }
      } else if (type === 'preview:ready') {
        const compileState = useCompileStore.getState();
        const synctexMap = compilerCoordinator.getSynctexMap();
        if (compileState.pdfUrl || synctexMap) {
          this.postCompilerSyncState(synctexMap, false);
        }
      } else if (type === 'editor:scroll-to-line' && payload?.line) {
        editorCommandBus.dispatch({
          type: 'editor:scroll-to-line',
          line: payload.line,
          smooth: payload.smooth ?? true,
        });
      } else if (
        type === 'preview:window-closed' ||
        type === 'preview:closed' ||
        type === 'preview:attached'
      ) {
        useWorkspaceStore?.getState?.()?.setPdfDetached(false);
        useCompileStore?.getState?.()?.setIsViewerPoppedOut(false);
      }
    };
  }

  public registerCommandBusBridges(): void {
    for (const unsub of this.busUnsubscribers.splice(0)) {
      try {
        unsub();
      } catch {
        // Ignore cleanup error
      }
    }

    this.busUnsubscribers.push(
      editorCommandBus.subscribe('synctex:forward', (cmd) => {
        const activeDoc = usePageStore.getState().getActiveDocument();
        const activePath = activeDoc?.path || activeDoc?.title;
        this.postMessage({
          type: 'synctex:forward',
          payload: {
            line: cmd.line,
            column: cmd.column,
            filePath: cmd.filePath || activePath,
            fileId: cmd.fileId || activeDoc?.id,
          },
        });
      }),
      editorCommandBus.subscribe('viewer:jump-to-line', (cmd) => {
        this.postMessage({
          type: 'viewer:jump-to-line',
          payload: { line: cmd.line },
        });
      }),
      editorCommandBus.subscribe('viewer:goto-page', (cmd) => {
        this.postMessage({
          type: 'viewer:goto-page',
          payload: { page: cmd.page },
        });
      }),
      editorCommandBus.subscribe('sync:editor-scrolled', (cmd) => {
        this.postMessage({
          type: 'sync:editor-scrolled',
          payload: {
            line: cmd.line,
            totalLines: cmd.totalLines,
            fraction: cmd.fraction,
          },
        });
      }),
      editorCommandBus.subscribe('compiler:finished', (cmd) => {
        if (cmd.success) {
          this.postCompilerSyncState(undefined, true);
        }
      }),
      editorCommandBus.subscribe('synctex:map-updated', (cmd) => {
        if (!this.isDetachedPreviewWindow() && cmd.map) {
          this.postCompilerSyncState(cmd.map, true);
        }
      }),
      editorCommandBus.subscribe('preview:detach', (cmd) => {
        useWorkspaceStore.getState().setPdfDetached(true);
        useCompileStore.getState().setIsViewerPoppedOut(true);
        const pageStore = usePageStore.getState();
        const routeProjectMatch =
          typeof window !== 'undefined'
            ? window.location.pathname.match(/\/projects\/([^/]+)/)?.[1] ?? null
            : null;
        const routePageMatch =
          typeof window !== 'undefined'
            ? window.location.pathname.match(/\/pages\/([^/]+)/)?.[1] ?? null
            : null;
        const scope = resolveEditorScopeFromState(pageStore, {
          projectId: cmd.projectId || routeProjectMatch,
          pageId: routePageMatch,
        });
        const pageId = pageStore.parentPageId || scope.rootPageId || routePageMatch || null;
        const projectId = scope.projectId || null;
        const isPersonal = scope.spaceKind === 'personal';
        if (!this.isCustomChannel) {
          this.syncScopedChannel();
        }
        if (typeof window !== 'undefined') {
          if (isPersonal && pageId) {
            const url = buildPageScopeHref(pageId, {
              spaceKind: 'personal',
              subpath: 'preview',
            });
            window.open(url, '_blank');
          } else if (projectId) {
            const url = buildPageScopeHref(pageId || projectId, {
              spaceKind: 'project',
              projectId,
              subpath: 'preview',
            });
            window.open(url, '_blank');
          }
        }
      }),
      editorCommandBus.subscribe('preview:attach', () => {
        useWorkspaceStore.getState().setPdfDetached(false);
        useCompileStore.getState().setIsViewerPoppedOut(false);
        this.postMessage({ type: 'preview:attached' });
      }),
    );
  }

  public dispose(): void {
    this.pageStoreUnsub?.();
    this.pageStoreUnsub = null;
    for (const unsub of this.busUnsubscribers.splice(0)) {
      try {
        unsub();
      } catch {
        // Ignore cleanup error
      }
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // Ignore close error
      }
      this.broadcastChannel = null;
    }
    this.isCustomChannel = false;
    this.currentChannelName = null;
  }
}
