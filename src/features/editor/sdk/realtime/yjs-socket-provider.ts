/**
 * yjs-socket-provider.ts
 *
 * Real-Time Socket.IO & Yjs Collaboration Provider for Flux (Overleaf Parity).
 * Connects CodeMirror 6 (via y-codemirror.next) to Backend ManuscriptRealtimeGateway (/manuscripts)
 * backed by Redis horizontal room fan-out.
 */

import * as Y from 'yjs';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
import { getEffectiveBaseUrl, getAuthToken } from '@/shared/lib/api';
import type { IEditorCommandBus } from '@/features/editor/core/bus/command-bus.port';
import type { CollaborationPresence } from '@/features/editor/sdk/manuscript.service';
import {
  buildLineStartsIndex,
  getOffsetFromRowCol,
  getRowColFromOffset,
  applyTextDiff,
  applyBinarySyncFrame,
  encodeMergedYjsUpdates,
  encodeYjsSyncStep1,
  extractLocalCursorCoords,
  toCollaborationPresence,
  applyRemoteCursorAwareness,
  removeRemoteCollaborator,
  type CollaboratorUser,
  type ConnectionStatus,
  type CompileProgressPayload,
  type DocContentUpdatedPayload,
  type RemoteCursorSelection,
  type RemoteCursorData,
  type RemotePresencePayload,
  type RemoteCursorPayload,
  type RemoteUserJoinedPayload,
  type ProjectChatMessage,
  type YjsSocketIOProviderOptions,
} from './yjs-awareness-sync';

export {
  buildLineStartsIndex,
  getOffsetFromRowCol,
  getRowColFromOffset,
  applyTextDiff,
  type CollaboratorUser,
  type ConnectionStatus,
  type CompileProgressPayload,
  type DocContentUpdatedPayload,
  type RemoteCursorSelection,
  type RemoteCursorData,
  type RemotePresencePayload,
  type RemoteCursorPayload,
  type RemoteUserJoinedPayload,
  type ProjectChatMessage,
  type YjsSocketIOProviderOptions,
};

export class YjsSocketIOProvider {
  /** Mutable: replaced when rebuilding from the server (see onDocReplaced). */
  public doc: Y.Doc;
  public yText: Y.Text;
  public awareness: Awareness;
  public readonly projectId: string;
  public readonly pageId: string;

  public status: ConnectionStatus = 'connecting';
  public isSynced: boolean = false;

  private socket: Socket | null = null;
  private options: YjsSocketIOProviderOptions;
  private commandBus?: IEditorCommandBus;
  private socketToClientIdMap = new Map<string, number>();
  private collaboratorsMap = new Map<string, CollaborationPresence>();
  private destroyed = false;
  public get isDestroyed(): boolean {
    return this.destroyed;
  }
  private lastEmittedCoords: { row: number; col: number } | null = null;
  private pendingUpdates: Uint8Array[] = [];
  private updateBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCursorEmitTime = 0;
  private pendingCursorData: { row: number; column: number; selection?: RemoteCursorSelection | null } | null = null;
  private cursorThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private handleOnline: (() => void) | null = null;
  private cachedText: string | null = null;
  private cachedLineStarts: number[] | null = null;

  constructor(
    projectId: string,
    pageId: string,
    doc?: Y.Doc,
    options: YjsSocketIOProviderOptions = {},
  ) {
    this.projectId = projectId;
    this.pageId = pageId;
    this.doc = doc || new Y.Doc();
    this.yText = this.doc.getText('latex');
    this.awareness = new Awareness(this.doc);
    this.options = options;
    this.commandBus = options.commandBus;

    if (options.user) {
      this.setLocalUser(options.user);
    }

    this.setupLocalAwarenessListener();
    this.setupLocalDocListener();

    if (typeof window !== 'undefined' && projectId && pageId) {
      this.connect();
    } else {
      this.status = 'connected';
      this.isSynced = true;
      this.emitStatus('connected');
      options.onSynced?.();
    }
  }

  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private chatListeners = new Set<(message: ProjectChatMessage) => void>();

  /** Subscribe to connection status changes (safe across pooled provider reuse). */
  public subscribeStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /** Subscribe to real-time project chat messages (project:chat:new). */
  public subscribeChatMessages(listener: (message: ProjectChatMessage) => void): () => void {
    this.chatListeners.add(listener);
    return () => {
      this.chatListeners.delete(listener);
    };
  }

