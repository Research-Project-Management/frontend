/**
 * yjs-socket-provider.ts
 *
 * Realtime collaborative CRDT provider connecting Yjs with Socket.IO.
 * Follows Overleaf collaboration principles & WebSocket engineering best practices:
 * - Binary Sync protocol (SyncStep1, SyncStep2, Delta Updates)
 * - Awareness protocol (Remote Cursors & Selection Highlights)
 * - Reconnection with exponential backoff & jitter
 */

import * as Y from 'yjs';
import {
  Awareness,
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
} from 'y-protocols/awareness';
import { io, Socket } from 'socket.io-client';
import { getEffectiveBaseUrl, getAuthToken } from '@/shared/lib/api';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export interface CollaboratorUser {
  id: string;
  name: string;
  avatar?: string | null;
  color?: string;
  role?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface YjsSocketIOProviderOptions {
  user?: CollaboratorUser;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSynced?: () => void;
}

export class YjsSocketIOProvider {
  public readonly doc: Y.Doc;
  public readonly awareness: Awareness;
  public readonly pageId: string;
  public status: ConnectionStatus = 'disconnected';
  public isSynced: boolean = false;

  private socket: Socket | null = null;
  private options: YjsSocketIOProviderOptions;
  private isDestroyed: boolean = false;

  constructor(
    pageId: string,
    doc: Y.Doc,
    options: YjsSocketIOProviderOptions = {},
  ) {
    this.pageId = pageId;
    this.doc = doc;
    this.options = options;
    this.awareness = new Awareness(doc);

    // Configure initial local awareness state
    if (options.user) {
      this.setLocalUser(options.user);
    }

    this.connect();
    this.bindDocEvents();
    this.bindAwarenessEvents();
  }

  public setLocalUser(user: CollaboratorUser): void {
    this.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name || 'Anonymous Researcher',
      avatar: user.avatar,
      color: user.color || '#3B82F6',
      role: user.role || 'contributor',
    });
  }

  private connect(): void {
    if (typeof window === 'undefined' || this.isDestroyed) return;

    this.updateStatus('connecting');
    const baseUrl = getEffectiveBaseUrl();
    const token = getAuthToken();

    this.socket = io(`${baseUrl}/collaboration`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        token: token || undefined,
      },
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
    });

    this.socket.on('connect', () => {
      this.updateStatus('connected');
      this.joinRoom();
    });

    this.socket.on('disconnect', () => {
      this.isSynced = false;
      this.updateStatus('disconnected');
    });

    this.socket.on('connect_error', () => {
      this.updateStatus('disconnected');
    });

    // Handle server SyncStep1: Server tells us its state vector, we send missing updates
    this.socket.on(
      'yjs:sync-step-1',
      (payload: { pageId: string; stateVector: any }) => {
        if (payload.pageId !== this.pageId) return;
        const serverSv = new Uint8Array(payload.stateVector);
        const update = Y.encodeStateAsUpdate(this.doc, serverSv);
        if (update && update.length > 0) {
          this.socket?.emit('yjs:sync-step-2', {
            pageId: this.pageId,
            update,
          });
        }
      },
    );

    // Handle server SyncStep2: Server sent us updates we were missing
    this.socket.on(
      'yjs:sync-step-2',
      (payload: { pageId: string; update: any }) => {
        if (payload.pageId !== this.pageId) return;
        const update = new Uint8Array(payload.update);
        Y.applyUpdate(this.doc, update, this);
        if (!this.isSynced) {
          this.isSynced = true;
          this.options.onSynced?.();
        }
      },
    );

    // Handle incoming real-time document delta updates from collaborators
    this.socket.on('yjs:update', (payload: { pageId: string; update: any }) => {
      if (payload.pageId !== this.pageId) return;
      const update = new Uint8Array(payload.update);
      Y.applyUpdate(this.doc, update, this);
    });

    // Handle incoming awareness/cursor updates from collaborators
    this.socket.on(
      'yjs:awareness',
      (payload: { pageId: string; awarenessUpdate: any }) => {
        if (payload.pageId !== this.pageId) return;
        const update = new Uint8Array(payload.awarenessUpdate);
        applyAwarenessUpdate(this.awareness, update, this);
      },
    );

    // Forward document review & track changes events (Overleaf 1:1 parity)
    const reviewEvents = [
      'comment:created',
      'comment:updated',
      'comment:deleted',
      'comment:replied',
      'comment:reply-deleted',
      'suggestion:created',
      'suggestion:accepted',
      'suggestion:rejected',
      'suggestions:accepted-all',
      'suggestions:rejected-all',
    ];

    reviewEvents.forEach((eventName) => {
      this.socket?.on(eventName, (payload: any) => {
        EditorEventBus.emit('flux:review-event', {
          pageId: this.pageId,
          event: eventName,
          payload,
        });
      });
    });
  }

  private joinRoom(): void {
    if (!this.socket || !this.socket.connected) return;

    const user = this.options.user || {
      id: 'anon',
      name: 'Anonymous',
    };

    this.socket.emit('join_document', {
      pageId: this.pageId,
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
      },
    });

    // Send initial SyncStep1 to server with our local state vector
    const stateVector = Y.encodeStateVector(this.doc);
    this.socket.emit('yjs:sync-step-1', {
      pageId: this.pageId,
      stateVector,
    });

    // Send initial awareness state
    const awarenessUpdate = encodeAwarenessUpdate(this.awareness, [
      this.doc.clientID,
    ]);
    this.socket.emit('yjs:awareness', {
      pageId: this.pageId,
      awarenessUpdate,
    });
  }

  private bindDocEvents(): void {
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === this) return; // Ignore updates that came from this provider
      if (this.socket && this.socket.connected) {
        this.socket.emit('yjs:update', {
          pageId: this.pageId,
          update,
        });
      }
    });
  }

  private bindAwarenessEvents(): void {
    this.awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: any,
      ) => {
        if (origin === this) return;
        const changedClients = added.concat(updated, removed);
        if (changedClients.length === 0) return;

        const update = encodeAwarenessUpdate(this.awareness, changedClients);
        if (this.socket && this.socket.connected) {
          this.socket.emit('yjs:awareness', {
            pageId: this.pageId,
            awarenessUpdate: update,
          });
        }
      },
    );
  }

  private updateStatus(status: ConnectionStatus): void {
    this.status = status;
    this.options.onStatusChange?.(status);
  }

  public triggerCheckpoint(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('yjs:checkpoint', { pageId: this.pageId });
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.awareness.destroy();

    if (this.socket) {
      this.socket.emit('leave_document', {
        pageId: this.pageId,
        userId: this.options.user?.id || 'anon',
      });
      this.socket.disconnect();
      this.socket = null;
    }

    this.doc.destroy();
    this.updateStatus('disconnected');
  }
}
