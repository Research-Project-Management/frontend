/**
 * detached-preview.bridge.ts
 *
 * Mediator / Adapter Pattern: Encapsulates Cross-Window BroadcastChannel
 * synchronization between the Main Editor Window and the Detached PDF Preview Window.
 */

import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import {
  editorCommandBus,
  getActiveEditorEngine,
} from '@/features/editor/core/bus/command-bus';
import { getSyncTexChannelName } from '@/features/editor/domain/constants/editor.constants';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';

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

  public resolveActiveScopeId(): string | null {
    const pageStore = usePageStore.getState();
    return (
      pageStore.parentPageId ||
      pageStore.rootPageId ||
      pageStore.projectId ||
      pageStore.spaceId ||
      extractProjectId(pageStore.currentPage) ||
      pageStore.currentPage?.id ||
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

    const targetName = getSyncTexChannelName(this.resolveActiveScopeId());
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
      console.warn(
        '[DetachedPreviewBridge] BroadcastChannel initialization failed:',
        err,
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

  public postMessage(message: { type: string; payload?: unknown; scopeId?: string }): void {
    if (!this.isCustomChannel) {
      this.syncScopedChannel();
    }
    this.broadcastChannel?.postMessage(message);
  }

  public attachChannelListeners(): void {
    if (!this.broadcastChannel) return;
    this.broadcastChannel.onmessage = (event) => {
      const msgScope = (event.data as { scopeId?: unknown } | undefined)?.scopeId;
      if (typeof msgScope === 'string' && msgScope.length > 0) {
        const activeScope = this.resolveActiveScopeId();
        if (activeScope && msgScope !== activeScope) {
          return;
        }
      }

      const { type, payload } = event.data || {};
      if (type === 'synctex:jump-to-code' && payload?.line) {
        this.callbacks.onJumpToCode(payload);
        try {
          window.focus?.();
        } catch (err) {
          console.debug('[DetachedPreviewBridge] Window focus ignored:', err);
        }
      } else if (type === 'preview:ready') {
        const compileState = useCompileStore.getState();
        const synctexMap = compilerCoordinator.getSynctexMap();
        if (compileState.pdfUrl || synctexMap) {
          this.postMessage({
            type: 'compiler:sync-state',
            payload: {
              pdfUrl: compileState.pdfUrl,
              compileStatus: compileState.compileStatus,
              lastCompiledAt:
                compileState.lastCompiledAt?.toISOString() || null,
              logs: compileState.compileLog,
              synctexMap,
            },
          });
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
          const compileState = useCompileStore.getState();
          this.postMessage({
            type: 'compiler:sync-state',
            payload: {
              pdfUrl: compileState.pdfUrl,
              compileStatus:
                compileState.compileStatus === 'idle'
                  ? 'done'
                  : compileState.compileStatus,
              lastCompiledAt: compileState.lastCompiledAt?.toISOString() || null,
              logs: compileState.compileLog,
              synctexMap: compilerCoordinator.getSynctexMap(),
            },
          });
        }
      }),
      editorCommandBus.subscribe('synctex:map-updated', (cmd) => {
        if (!this.isDetachedPreviewWindow() && cmd.map) {
          const compileState = useCompileStore.getState();
          this.postMessage({
            type: 'compiler:sync-state',
            payload: {
              pdfUrl: compileState.pdfUrl,
              compileStatus:
                compileState.compileStatus === 'idle'
                  ? 'done'
                  : compileState.compileStatus,
              lastCompiledAt: compileState.lastCompiledAt?.toISOString() || null,
              logs: compileState.compileLog,
              synctexMap: cmd.map,
            },
          });
        }
      }),
      editorCommandBus.subscribe('preview:detach', (cmd) => {
        useWorkspaceStore.getState().setPdfDetached(true);
        useCompileStore.getState().setIsViewerPoppedOut(true);
        const pageStore = usePageStore.getState();
        const projectId =
          cmd.projectId ||
          pageStore.projectId ||
          pageStore.spaceId ||
          extractProjectId(pageStore.currentPage) ||
          pageStore.parentPageId ||
          pageStore.currentPage?.id ||
          (typeof window !== 'undefined'
            ? window.location.pathname.match(/\/projects\/([^/]+)/)?.[1]
            : null);
        const pageId = pageStore.parentPageId || pageStore.rootPageId || null;
        if (!this.isCustomChannel) {
          this.syncScopedChannel();
        }
        if (projectId && typeof window !== 'undefined') {
          const url =
            pageId && pageId !== projectId
              ? `/projects/${encodeURIComponent(projectId)}/preview?pageId=${encodeURIComponent(pageId)}`
              : `/projects/${projectId}/preview`;
          window.open(url, '_blank');
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