  /** Send a real-time chat message to collaborators in the active project room (project:chat:send). */
  public sendChatMessage(text: string, replyToId?: string): Promise<ProjectChatMessage | null> {
    return new Promise((resolve) => {
      if (this.destroyed || !this.socket || !this.socket.connected || !text.trim()) {
        resolve(null);
        return;
      }
      this.socket.emit(
        'project:chat:send',
        { projectId: this.projectId, text: text.trim(), replyToId },
        (res?: { success?: boolean; message?: ProjectChatMessage }) => {
          resolve(res?.success && res.message ? res.message : null);
        },
      );
    });
  }

  /** Fetch recent real-time chat history for the active project room (project:chat:history). */
  public getChatHistory(): Promise<ProjectChatMessage[]> {
    return new Promise((resolve) => {
      if (this.destroyed || !this.socket || !this.socket.connected) {
        resolve([]);
        return;
      }
      this.socket.emit(
        'project:chat:history',
        { projectId: this.projectId },
        (res?: { success?: boolean; messages?: ProjectChatMessage[] }) => {
          resolve(res?.success && Array.isArray(res.messages) ? res.messages : []);
        },
      );
    });
  }

  /** Number of local updates queued but not yet acknowledged-sent to the server. */
  public get pendingUpdateCount(): number {
    return this.pendingUpdates.length;
  }

