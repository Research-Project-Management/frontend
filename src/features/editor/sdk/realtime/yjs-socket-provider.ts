/**
 * yjs-socket-provider.ts
 *
 * Real-Time Socket.IO & Yjs Collaboration Provider for Flux (Overleaf Parity).
 * Connects CodeMirror 6 (via y-codemirror.next) to Backend ManuscriptRealtimeGateway (/manuscripts)
 * backed by Redis horizontal room fan-out.
 *
 * Features:
 * - Handshake auth with JWT bearer token and user metadata (name, avatar, color).
 * - Automatic project & document room joins (project:join, doc:join).
 * - Bi-directional real-time cursor awareness (doc:cursor) with Yjs RelativePosition mapping.
 * - Active collaborator presence list synchronization (doc:user-joined, doc:user-left).
 * - Resilient auto-reconnect with polling fallback and smooth cleanup on unmount.
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
import { getEffectiveBaseUrl, getAuthToken } from '@/shared/lib/api';
import type { IEditorCommandBus } from '@/features/editor/core/bus/command-bus.port';
import type { CollaborationPresence } from '@/features/editor/sdk/manuscript.service';

export interface CollaboratorUser {
  id: string;
  name: string;
  avatar?: string | null;
  color?: string;
  role?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface CompileProgressPayload {
  status?: string;
  logs?: string | string[];
}

export interface DocContentUpdatedPayload {
  docId: string;
  content: string;
}

export interface RemoteCursorSelection {
  anchor: { row: number; column: number };
  head: { row: number; column: number };
}

export interface RemoteCursorData {
  row: number;
  column: number;
  selection?: RemoteCursorSelection | null;
}

export interface RemotePresencePayload {
  userId: string;
  socketId?: string;
  name?: string;
  avatar?: string | null;
  color?: string;
  role?: string;
  cursor?: RemoteCursorData | null;
  [key: string]: unknown;
}

export type RemoteCursorPayload = RemotePresencePayload;
export type RemoteUserJoinedPayload = RemotePresencePayload;

export interface ProjectChatMessage {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userColor?: string;
  userAvatar?: string;
  text: string;
  replyToId?: string;
  createdAt: string;
}

export interface YjsSocketIOProviderOptions {
  user?: CollaboratorUser;
  baseUrl?: string;
  token?: string;
  initialContent?: string;
  commandBus?: IEditorCommandBus;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSynced?: () => void;
  onCollaboratorsChange?: (collaborators: CollaborationPresence[]) => void;
  onChatMessage?: (message: ProjectChatMessage) => void;
}

/**
 * Maps a (row, column) coordinate (1-indexed) in text to an absolute character offset.
 */
export function getOffsetFromRowCol(text: string, row: number, column: number): number {
  if (!text || text.length === 0) return 0;
  const targetLine = Math.max(1, row);
  const targetCol = Math.max(1, column);

  let currentLine = 1;
  let lineStartOffset = 0;

  for (let i = 0; i < text.length; i++) {
    if (currentLine === targetLine) break;
    if (text[i] === '\n') {
      currentLine++;
      lineStartOffset = i + 1;
    }
  }

  // If target line exceeds document lines, clamp to end of document
  if (targetLine > currentLine) {
    return text.length;
  }

  let nextNewline = text.indexOf('\n', lineStartOffset);
  if (nextNewline === -1) nextNewline = text.length;
  const lineLength = nextNewline - lineStartOffset;

  const colOffset = Math.min(Math.max(0, targetCol - 1), lineLength);
  return Math.min(text.length, lineStartOffset + colOffset);
}

/**
 * Maps an absolute character offset in text to a (row, column) coordinate (1-indexed).
 */
export function getRowColFromOffset(text: string, offset: number): { row: number; col: number } {
  const safeOffset = Math.max(0, Math.min(text.length, offset));
  let row = 1;
  let lastLineStart = 0;

  for (let i = 0; i < safeOffset; i++) {
    if (text[i] === '\n') {
      row++;
      lastLineStart = i + 1;
    }
  }

  const col = safeOffset - lastLineStart + 1;
  return { row, col };
}

