/**
 * detached-preview.bridge.ts
 *
 * Mediator / Adapter Pattern: Encapsulates Cross-Window BroadcastChannel
 * synchronization between the Main Editor Window and the Detached PDF Preview Window.
 */

import {
  usePageStore,
  useWorkspaceStore,
  editorCommandBus,
  getActiveEditorEngine,
  SYNCTEX_BROADCAST_CHANNEL,
} from '@/features/editor/core';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { compilerCoordinator, useCompileStore } from '@/features/editor/subsystems/compiler';

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
  private readonly busUnsubscribers: Array<() => void> = [];

  constructor(private readonly callbacks: DetachedPreviewNavigationCallbacks) {}

  public getChannel(): BroadcastChannel | null {
    return this.broadcastChannel;
  }

  public setChannel(channel: BroadcastChannel | null): void {
    this.broadcastChannel = channel;
    if (this.broadcastChannel) {
      this.attachChannelListeners();
    }
  }

  public initChannelIfSupported(): void {
    if (
      !this.broadcastChannel &&
      typeof window !== 'undefined' &&
      'BroadcastChannel' in window
    ) {
      try {
        this.broadcastChannel = new BroadcastChannel(SYNCTEX_BROADCAST_CHANNEL);
        this.attachChannelListeners();
      } catch (err) {
        console.warn(
          '[DetachedPreviewBridge] BroadcastChannel initialization failed:',
          err,
        );
      }
    }
  }

  public isDetachedPreviewWindow(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.includes('/preview') ||
      (useWorkspaceStore.getState().isPdfDetached && !getActiveEditorEngine())
    );
  }

  public postMessage(message: { type: string; payload?: unknown }): void {
    this.broadcastChannel?.postMessage(message);
  }

  public attachChannelListeners(): void {
    if (!this.broadcastChannel) return;
    this.broadcastChannel.onmessage = (event) => {
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
        useWorkspaceStore.getState().setPdfDetached(false);
        useCompileStore.getState().setIsViewerPoppedOut(false);
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
          extractProjectId(pageStore.currentPage) ||
          (typeof window !== 'undefined'
            ? window.location.pathname.match(/\/projects\/([^/]+)/)?.[1]
            : null);
        if (projectId && typeof window !== 'undefined') {
          window.open(`/projects/${projectId}/preview`, '_blank');
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
  }
}