  private emitStatus(status: ConnectionStatus): void {
    this.options.onStatusChange?.(status);
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (err) {
        console.warn('[YjsSocketIOProvider] status listener error:', err);
      }
    }
  }

  public setCommandBus(bus: IEditorCommandBus): void {
    this.commandBus = bus;
  }

  private connect(): void {
    const rawBase = (this.options.baseUrl || getEffectiveBaseUrl() || '').replace(/\/$/, '');
    const socketUrl = rawBase ? `${rawBase}/manuscripts` : '/manuscripts';
    const token = this.options.token || getAuthToken() || undefined;
    const user = this.options.user;

    try {
      const fakeSocket = (globalThis as { __fluxFakeSocket?: Socket }).__fluxFakeSocket;
      this.socket = fakeSocket ?? io(socketUrl, {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        auth: {
          token,
          userId: user?.id,
          name: user?.name,
          avatar: user?.avatar,
          color: user?.color,
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      this.registerSocketEvents();

      if (typeof window !== 'undefined' && !this.handleOnline) {
        this.handleOnline = () => {
          if (!this.destroyed && this.socket && !this.socket.connected) {
            this.status = 'connecting';
            this.emitStatus('connecting');
            this.socket.connect();
          }
        };
        window.addEventListener('online', this.handleOnline);
      }
    } catch (err) {
      console.warn('[YjsSocketIOProvider] Failed to initialize Socket.IO client:', err);
      this.status = 'disconnected';
      this.emitStatus('disconnected');
    }
  }

  private applySyncFrame(
    data: Uint8Array | ArrayLike<number>,
    targetDoc: Y.Doc,
    emitStep2Reply: boolean,
  ): void {
    applyBinarySyncFrame(data, targetDoc, this.socket, this.projectId, this.pageId, emitStep2Reply);
  }

  private registerSocketEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      if (this.destroyed) return;
      this.status = 'connected';
      this.emitStatus('connected');

      this.socket?.emit(
        'project:join',
        { projectId: this.projectId },
        (res?: { success?: boolean; projectPresence?: CollaborationPresence[]; error?: string }) => {
          if (res?.error) {
            console.debug('[YjsSocketIOProvider] project:join info:', res.error);
          }
        },
      );

      this.socket?.emit(
        'doc:join',
        { projectId: this.projectId, docId: this.pageId },
        (res?: { success?: boolean; docPresence?: RemotePresencePayload[]; error?: string }) => {
          if (res?.success && Array.isArray(res.docPresence)) {
            this.handleInitialDocPresence(res.docPresence);
          }
          this.initiateYjsSync();
        },
      );
    });

    this.socket.on('disconnect', () => {
      if (this.destroyed) return;
      this.status = 'disconnected';
      this.emitStatus('disconnected');

      const remoteClientIds = Array.from(this.socketToClientIdMap.values());
      if (remoteClientIds.length > 0) {
        removeAwarenessStates(this.awareness, remoteClientIds, 'socket.io');
        this.socketToClientIdMap.clear();
      }
      this.collaboratorsMap.clear();
      this.options.onCollaboratorsChange?.([]);
    });

    this.socket.on('connect_error', () => {
      if (this.destroyed) return;
      if (this.status !== 'connecting') {
        this.status = 'connecting';
        this.emitStatus('connecting');
      }
    });

    this.socket.on('doc:sync:update', (payload: {
      projectId: string;
      docId: string;
      data: Uint8Array | ArrayLike<number>;
    }) => {
      if (this.destroyed || payload.projectId !== this.projectId || payload.docId !== this.pageId || !payload.data) {
        return;
      }
      try {
        this.applySyncFrame(payload.data, this.doc, true);
      } catch {
        try {
          const raw = payload.data instanceof Uint8Array ? payload.data : new Uint8Array(payload.data);
          Y.applyUpdate(this.doc, raw, 'socket.io');
        } catch (applyErr) {
          console.warn('[YjsSocketIOProvider] Error applying incoming sync:update:', applyErr);
        }
      }
    });

    this.socket.on('doc:sync:step2', (payload: {
      docId: string;
      data: Uint8Array | ArrayLike<number>;
    }) => {
      if (this.destroyed || payload.docId !== this.pageId || !payload.data) return;
      try {
        this.applySyncFrame(payload.data, this.doc, false);
      } catch (err) {
        console.warn('[YjsSocketIOProvider] Error applying incoming sync:step2:', err);
      }
    });

    this.socket.on('compile:progress', (data: CompileProgressPayload | string) => {
      if (this.destroyed) return;
      const status = typeof data === 'object' && data?.status ? data.status : 'compiling';
      const logs = typeof data === 'object' && data?.logs ? data.logs : typeof data === 'string' ? data : '';
      this.commandBus?.dispatch({
        type: 'compiler:progress',
        status,
        logs: Array.isArray(logs) ? logs : logs ? [logs] : [],
      });
    });

    this.socket.on('doc:cursor', (data: RemoteCursorPayload) => {
      if (this.destroyed) return;
      this.handleRemoteCursor(data);
    });

    this.socket.on('doc:user-joined', (data: RemoteUserJoinedPayload) => {
      if (this.destroyed || data.socketId === this.socket?.id) return;
      this.handleUserJoined(data);
    });

    this.socket.on('doc:user-left', (data: { userId?: string; socketId?: string }) => {
      if (this.destroyed) return;
      this.handleUserLeft(data);
    });

    this.socket.on('project:user-left', (data: { userId?: string; socketId?: string }) => {
      if (this.destroyed) return;
      this.handleUserLeft(data);
    });

    this.socket.on('fileTree:update', (data: Record<string, unknown>) => {
      if (this.destroyed) return;
      this.commandBus?.dispatch({ type: 'filetree:updated', payload: data });
    });

    this.socket.on('doc:content-updated', (data: DocContentUpdatedPayload) => {
      if (this.destroyed) return;
      if (data?.docId && typeof data?.content === 'string') {
        this.commandBus?.dispatch({
          type: 'document:content-updated',
          docId: data.docId,
          content: data.content,
        });
      }
    });

    const reviewEvents: Array<[string, 'suggestion:recorded' | 'suggestion:resolved' | 'comment:created' | 'comment:replied' | 'comment:resolved']> = [
      ['track-changes:recorded', 'suggestion:recorded'],
      ['track-changes:created', 'suggestion:recorded'],
      ['track-changes:resolved', 'suggestion:resolved'],
      ['comment:created', 'comment:created'],
      ['comment:replied', 'comment:replied'],
      ['comment:reply-added', 'comment:replied'],
      ['comment:reply-deleted', 'comment:replied'],
      ['comment:updated', 'comment:created'],
      ['comment:deleted', 'comment:resolved'],
      ['comment:resolved', 'comment:resolved'],
    ];
    for (const [socketEvent, reviewEvent] of reviewEvents) {
      this.socket.on(socketEvent, (data: Record<string, unknown> & { docId?: string }) => {
        if (this.destroyed) return;
        this.commandBus?.dispatch({
          type: 'editor:review-event',
          pageId: data?.docId || this.pageId,
          event: reviewEvent,
          payload: data,
        });
      });
    }

    this.socket.on('project:chat:new', (msg: ProjectChatMessage) => {
      if (this.destroyed || !msg) return;
      this.options.onChatMessage?.(msg);
      for (const listener of this.chatListeners) {
        try {
          listener(msg);
        } catch (err) {
          console.warn('[YjsSocketIOProvider] chat listener error:', err);
        }
      }
    });
  }

  private getIndexedText(): { text: string; lineStarts: number[] } {
    if (this.cachedText === null || this.cachedLineStarts === null) {
      this.cachedText = this.yText.toString();
      this.cachedLineStarts = buildLineStartsIndex(this.cachedText);
    }
    return { text: this.cachedText, lineStarts: this.cachedLineStarts };
  }

  private setupLocalDocListener(): void {
    const doc = this.doc;
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (doc !== this.doc) return;
      this.cachedText = null;
      this.cachedLineStarts = null;
      if (origin === 'socket.io' || this.destroyed) return;

      this.pendingUpdates.push(update);
      if (this.pendingUpdates.length > 256) {
        this.pendingUpdates = [Y.mergeUpdates(this.pendingUpdates)];
      }
      if (!this.socket || !this.socket.connected) return;
      if (this.updateBatchTimer) return;

      this.updateBatchTimer = setTimeout(() => {
        this.updateBatchTimer = null;
        this.flushPendingUpdates();
      }, 20);
    });
  }

  // ── HTTP-save-while-disconnected handling ──────────────────────────────────

  private httpSavedWhileDisconnected = false;
  private resyncInFlight = false;
  private readonly docReplacedListeners = new Set<(provider: YjsSocketIOProvider) => void>();

  public get needsServerRebuild(): boolean {
    return this.httpSavedWhileDisconnected;
  }

  /** Called after a successful REST save. Only flags when the realtime socket is down. */
  public markHttpSaved(): void {
    if (this.destroyed) return;
    if (!this.socket || !this.socket.connected) {
      this.httpSavedWhileDisconnected = true;
    }
  }

  /** Subscribe to doc/yText/awareness replacement (after a server rebuild). */
  public onDocReplaced(listener: (provider: YjsSocketIOProvider) => void): () => void {
    this.docReplacedListeners.add(listener);
    return () => {
      this.docReplacedListeners.delete(listener);
    };
  }

  private rebuildFromServer(): void {
    if (!this.socket || !this.socket.connected || this.destroyed || this.resyncInFlight) return;
    this.resyncInFlight = true;

    const freshDoc = new Y.Doc();
    const step1Data = encodeYjsSyncStep1(freshDoc);

    this.socket.emit(
      'doc:sync:step1',
      { projectId: this.projectId, docId: this.pageId, data: step1Data },
      (res?: { success?: boolean; data?: Uint8Array | ArrayLike<number> | unknown; error?: string }) => {
        this.resyncInFlight = false;
        if (this.destroyed) {
          freshDoc.destroy();
          return;
        }
        if (!res?.success) {
          console.warn('[YjsSocketIOProvider] Server rebuild failed; will retry on reconnect:', res?.error);
          freshDoc.destroy();
          return;
        }
        try {
          if (res.data) {
            this.applySyncFrame(res.data as Uint8Array | ArrayLike<number>, freshDoc, false);
          }
        } catch (err) {
          console.warn('[YjsSocketIOProvider] Error applying server state during rebuild:', err);
          freshDoc.destroy();
          return;
        }

        const oldDoc = this.doc;
        const oldAwareness = this.awareness;
        const localText = oldDoc.getText('latex').toString();

        this.pendingUpdates = [];
        if (this.updateBatchTimer) {
          clearTimeout(this.updateBatchTimer);
          this.updateBatchTimer = null;
        }
        this.doc = freshDoc;
        this.yText = freshDoc.getText('latex');
        this.cachedText = null;
        this.cachedLineStarts = null;
        this.awareness = new Awareness(freshDoc);
        this.socketToClientIdMap.clear();
        if (this.options.user) this.setLocalUser(this.options.user);
        this.setupLocalAwarenessListener();
        this.setupLocalDocListener();
        this.httpSavedWhileDisconnected = false;

        applyTextDiff(this.yText, localText, 'local-resync');
        this.flushPendingUpdates();

        this.isSynced = true;
        for (const listener of this.docReplacedListeners) {
          try {
            listener(this);
          } catch (err) {
            console.warn('[YjsSocketIOProvider] doc-replaced listener error:', err);
          }
        }
        this.options.onSynced?.();
        setTimeout(() => {
          oldAwareness.destroy();
          oldDoc.destroy();
        }, 0);
      },
    );
  }

  /**
   * Immediately flush all pending local Yjs updates into a single merged binary sync message.
   */
  public flushPendingUpdates(): boolean {
    if (this.updateBatchTimer) {
      clearTimeout(this.updateBatchTimer);
      this.updateBatchTimer = null;
    }
    if (
      this.destroyed ||
      this.httpSavedWhileDisconnected ||
      this.resyncInFlight ||
      !this.socket ||
      !this.socket.connected
    ) {
      return false;
    }
    if (this.pendingUpdates.length === 0) {
      return true;
    }

    const updatesToEmit = this.pendingUpdates;
    this.pendingUpdates = [];

    this.socket.emit('doc:sync:update', {
      projectId: this.projectId,
      docId: this.pageId,
      data: encodeMergedYjsUpdates(updatesToEmit),
    });
    return true;
  }

  private initiateYjsSync(): void {
    if (!this.socket || !this.socket.connected || this.destroyed) return;

    if (this.httpSavedWhileDisconnected) {
      this.rebuildFromServer();
      return;
    }

    const step1Payload = encodeYjsSyncStep1(this.doc);

    this.socket.emit(
      'doc:sync:step1',
      {
        projectId: this.projectId,
        docId: this.pageId,
        data: step1Payload,
      },
      (res?: { success?: boolean; data?: Uint8Array | ArrayLike<number> | unknown; error?: string }) => {
        if (this.destroyed) return;
        if (res?.success && res.data) {
          try {
            this.applySyncFrame(res.data as Uint8Array | ArrayLike<number>, this.doc, true);
          } catch (err) {
            console.warn('[YjsSocketIOProvider] Error processing sync:step2 from server:', err);
          }
        }
        if (this.yText.length === 0 && this.options.initialContent) {
          this.doc.transact(() => {
            this.yText.insert(0, this.options.initialContent!);
          }, 'local-init');
        }
        this.flushPendingUpdates();
        this.isSynced = true;
        this.options.onSynced?.();
      },
    );
  }

  private handleInitialDocPresence(docPresence: RemotePresencePayload[]): void {
    this.collaboratorsMap.clear();

    for (const p of docPresence) {
      if (!p || p.socketId === this.socket?.id) continue;

      const key = p.socketId || p.userId;
      this.collaboratorsMap.set(key, toCollaborationPresence(p));

      if (p.cursor) {
        this.handleRemoteCursor(p);
      }
    }

    this.options.onCollaboratorsChange?.(Array.from(this.collaboratorsMap.values()));
  }

  private handleRemoteCursor(data: RemoteCursorPayload): void {
    const { text, lineStarts } = this.getIndexedText();
    applyRemoteCursorAwareness({
      data,
      localSocketId: this.socket?.id,
      doc: this.doc,
      yText: this.yText,
      awareness: this.awareness,
      socketToClientIdMap: this.socketToClientIdMap,
      collaboratorsMap: this.collaboratorsMap,
      text,
      lineStarts,
      onCollaboratorsChange: this.options.onCollaboratorsChange,
    });
  }

  private handleUserJoined(data: RemoteUserJoinedPayload): void {
    const key = data.socketId || data.userId;
    const existing =
      this.collaboratorsMap.get(key) ||
      (data.socketId ? this.collaboratorsMap.get(data.userId) : undefined);
    if (data.socketId && existing && !this.collaboratorsMap.has(data.socketId)) {
      this.collaboratorsMap.delete(data.userId);
    }

    this.collaboratorsMap.set(key, toCollaborationPresence(data, existing));

    if (data.cursor) {
      this.handleRemoteCursor(data);
    }

    this.options.onCollaboratorsChange?.(Array.from(this.collaboratorsMap.values()));
  }

  private handleUserLeft(data: { userId?: string; socketId?: string }): void {
    removeRemoteCollaborator({
      data,
      awareness: this.awareness,
      socketToClientIdMap: this.socketToClientIdMap,
      collaboratorsMap: this.collaboratorsMap,
      onCollaboratorsChange: this.options.onCollaboratorsChange,
    });
  }

  private setupLocalAwarenessListener(): void {
    this.awareness.on(
      'change',
      ({ added, updated }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin === 'socket.io') return;
        if (
          added.includes(this.awareness.clientID) ||
          updated.includes(this.awareness.clientID)
        ) {
          this.scheduleEmitLocalCursor();
        }
      },
    );
  }

  private scheduleEmitLocalCursor(): void {
    if (this.destroyed) return;
    const { text, lineStarts } = this.getIndexedText();
    const extracted = extractLocalCursorCoords({
      awareness: this.awareness,
      doc: this.doc,
      yText: this.yText,
      text,
      lineStarts,
      lastEmittedCoords: this.lastEmittedCoords,
    });
    if (!extracted) return;
    this.lastEmittedCoords = extracted.nextLastEmittedCoords;
    this.sendCursor(extracted.headRow, extracted.headCol, extracted.selection);
  }

  /**
   * Explicitly broadcast cursor coordinates to other room collaborators.
   * Throttled to ~20Hz (50ms) to eliminate network saturation and Redis load.
   */
  public sendCursor(
    row: number,
    column: number,
    selection?: {
      anchor: { row: number; column: number };
      head: { row: number; column: number };
    } | null,
  ): void {
    if (!this.socket || !this.socket.connected || this.destroyed) return;

    const now = Date.now();
    const elapsed = now - this.lastCursorEmitTime;
    const payload = { row, column, selection: selection ?? null };

    if (elapsed >= 50) {
      if (this.cursorThrottleTimer) {
        clearTimeout(this.cursorThrottleTimer);
        this.cursorThrottleTimer = null;
      }
      this.lastCursorEmitTime = now;
      this.pendingCursorData = null;
      this.socket.emit('doc:cursor', {
        projectId: this.projectId,
        docId: this.pageId,
        cursor: payload,
      });
    } else {
      this.pendingCursorData = payload;
      if (!this.cursorThrottleTimer) {
        this.cursorThrottleTimer = setTimeout(() => {
          this.cursorThrottleTimer = null;
          if (this.destroyed || !this.socket || !this.socket.connected || !this.pendingCursorData) return;
          this.lastCursorEmitTime = Date.now();
          const toEmit = this.pendingCursorData;
          this.pendingCursorData = null;
          this.socket.emit('doc:cursor', {
            projectId: this.projectId,
            docId: this.pageId,
            cursor: toEmit,
          });
        }, 50 - elapsed);
      }
    }
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

  public triggerCheckpoint(): void {
    this.flushPendingUpdates();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.flushPendingUpdates();

    if (this.cursorThrottleTimer) {
      clearTimeout(this.cursorThrottleTimer);
      this.cursorThrottleTimer = null;
    }

    if (this.updateBatchTimer) {
      clearTimeout(this.updateBatchTimer);
      this.updateBatchTimer = null;
    }

    if (typeof window !== 'undefined' && this.handleOnline) {
      window.removeEventListener('online', this.handleOnline);
      this.handleOnline = null;
    }

    if (this.socket) {
      try {
        if (this.socket.connected) {
          this.socket.emit('doc:leave', {
            projectId: this.projectId,
            docId: this.pageId,
          });
          this.socket.emit('project:leave', {
            projectId: this.projectId,
          });
        }
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {
        // Socket cleanup error ignored on unmount
      }
      this.socket = null;
    }

    this.awareness.destroy();
    this.doc.destroy();
  }
}

export {
  getOrCreateYjsProvider,
  releaseYjsProvider,
  markHttpSavedWhileDisconnected,
  flushYjsProvider,
  flushYjsProviders,
  getActiveYjsProvider,
  updateActiveYjsDocContent,
  clearYjsProviderPool,
  subscribeYjsPoolCleared,
} from './yjs-provider-pool';
