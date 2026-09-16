/**
 * popout-channel.util.ts
 *
 * Cross-window bi-directional communication bridge between Monaco Editor and Detached PDF Viewer
 * using HTML5 BroadcastChannel and same-realm instance dispatch.
 */

import type { CompileStatus } from '../types/compiler.types';

export interface PopoutViewerState {
  pdfUrl: string | null;
  compileStatus: CompileStatus;
  compileLog: string | null;
  lastCompiledAt: string | null;
  engine?: string;
  compileMode?: 'full' | 'draft';
}

export type PopoutMessage =
  | { type: 'VIEWER_READY' }
  | { type: 'SYNC_STATE'; state: PopoutViewerState }
  | { type: 'REQUEST_COMPILE' }
  | { type: 'REQUEST_FORCE_SYNC' }
  | { type: 'FORWARD_SYNC'; page: number; line?: number }
  | {
      type: 'REVERSE_SYNC';
      sourcePath: string | null;
      line: number;
      pageNum?: number;
      x?: number;
      y?: number;
    }
  | { type: 'REATTACH_REQUEST' }
  | { type: 'WINDOW_CLOSED' }
  | { type: 'HEARTBEAT' };

type MessageCallback = (msg: PopoutMessage) => void;

export class ViewerBroadcastBridge {
  private static activeInstances = new Set<ViewerBroadcastBridge>();

  public readonly channelName: string;
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MessageCallback> = new Set();
  public isDisposed = false;

  constructor(pageId: string) {
    this.channelName = `flux:pdf-popout:${pageId}`;
    ViewerBroadcastBridge.activeInstances.add(this);

    if (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
      try {
        this.channel = new window.BroadcastChannel(this.channelName);
        this.channel.onmessage = (event: MessageEvent<PopoutMessage>) => {
          if (this.isDisposed || !event.data) return;
          this.notifyListeners(event.data);
        };
      } catch {
        this.channel = null;
      }
    }
  }

  public notifyListeners(msg: PopoutMessage) {
    for (const callback of Array.from(this.listeners)) {
      try {
        callback(msg);
      } catch (err) {
        console.error('[ViewerBroadcastBridge] Listener error:', err);
      }
    }
  }

  /**
   * Subscribe to messages coming from the peer window
   */
  public subscribe(callback: MessageCallback): () => void {
    if (this.isDisposed) return () => {};
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Broadcast a message to the peer window and other local instances
   */
  public postMessage(msg: PopoutMessage): void {
    if (this.isDisposed) return;

    // 1. Cross-window broadcast via native BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('[ViewerBroadcastBridge] Native BroadcastChannel postMessage failed:', err);
      }
    }

    // 2. Dispatch to other active bridge instances in the same JavaScript realm
    for (const instance of Array.from(ViewerBroadcastBridge.activeInstances)) {
      if (instance !== this && instance.channelName === this.channelName && !instance.isDisposed) {
        instance.notifyListeners(msg);
      }
    }
  }

  /**
   * Close the channel and detach all listeners
   */
  public destroy(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    ViewerBroadcastBridge.activeInstances.delete(this);
    this.listeners.clear();

    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // ignore
      }
      this.channel = null;
    }
  }
}