/**
 * Applies the minimal prefix/suffix splice that turns yText into 	arget, as one transaction.
 */
export function applyTextDiff(yText: Y.Text, target: string, origin: unknown = 'local'): boolean {
  const current = yText.toString();
  if (current === target) return false;
  let start = 0;
  const minLen = Math.min(current.length, target.length);
  while (start < minLen && current.charCodeAt(start) === target.charCodeAt(start)) start++;
  let endCur = current.length;
  let endTgt = target.length;
  while (endCur > start && endTgt > start && current.charCodeAt(endCur - 1) === target.charCodeAt(endTgt - 1)) {
    endCur--;
    endTgt--;
  }
  const doc = yText.doc;
  const apply = () => {
    if (endCur > start) yText.delete(start, endCur - start);
    if (endTgt > start) yText.insert(start, target.slice(start, endTgt));
  };
  if (doc) doc.transact(apply, origin);
  else apply();
  return true;
}

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
  private activeCollaborators: CollaborationPresence[] = [];
  private destroyed = false;
  public get isDestroyed(): boolean {
    return this.destroyed;
  }
  private cursorEmitDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmittedCoords: { row: number; col: number } | null = null;
  private pendingUpdates: Uint8Array[] = [];
  private updateBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCursorEmitTime = 0;
  private pendingCursorData: { row: number; column: number; selection?: RemoteCursorSelection | null } | null = null;
  private cursorThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private handleOnline: (() => void) | null = null;

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

  /** Subscribe to real-time project chat messages (project:chat:message). */
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
    const authPayload: Record<string, unknown> = {
      token,
      userId: user?.id,
      name: user?.name,
      avatar: user?.avatar,
      color: user?.color,
    };

    try {
      const fakeSocket = (globalThis as { __fluxFakeSocket?: Socket })
        .__fluxFakeSocket;
      this.socket = fakeSocket ?? io(socketUrl, {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        auth: authPayload,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      this.registerSocketEvents();

      // Setup browser online auto-reconnect listener to self-heal upon network recovery
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

  private registerSocketEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      if (this.destroyed) return;
      this.status = 'connected';
      this.emitStatus('connected');

      // 1. Join project room
      this.socket?.emit(
        'project:join',
        { projectId: this.projectId },
        (res?: { success?: boolean; projectPresence?: CollaborationPresence[]; error?: string }) => {
          if (res?.error) {
            console.debug('[YjsSocketIOProvider] project:join info:', res.error);
          }
        },
      );

      // 2. Join document editor room
      this.socket?.emit(
        'doc:join',
        { projectId: this.projectId, docId: this.pageId },
        (res?: { success?: boolean; docPresence?: RemotePresencePayload[]; error?: string }) => {
          if (res?.success && Array.isArray(res.docPresence)) {
            this.handleInitialDocPresence(res.docPresence);
          }
          // Initiate Binary CRDT Yjs Handshake with server
          this.initiateYjsSync();
        },
      );
    });

    this.socket.on('disconnect', () => {
      if (this.destroyed) return;
      this.status = 'disconnected';
      this.emitStatus('disconnected');

      // Clear remote awareness states
      const remoteClientIds = Array.from(this.socketToClientIdMap.values());
      if (remoteClientIds.length > 0) {
        removeAwarenessStates(this.awareness, remoteClientIds, 'socket.io');
        this.socketToClientIdMap.clear();
      }
      this.activeCollaborators = [];
      this.options.onCollaboratorsChange?.([]);
    });

    this.socket.on('connect_error', () => {
      if (this.destroyed) return;
      if (this.status !== 'connecting') {
        this.status = 'connecting';
        this.emitStatus('connecting');
      }
    });

    // Binary Yjs sync-update from server / remote collaborators
    this.socket.on('doc:sync-update', (payload: { projectId: string; docId: string; data: Uint8Array | ArrayLike<number> }) => {
      if (this.destroyed) return;
      if (payload.projectId !== this.projectId || payload.docId !== this.pageId) return;
      if (!payload.data) return;

      try {
        const rawData =
          payload.data instanceof Uint8Array
            ? payload.data
            : new Uint8Array(payload.data);

        const decoder = decoding.createDecoder(rawData);
        const replyEncoder = encoding.createEncoder();
        while (decoding.hasContent(decoder)) {
          syncProtocol.readSyncMessage(decoder, replyEncoder, this.doc, 'socket.io');
        }
        if (encoding.length(replyEncoder) > 0) {
          this.socket?.emit('doc:sync-step-2', {
            projectId: this.projectId,
            docId: this.pageId,
            data: encoding.toUint8Array(replyEncoder),
          });
        }
      } catch (err) {
        try {
          const raw = payload.data instanceof Uint8Array ? payload.data : new Uint8Array(payload.data);
          Y.applyUpdate(this.doc, raw, 'socket.io');
        } catch (applyErr) {
          console.warn('[YjsSocketIOProvider] Error applying incoming sync-update:', applyErr);
        }
      }
    });

    // Real-time LaTeX compilation streaming
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

    // Remote cursor update from peer
    this.socket.on('doc:cursor', (data: RemoteCursorPayload) => {
      if (this.destroyed) return;
      this.handleRemoteCursor(data);
    });

    // Collaborator joined document room
    this.socket.on('doc:user-joined', (data: RemoteUserJoinedPayload) => {
      if (this.destroyed) return;
      if (data.socketId === this.socket?.id) return;
      this.handleUserJoined(data);
    });

    // Collaborator left document room
    this.socket.on('doc:user-left', (data: { userId?: string; socketId?: string }) => {
      if (this.destroyed) return;
      this.handleUserLeft(data);
    });

    // Project-level user left
    this.socket.on('project:user-left', (data: { userId?: string; socketId?: string }) => {
      if (this.destroyed) return;
      this.handleUserLeft(data);
    });

    // Real-time project file-tree mutation (create, rename, move, delete)
    this.socket.on('fileTree:update', (data: Record<string, unknown>) => {
      if (this.destroyed) return;
      this.commandBus?.dispatch({ type: 'filetree:updated', payload: data });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated', { detail: data }));
      }
    });

    // Real-time document content update from collaborator
    this.socket.on('doc:content-updated', (data: DocContentUpdatedPayload) => {
      if (this.destroyed) return;
      if (data?.docId && typeof data?.content === 'string') {
        this.commandBus?.dispatch({
          type: 'document:content-updated',
          docId: data.docId,
          content: data.content,
        });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:doc-content-updated', { detail: data }));
      }
    });

    // Real-time Track Changes & Review broadcasts
    this.socket.on('track-changes:recorded', (data: Record<string, unknown> & { docId?: string }) => {
      if (this.destroyed) return;
      const docId = data?.docId || this.pageId;
      this.commandBus?.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event: 'suggestion:recorded',
        payload: data,
      });
    });

    this.socket.on('track-changes:resolved', (data: Record<string, unknown> & { docId?: string }) => {
      if (this.destroyed) return;
      const docId = data?.docId || this.pageId;
      this.commandBus?.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event: 'suggestion:resolved',
        payload: data,
      });
    });

    this.socket.on('comment:created', (data: Record<string, unknown> & { docId?: string }) => {
      if (this.destroyed) return;
      const docId = data?.docId || this.pageId;
      this.commandBus?.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event: 'comment:created',
        payload: data,
      });
    });

    this.socket.on('comment:replied', (data: Record<string, unknown> & { docId?: string }) => {
      if (this.destroyed) return;
      const docId = data?.docId || this.pageId;
      this.commandBus?.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event: 'comment:replied',
        payload: data,
      });
    });

    this.socket.on('comment:resolved', (data: Record<string, unknown> & { docId?: string }) => {
      if (this.destroyed) return;
      const docId = data?.docId || this.pageId;
      this.commandBus?.dispatch({
        type: 'editor:review-event',
        pageId: docId,
        event: 'comment:resolved',
        payload: data,
      });
    });

    this.socket.on('project:chat:message', (msg: ProjectChatMessage) => {
      if (this.destroyed || !msg) return;
      this.options.onChatMessage?.(msg);
      for (const listener of this.chatListeners) {
        try {
          listener(msg);
        } catch (err) {
          console.warn('[YjsSocketIOProvider] chat listener error:', err);
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:project-chat-message', { detail: msg }));
      }
    });
  }

  private setupLocalDocListener(): void {
    const doc = this.doc;
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Ignore updates from a replaced (stale) doc: they must never reach the server.
      if (doc !== this.doc) return;
      if (origin === 'socket.io' || this.destroyed) return;

      // Always queue local updates. When the socket is disconnected they are retained
      // (never dropped) and flushed after reconnect + sync handshake.
      this.pendingUpdates.push(update);
      if (this.pendingUpdates.length > 256) {
        // Compact to bound memory during long offline sessions.
        this.pendingUpdates = [Y.mergeUpdates(this.pendingUpdates)];
      }
      if (!this.socket || !this.socket.connected) return;
      if (this.updateBatchTimer) return;

      // 20ms micro-batch window: merges rapid keystrokes/plugins/multi-cursors into 1 network frame
      this.updateBatchTimer = setTimeout(() => {
        this.updateBatchTimer = null;
        this.flushPendingUpdates();
      }, 20);
    });
  }

  // ── HTTP-save-while-disconnected handling ──────────────────────────────────

  /**
   * True when the document content was persisted over HTTP (REST PUT) while the socket was
   * disconnected. The backend splices REST content into the live server Y.Doc, so on reconnect
   * our offline Yjs items must NOT be sent (they would duplicate text). Instead the local doc
   * is rebuilt from server state and any remaining difference is re-applied as a fresh edit.
   */
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

  /**
   * Discards local Y.Doc state and rebuilds from the server, then re-applies the local text
   * difference as a single new transaction. Nothing is lost, nothing is duplicated.
   */
  private rebuildFromServer(): void {
    if (!this.socket || !this.socket.connected || this.destroyed || this.resyncInFlight) return;
    this.resyncInFlight = true;

    const freshDoc = new Y.Doc();
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, freshDoc); // empty state vector => full server state

    this.socket.emit(
      'doc:sync-step-1',
      { projectId: this.projectId, docId: this.pageId, data: encoding.toUint8Array(encoder) },
      (res?: { success?: boolean; data?: Uint8Array | ArrayLike<number> | unknown; error?: string }) => {
        this.resyncInFlight = false;
        if (this.destroyed) {
          freshDoc.destroy();
          return;
        }
        if (!res?.success) {
          // Keep the flag; retry on next reconnect. Never fall back to sending stale items.
          console.warn('[YjsSocketIOProvider] Server rebuild failed; will retry on reconnect:', res?.error);
          freshDoc.destroy();
          return;
        }
        try {
          if (res.data) {
            const rawData = res.data instanceof Uint8Array ? res.data : new Uint8Array(res.data as ArrayLike<number>);
            const decoder = decoding.createDecoder(rawData);
            const sink = encoding.createEncoder();
            while (decoding.hasContent(decoder)) {
              syncProtocol.readSyncMessage(decoder, sink, freshDoc, 'socket.io');
            }
          }
        } catch (err) {
          console.warn('[YjsSocketIOProvider] Error applying server state during rebuild:', err);
          freshDoc.destroy();
          return;
        }

        const oldDoc = this.doc;
        const oldAwareness = this.awareness;
        // Latest local text (includes edits typed while the rebuild was in flight).
        const localText = oldDoc.getText('latex').toString();

        // Swap in the fresh doc; drop every queued update belonging to the old doc.
        this.pendingUpdates = [];
        if (this.updateBatchTimer) {
          clearTimeout(this.updateBatchTimer);
          this.updateBatchTimer = null;
        }
        this.doc = freshDoc;
        this.yText = freshDoc.getText('latex');
        this.awareness = new Awareness(freshDoc);
        this.socketToClientIdMap.clear();
        if (this.options.user) this.setLocalUser(this.options.user);
        this.setupLocalAwarenessListener();
        this.setupLocalDocListener();
        this.httpSavedWhileDisconnected = false;

        // Re-apply any remaining local difference as a new local transaction.
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
        // Destroy stale instances after bindings had a chance to reconfigure.
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
  public flushPendingUpdates(): void {
    if (this.updateBatchTimer) {
      clearTimeout(this.updateBatchTimer);
      this.updateBatchTimer = null;
    }
    if (
      this.destroyed ||
      this.httpSavedWhileDisconnected ||
      this.resyncInFlight ||
      !this.socket ||
      !this.socket.connected ||
      this.pendingUpdates.length === 0
    ) {
      return;
    }

    const updatesToEmit = this.pendingUpdates;
    this.pendingUpdates = [];

    const mergedUpdate = updatesToEmit.length === 1 ? updatesToEmit[0] : Y.mergeUpdates(updatesToEmit);
    const encoder = encoding.createEncoder();
    syncProtocol.writeUpdate(encoder, mergedUpdate);
    const syncMessage = encoding.toUint8Array(encoder);

    this.socket.emit('doc:sync-update', {
      projectId: this.projectId,
      docId: this.pageId,
      data: syncMessage,
    });
  }

  private initiateYjsSync(): void {
    if (!this.socket || !this.socket.connected || this.destroyed) return;

    if (this.httpSavedWhileDisconnected) {
      // Server already has our text via the REST splice: never send local items/state.
      this.rebuildFromServer();
      return;
    }

    // Send binary sync-step-1 with local state vector
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    const step1Payload = encoding.toUint8Array(encoder);

    this.socket.emit(
      'doc:sync-step-1',
      {
        projectId: this.projectId,
        docId: this.pageId,
        data: step1Payload,
      },
      (res?: { success?: boolean; data?: Uint8Array | ArrayLike<number> | unknown; error?: string }) => {
        if (this.destroyed) return;
        if (res?.success && res.data) {
          try {
            const rawData =
              res.data instanceof Uint8Array
                ? res.data
                : new Uint8Array(res.data as ArrayLike<number>);
            const decoder = decoding.createDecoder(rawData);
            const replyEncoder = encoding.createEncoder();
            while (decoding.hasContent(decoder)) {
              syncProtocol.readSyncMessage(decoder, replyEncoder, this.doc, 'socket.io');
            }
            if (encoding.length(replyEncoder) > 0) {
              this.socket?.emit('doc:sync-step-2', {
                projectId: this.projectId,
                docId: this.pageId,
                data: encoding.toUint8Array(replyEncoder),
              });
            }
          } catch (err) {
            console.warn('[YjsSocketIOProvider] Error processing sync-step-2 from server:', err);
          }
        }
        if (this.yText.length === 0 && this.options.initialContent) {
          this.doc.transact(() => {
            this.yText.insert(0, this.options.initialContent!);
          }, 'local-init');
        }
        // Flush any local updates queued while disconnected (Yjs updates are idempotent).
        this.flushPendingUpdates();
        this.isSynced = true;
        this.options.onSynced?.();
      },
    );
  }

  private handleInitialDocPresence(docPresence: RemotePresencePayload[]): void {
    const remoteList: CollaborationPresence[] = [];

    for (const p of docPresence) {
      if (!p || p.socketId === this.socket?.id) continue;

      const presence: CollaborationPresence = {
        id: p.userId,
        userId: p.userId,
        socketId: p.socketId,
        name: p.name || 'Collaborator',
        avatar: p.avatar,
        color: p.color || '#3b82f6',
        role: p.role,
        cursor: p.cursor
          ? {
              line: p.cursor.row,
              column: p.cursor.column,
              selection: p.cursor.selection
                ? {
                    startLineNumber: p.cursor.selection.anchor.row,
                    startColumn: p.cursor.selection.anchor.column,
                    endLineNumber: p.cursor.selection.head.row,
                    endColumn: p.cursor.selection.head.column,
                  }
                : undefined,
            }
          : undefined,
        lastActiveAt: Date.now(),
      };
      remoteList.push(presence);

      if (p.cursor) {
        this.handleRemoteCursor(p);
      }
    }

    this.activeCollaborators = remoteList;
    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private handleRemoteCursor(data: RemoteCursorPayload): void {
    if (!data || !data.cursor) return;
    if (data.socketId && data.socketId === this.socket?.id) return;

    const clientId = this.getOrCreateClientId(data.socketId || data.userId);
    const text = this.yText.toString();

    const anchorRow = data.cursor.selection?.anchor?.row ?? data.cursor.row;
    const anchorCol = data.cursor.selection?.anchor?.column ?? data.cursor.column;
    const headRow = data.cursor.selection?.head?.row ?? data.cursor.row;
    const headCol = data.cursor.selection?.head?.column ?? data.cursor.column;

    const anchorOffset = getOffsetFromRowCol(text, anchorRow, anchorCol);
    const headOffset = getOffsetFromRowCol(text, headRow, headCol);

    const anchor = Y.createRelativePositionFromTypeIndex(this.yText, anchorOffset);
    const head = Y.createRelativePositionFromTypeIndex(this.yText, headOffset);

    const isNew = !this.awareness.states.has(clientId);
    this.awareness.states.set(clientId, {
      user: {
        id: data.userId,
        name: data.name || 'Collaborator',
        color: data.color || '#3b82f6',
        avatar: data.avatar,
      },
      cursor: { anchor, head },
    });

    const currentClock = this.awareness.meta.get(clientId)?.clock || 0;
    this.awareness.meta.set(clientId, {
      clock: currentClock + 1,
      lastUpdated: Date.now(),
    });

    this.awareness.emit('change', [
      {
        added: isNew ? [clientId] : [],
        updated: isNew ? [] : [clientId],
        removed: [],
      },
      'socket.io',
    ]);

    this.updateCollaboratorCursor(data);
  }

  private handleUserJoined(data: RemoteUserJoinedPayload): void {
    const idx = this.activeCollaborators.findIndex(
      (c) => c.userId === data.userId || (data.socketId && c.socketId === data.socketId),
    );

    const newUser: CollaborationPresence = {
      id: data.userId,
      userId: data.userId,
      socketId: data.socketId,
      name: data.name || 'Collaborator',
      avatar: data.avatar,
      color: data.color || '#3b82f6',
      role: data.role,
      cursor: data.cursor
        ? {
            line: data.cursor.row,
            column: data.cursor.column,
          }
        : undefined,
      lastActiveAt: Date.now(),
    };

    if (idx >= 0) {
      this.activeCollaborators[idx] = { ...this.activeCollaborators[idx], ...newUser };
    } else {
      this.activeCollaborators.push(newUser);
    }

    if (data.cursor) {
      this.handleRemoteCursor(data);
    }

    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private handleUserLeft(data: { userId?: string; socketId?: string }): void {
    this.activeCollaborators = this.activeCollaborators.filter((c) => {
      if (data.userId && (c.userId === data.userId || c.id === data.userId)) {
        return false;
      }
      if (data.socketId && c.socketId === data.socketId) {
        return false;
      }
      return true;
    });

    const targetKey = data.socketId || data.userId;
    if (targetKey) {
      const clientId = this.socketToClientIdMap.get(targetKey);
      if (clientId) {
        removeAwarenessStates(this.awareness, [clientId], 'socket.io');
        this.socketToClientIdMap.delete(targetKey);
      }
    }

    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private updateCollaboratorCursor(data: RemoteCursorPayload): void {
    if (!data.cursor) return;
    const idx = this.activeCollaborators.findIndex(
      (c) => c.userId === data.userId || (data.socketId && c.socketId === data.socketId),
    );

    const updatedUser: CollaborationPresence = {
      id: data.userId,
      userId: data.userId,
      socketId: data.socketId,
      name: data.name || 'Collaborator',
      color: data.color || '#3b82f6',
      avatar: data.avatar,
      cursor: {
        line: data.cursor.row,
        column: data.cursor.column,
        selection: data.cursor.selection
          ? {
              startLineNumber: data.cursor.selection.anchor.row,
              startColumn: data.cursor.selection.anchor.column,
              endLineNumber: data.cursor.selection.head.row,
              endColumn: data.cursor.selection.head.column,
            }
          : undefined,
      },
      lastActiveAt: Date.now(),
    };

    if (idx >= 0) {
      this.activeCollaborators[idx] = {
        ...this.activeCollaborators[idx],
        ...updatedUser,
      };
    } else {
      this.activeCollaborators.push(updatedUser);
    }

    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private getOrCreateClientId(key: string): number {
    let clientId = this.socketToClientIdMap.get(key);
    if (clientId !== undefined) return clientId;

    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash) + key.charCodeAt(i);
      hash |= 0;
    }
    clientId = Math.abs(hash);
    if (clientId === this.doc.clientID || clientId === 0) {
      clientId = this.doc.clientID + 1000 + (Math.abs(hash) % 10000);
    }
    this.socketToClientIdMap.set(key, clientId);
    return clientId;
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
    });
  }

  private scheduleEmitLocalCursor(): void {
    if (this.cursorEmitDebounceTimer) return;
    this.cursorEmitDebounceTimer = setTimeout(() => {
      this.cursorEmitDebounceTimer = null;
      if (this.destroyed) return;

      const localState = this.awareness.getLocalState();
      if (!localState || !localState.cursor) return;
      const { anchor, head } = localState.cursor;
      if (!anchor || !head) return;

      const anchorAbs = Y.createAbsolutePositionFromRelativePosition(anchor, this.doc);
      const headAbs = Y.createAbsolutePositionFromRelativePosition(head, this.doc);
      if (!anchorAbs || !headAbs || anchorAbs.type !== this.yText || headAbs.type !== this.yText) {
        return;
      }

      const text = this.yText.toString();
      const anchorPos = getRowColFromOffset(text, anchorAbs.index);
      const headPos = getRowColFromOffset(text, headAbs.index);

      // Avoid re-emitting identical position
      if (
        this.lastEmittedCoords &&
        this.lastEmittedCoords.row === headPos.row &&
        this.lastEmittedCoords.col === headPos.col &&
        anchorAbs.index === headAbs.index
      ) {
        return;
      }
      this.lastEmittedCoords = { row: headPos.row, col: headPos.col };

      const isPoint = anchorAbs.index === headAbs.index;
      this.sendCursor(
        headPos.row,
        headPos.col,
        isPoint
          ? null
          : {
              anchor: { row: anchorPos.row, column: anchorPos.col },
              head: { row: headPos.row, column: headPos.col },
            },
      );
    }, 40);
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

    if (this.cursorEmitDebounceTimer) {
      clearTimeout(this.cursorEmitDebounceTimer);
      this.cursorEmitDebounceTimer = null;
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

// ── Provider Pool (Multi-Tab Resilient Singleton Management) ────────────────
const providerPool = new Map<string, { provider: YjsSocketIOProvider; refCount: number }>();

export function getOrCreateYjsProvider(
  projectId: string,
  pageId: string,
  options?: YjsSocketIOProviderOptions
): YjsSocketIOProvider {
  const key = `${projectId}:${pageId}`;
  const existing = providerPool.get(key);
  if (existing && !existing.provider.isDestroyed) {
    if (options?.commandBus) {
      existing.provider.setCommandBus(options.commandBus);
    }
    existing.refCount++;
    return existing.provider;
  }
  const provider = new YjsSocketIOProvider(projectId, pageId, undefined, options);
  providerPool.set(key, { provider, refCount: 1 });
  return provider;
}

export function releaseYjsProvider(projectId: string, pageId: string): void {
  const key = `${projectId}:${pageId}`;
  const item = providerPool.get(key);
  if (!item) return;
  item.refCount--;
  if (item.refCount <= 0) {
    item.provider.destroy();
    providerPool.delete(key);
  }
}

/**
 * Notifies every pooled provider for pageId that its content was just persisted over REST.
 * Providers whose socket is disconnected will rebuild from the server on reconnect instead of
 * replaying offline Yjs items (the backend already spliced the REST content into the live doc).
 */
export function markHttpSavedWhileDisconnected(pageId: string): void {
  for (const { provider } of providerPool.values()) {
    if (provider.pageId === pageId) provider.markHttpSaved();
  }
}

/**
 * Destroys all pooled providers and clears the pool.
 * Useful for test isolation and resetting collaboration state.
 */
export function clearYjsProviderPool(): void {
  for (const item of providerPool.values()) {
    item.provider.destroy();
  }
  providerPool.clear();
}