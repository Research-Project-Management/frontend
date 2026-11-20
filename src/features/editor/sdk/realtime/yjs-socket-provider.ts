/**
 * yjs-socket-provider.ts
 *
 * Real-Time Socket.IO & Yjs Collaboration Provider for Flux (Overleaf Parity).
 * Connects CodeMirror 6 (via y-codemirror.next) to Backend PagesGateway (/pages)
 * backed by Redis horizontal room fan-out.
 */

import * as Y from 'yjs';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import { type Socket } from 'socket.io-client';
import type { IEditorCommandBus } from '@/features/editor/core/bus/command-bus.port';
import { getAuthorColor } from '@/features/editor/domain/collaboration/author-display';
import type { CollaborationPresence } from '../pages/types';
import {
  type YjsCrossTabBridge,
  type CrossTabProviderRole,
} from './yjs-cross-tab-bridge';
import {
  buildLineStartsIndex,
  getOffsetFromRowCol,
  getRowColFromOffset,
  applyTextDiff,
  applyBinarySyncFrame,
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
import {
  createCrossTabBridgeForProvider,
  createRealtimeSocketInstance,
  dispatchInboundServerEventHelper,
  emitProjectChatSend,
  emitSocketDisconnectAndLeave,
  fetchProjectChatHistory,
  registerProviderSocketListeners,
  resolveCrossTabTransportConfig,
} from './yjs-inbound-events';
import {
  emitMergedUpdatesBatch,
  executeInitiateYjsSync,
  executeRebuildFromServer,
  swapDocAndAwarenessAfterRebuild,
  type ServerRebuildContext,
} from './yjs-server-rebuild';
import {
  CursorBroadcastThrottler,
  extractNextLocalCursor,
  handleInitialDocPresenceHelper,
  handleRemoteCursorHelper,
  handleUserJoinedHelper,
  handleUserLeftHelper,
  type CursorPresenceHost,
} from './yjs-cursor-presence';

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
  public readonly spaceId: string;
  public readonly pageId: string;

  public status: ConnectionStatus = 'connecting';
  public isSynced: boolean = false;

  private socket: Socket | null = null;
  private options: YjsSocketIOProviderOptions;
  private commandBus?: IEditorCommandBus;
  private socketToClientIdMap = new Map<string, number>();
  private collaboratorsMap = new Map<string, CollaborationPresence>();
  private destroyed = false;
  private lastEmittedCoords: { row: number; col: number } | null = null;
  private pendingUpdates: Uint8Array[] = [];
  private updateBatchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly cursorThrottler = new CursorBroadcastThrottler();
  private handleOnline: (() => void) | null = null;
  private cachedText: string | null = null;
  private cachedLineStarts: number[] | null = null;
  private isEvicted = false;
  private crossTabBridge: YjsCrossTabBridge | null = null;
  private _role: CrossTabProviderRole = 'standalone';

  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private syncedListeners = new Set<() => void>();
  private chatListeners = new Set<(message: ProjectChatMessage) => void>();
  private localDocUpdateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;
  private httpSavedWhileDisconnected = false;
  private resyncInFlight = false;
  private readonly docReplacedListeners = new Set<(provider: YjsSocketIOProvider) => void>();

  public get isDestroyed(): boolean {
    return this.destroyed;
  }

  public get role(): CrossTabProviderRole {
    return this._role;
  }

  public get pendingUpdateCount(): number {
    return this.pendingUpdates.length;
  }

  public get needsServerRebuild(): boolean {
    return this.httpSavedWhileDisconnected;
  }

  private isChatOnlyRoom(): boolean {
    return this.pageId.startsWith('chat:');
  }

  constructor(
    spaceId: string,
    pageId: string,
    doc?: Y.Doc,
    options: YjsSocketIOProviderOptions = {},
  ) {
    this.spaceId = spaceId;
    this.pageId = pageId;
    this.doc = doc || new Y.Doc();
    this.yText = this.doc.getText('latex');
    this.awareness = new Awareness(this.doc);
    this.options = options;
    this.commandBus = options.commandBus;

    if (options.user) this.setLocalUser(options.user);
    this.setupLocalAwarenessListener();
    this.setupLocalDocListener();

    const { canBroadcast, resolvedLocks, useMultiplexing } = resolveCrossTabTransportConfig(
      options,
      this.isChatOnlyRoom(),
    );

    if (typeof window !== 'undefined' && spaceId && pageId) {
      if (canBroadcast) {
        if (useMultiplexing) this._role = 'follower';
        this.crossTabBridge = createCrossTabBridgeForProvider({
          spaceId,
          pageId,
          options,
          locksApi: resolvedLocks,
          enableMultiplexing: useMultiplexing,
          isDestroyed: () => this.destroyed,
          getDoc: () => this.doc,
          getRole: () => this._role,
          setRole: (role) => {
            this._role = role;
          },
          getStatus: () => this.status,
          setStatus: (s) => {
            this.status = s;
          },
          getIsSynced: () => this.isSynced,
          setIsSynced: (s) => {
            this.isSynced = s;
          },
          getSocket: () => this.socket,
          connect: () => this.connect(),
          queueLeaderUpdate: (update) => this.queueLeaderUpdate(update),
          flushPendingUpdates: () => this.flushPendingUpdates(),
          broadcastLeaderPresence: () => this.broadcastLeaderPresence(),
          clearPendingUpdates: () => {
            this.pendingUpdates = [];
          },
          collaboratorsMap: this.collaboratorsMap,
          emitStatus: (s) => this.emitStatus(s),
          emitSynced: () => this.emitSynced(),
          dispatchInboundServerEvent: (ev, payload) => this.dispatchInboundServerEvent(ev, payload),
        });
      } else {
        this.connect();
      }
    } else {
      this.status = 'connected';
      this.isSynced = true;
      this.emitStatus('connected');
      options.onSynced?.();
    }
  }

  private queueLeaderUpdate(update: Uint8Array): void {
    this.pendingUpdates.push(update);
    if (this.pendingUpdates.length > 256) {
      this.pendingUpdates = [Y.mergeUpdates(this.pendingUpdates)];
    }
    if (this.socket?.connected && !this.updateBatchTimer) {
      this.updateBatchTimer = setTimeout(() => {
        this.updateBatchTimer = null;
        this.flushPendingUpdates();
      }, 20);
    }
  }

  private broadcastLeaderPresence(): void {
    if (this._role === 'leader') {
      this.crossTabBridge?.broadcastLeaderStatus(
        this.status,
        this.isSynced,
        Array.from(this.collaboratorsMap.values()),
      );
    }
  }

  public subscribeStatus(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public subscribeSynced(listener: () => void): () => void {
    this.syncedListeners.add(listener);
    return () => {
      this.syncedListeners.delete(listener);
    };
  }

  public setInitialContent(content?: string): void {
    if (!content) return;
    this.options.initialContent = content;
    if (this.isSynced && this.yText.length === 0) {
      this.doc.transact(() => {
        this.yText.insert(0, content);
      }, 'local-init');
    }
  }

  private emitSynced(): void {
    this.options.onSynced?.();
    for (const listener of this.syncedListeners) {
      try {
        listener();
      } catch (err) {
        console.warn('[YjsSocketIOProvider] synced listener error:', err);
      }
    }
    this.broadcastLeaderPresence();
  }

  public subscribeChatMessages(listener: (message: ProjectChatMessage) => void): () => void {
    this.chatListeners.add(listener);
    return () => {
      this.chatListeners.delete(listener);
    };
  }

  public sendChatMessage(text: string, replyToId?: string): Promise<ProjectChatMessage | null> {
    return emitProjectChatSend(this.socket, this.destroyed, this.spaceId, text, replyToId);
  }

  public getChatHistory(): Promise<ProjectChatMessage[]> {
    return fetchProjectChatHistory(this.socket, this.destroyed, this.spaceId);
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
    this.broadcastLeaderPresence();
  }

  public setCommandBus(bus: IEditorCommandBus): void {
    this.commandBus = bus;
  }

  private connect(): void {
    try {
      this.socket = createRealtimeSocketInstance(this.options);
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
    applyBinarySyncFrame(data, targetDoc, this.socket, this.spaceId, this.pageId, emitStep2Reply);
  }

  private registerSocketEvents(): void {
    if (!this.socket) return;
    registerProviderSocketListeners(this.socket, {
      spaceId: this.spaceId,
      pageId: this.pageId,
      isDestroyed: () => this.destroyed,
      isChatOnlyRoom: () => this.isChatOnlyRoom(),
      isEvicted: () => this.isEvicted,
      onConnected: () => {
        this.status = 'connected';
        this.emitStatus('connected');
      },
      onChatOnlyConnected: () => {
        this.isSynced = true;
        this.emitSynced();
      },
      onInitialDocPresence: (docPresence) => this.handleInitialDocPresence(docPresence),
      onInitiateYjsSync: () => this.initiateYjsSync(),
      onDisconnect: () => {
        this.status = 'disconnected';
        const remoteClientIds = Array.from(this.socketToClientIdMap.values());
        if (remoteClientIds.length > 0) {
          removeAwarenessStates(this.awareness, remoteClientIds, 'socket.io');
          this.socketToClientIdMap.clear();
        }
        this.collaboratorsMap.clear();
        this.options.onCollaboratorsChange?.([]);
        this.emitStatus('disconnected');
      },
      onConnectError: () => {
        if (this.status !== 'connecting') {
          this.status = 'connecting';
          this.emitStatus('connecting');
        }
      },
      onSyncUpdate: (payload) => {
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
      },
      onSyncStep2: (payload) => {
        try {
          this.applySyncFrame(payload.data, this.doc, false);
        } catch (err) {
          console.warn('[YjsSocketIOProvider] Error applying incoming sync:step2:', err);
        }
      },
      onRemoteCursor: (data) => this.handleRemoteCursor(data),
      onUserJoined: (data) => this.handleUserJoined(data),
      onUserLeft: (data) => this.handleUserLeft(data),
      onRelayableEvent: (eventName, data) => {
        this.dispatchInboundServerEvent(eventName, data);
        if (this._role === 'leader') {
          this.crossTabBridge?.broadcastRemoteEvent(eventName, data);
        }
      },
    });
  }

  private dispatchInboundServerEvent(eventName: string, rawData: unknown): void {
    dispatchInboundServerEventHelper(
      {
        pageId: this.pageId,
        isDestroyed: () => this.destroyed,
        getCommandBus: () => this.commandBus,
        getChatListeners: () => this.chatListeners,
        onChatMessage: this.options.onChatMessage,
        onDocEvicted: () => {
          this.isEvicted = true;
          this.pendingUpdates = [];
          if (this.updateBatchTimer) {
            clearTimeout(this.updateBatchTimer);
            this.updateBatchTimer = null;
          }
          this.isSynced = false;
          this.status = 'disconnected';
          this.emitStatus('disconnected');
          this.options.onEvicted?.(this.pageId);
        },
      },
      eventName,
      rawData,
    );
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
    if (this.localDocUpdateHandler) doc.off('update', this.localDocUpdateHandler);
    this.localDocUpdateHandler = (update: Uint8Array, origin: unknown) => {
      if (doc !== this.doc) return;
      this.cachedText = null;
      this.cachedLineStarts = null;
      if (origin === 'local-init' || origin === 'broadcast-channel' || this.destroyed) return;
      if (origin === 'socket.io') {
        this.crossTabBridge?.broadcastDocUpdate(update, true);
        return;
      }

      this.crossTabBridge?.broadcastDocUpdate(update, false);
      this.pendingUpdates.push(update);
      if (this.pendingUpdates.length > 256) {
        this.pendingUpdates = [Y.mergeUpdates(this.pendingUpdates)];
      }
      if (this._role === 'follower' || !this.socket?.connected || this.updateBatchTimer) return;

      this.updateBatchTimer = setTimeout(() => {
        this.updateBatchTimer = null;
        this.flushPendingUpdates();
      }, 20);
    };
    doc.on('update', this.localDocUpdateHandler);
  }

  public markHttpSaved(): void {
    if (this.destroyed) return;
    if (!this.socket || !this.socket.connected) {
      this.httpSavedWhileDisconnected = true;
    }
  }

  public onDocReplaced(listener: (provider: YjsSocketIOProvider) => void): () => void {
    this.docReplacedListeners.add(listener);
    return () => {
      this.docReplacedListeners.delete(listener);
    };
  }

  private getServerRebuildContext(): ServerRebuildContext {
    return {
      spaceId: this.spaceId,
      pageId: this.pageId,
      getSocket: () => this.socket,
      isDestroyed: () => this.destroyed,
      isResyncInFlight: () => this.resyncInFlight,
      setResyncInFlight: (inFlight) => {
        this.resyncInFlight = inFlight;
      },
      getDoc: () => this.doc,
      getYText: () => this.yText,
      getInitialContent: () => this.options.initialContent,
      applySyncFrame: (data, targetDoc, emitStep2Reply) =>
        this.applySyncFrame(data, targetDoc, emitStep2Reply),
      completeRebuild: (freshDoc) => {
        const oldDoc = this.doc;
        const oldAwareness = this.awareness;
        const oldHandler = this.localDocUpdateHandler;
        this.pendingUpdates = [];
        if (this.updateBatchTimer) {
          clearTimeout(this.updateBatchTimer);
          this.updateBatchTimer = null;
        }
        this.localDocUpdateHandler = null;
        this.cachedText = null;
        this.cachedLineStarts = null;
        this.httpSavedWhileDisconnected = false;

        swapDocAndAwarenessAfterRebuild({
          freshDoc,
          oldDoc,
          oldAwareness,
          localDocUpdateHandler: oldHandler,
          flushPendingUpdates: () => this.flushPendingUpdates(),
          rebindListenersAndUser: (newDoc, newAwareness) => {
            this.doc = newDoc;
            this.yText = newDoc.getText('latex');
            this.awareness = newAwareness;
            this.socketToClientIdMap.clear();
            if (this.options.user) this.setLocalUser(this.options.user);
            this.setupLocalAwarenessListener();
            this.setupLocalDocListener();
          },
          notifyDocReplaced: () => {
            this.isSynced = true;
            for (const listener of this.docReplacedListeners) {
              try {
                listener(this);
              } catch (err) {
                console.warn('[YjsSocketIOProvider] doc-replaced listener error:', err);
              }
            }
            this.emitSynced();
          },
          crossTabBridge: this.crossTabBridge,
          role: this._role,
        });
      },
      flushPendingUpdates: () => this.flushPendingUpdates(),
      markSynced: () => {
        this.isSynced = true;
        this.emitSynced();
      },
    };
  }

  private rebuildFromServer(): void {
    executeRebuildFromServer(this.getServerRebuildContext());
  }

  public flushPendingUpdates(): boolean {
    if (this.updateBatchTimer) {
      clearTimeout(this.updateBatchTimer);
      this.updateBatchTimer = null;
    }
    if (
      this.destroyed ||
      this._role === 'follower' ||
      this.httpSavedWhileDisconnected ||
      this.resyncInFlight ||
      !this.socket ||
      !this.socket.connected
    ) {
      return false;
    }
    if (this.pendingUpdates.length === 0) return true;

    const updatesToEmit = this.pendingUpdates;
    this.pendingUpdates = [];
    emitMergedUpdatesBatch({
      socket: this.socket,
      spaceId: this.spaceId,
      pageId: this.pageId,
      updates: updatesToEmit,
      isDestroyed: () => this.destroyed,
      onFailureRequeue: (mergedData) => {
        this.pendingUpdates = [mergedData, ...this.pendingUpdates];
      },
      getPendingCount: () => this.pendingUpdates.length,
      onUpdatesAcked: this.options.onUpdatesAcked,
      role: this._role,
      crossTabBridge: this.crossTabBridge,
    });
    return true;
  }

  private initiateYjsSync(): void {
    executeInitiateYjsSync(this.getServerRebuildContext(), this.httpSavedWhileDisconnected);
  }

  private getCursorPresenceHost(): CursorPresenceHost {
    return {
      getSocket: () => this.socket,
      getLocalUserId: () => this.options.user?.id,
      getDoc: () => this.doc,
      getYText: () => this.yText,
      getAwareness: () => this.awareness,
      socketToClientIdMap: this.socketToClientIdMap,
      collaboratorsMap: this.collaboratorsMap,
      getIndexedText: () => this.getIndexedText(),
      onCollaboratorsChange: this.options.onCollaboratorsChange,
      getRole: () => this._role,
      getStatus: () => this.status,
      getIsSynced: () => this.isSynced,
      getCrossTabBridge: () => this.crossTabBridge,
    };
  }

  private handleInitialDocPresence(docPresence: RemotePresencePayload[]): void {
    handleInitialDocPresenceHelper(this.getCursorPresenceHost(), docPresence);
  }

  private handleRemoteCursor(data: RemoteCursorPayload): void {
    handleRemoteCursorHelper(this.getCursorPresenceHost(), data);
  }

  private handleUserJoined(data: RemoteUserJoinedPayload): void {
    handleUserJoinedHelper(this.getCursorPresenceHost(), data);
  }

  private handleUserLeft(data: { userId?: string; socketId?: string }): void {
    handleUserLeftHelper(this.getCursorPresenceHost(), data);
  }

  private setupLocalAwarenessListener(): void {
    this.awareness.on(
      'change',
      ({ added, updated }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin === 'socket.io') return;
        if (added.includes(this.awareness.clientID) || updated.includes(this.awareness.clientID)) {
          this.scheduleEmitLocalCursor();
        }
      },
    );
  }

  private scheduleEmitLocalCursor(): void {
    if (this.destroyed) return;
    const extracted = extractNextLocalCursor(this.getCursorPresenceHost(), this.lastEmittedCoords);
    if (!extracted) return;
    this.lastEmittedCoords = extracted.nextLastEmittedCoords;
    this.sendCursor(extracted.headRow, extracted.headCol, extracted.selection);
  }

  public sendCursor(row: number, column: number, selection?: RemoteCursorSelection | null): void {
    this.cursorThrottler.send({
      row,
      column,
      selection,
      isDestroyed: () => this.destroyed,
      getRole: () => this._role,
      getCrossTabBridge: () => this.crossTabBridge,
      getSocket: () => this.socket,
      spaceId: this.spaceId,
      pageId: this.pageId,
    });
  }

  public setLocalUser(user: CollaboratorUser): void {
    this.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name || 'Anonymous Researcher',
      avatar: user.avatar,
      color: user.color || getAuthorColor(user.id || user.name || 'Anonymous Researcher'),
      role: user.role || 'contributor',
    });
  }

  public triggerCheckpoint(): void {
    this.flushPendingUpdates();
  }

  public destroy(options?: { skipFlush?: boolean }): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (options?.skipFlush) {
      if (this.updateBatchTimer) {
        clearTimeout(this.updateBatchTimer);
        this.updateBatchTimer = null;
      }
      this.pendingUpdates = [];
    } else {
      this.flushPendingUpdates();
    }

    this.cursorThrottler.clear();
    if (this.updateBatchTimer) {
      clearTimeout(this.updateBatchTimer);
      this.updateBatchTimer = null;
    }

    if (typeof window !== 'undefined' && this.handleOnline) {
      window.removeEventListener('online', this.handleOnline);
      this.handleOnline = null;
    }

    if (this.socket) {
      emitSocketDisconnectAndLeave(
        this.socket,
        this.spaceId,
        this.pageId,
        this.isChatOnlyRoom(),
        this.isEvicted,
      );
      this.socket = null;
    }

    if (this.crossTabBridge) {
      this.crossTabBridge.dispose();
      this.crossTabBridge = null;
    }

    if (this.localDocUpdateHandler) {
      this.doc.off('update', this.localDocUpdateHandler);
      this.localDocUpdateHandler = null;
    }
    this.awareness.destroy();
    this.doc.destroy();
  }
}

export {
  acquireYjsProvider,
  getOrCreateYjsProvider,
  releaseYjsProvider,
  markHttpSavedWhileDisconnected,
  flushYjsProvider,
  flushYjsProviders,
  getActiveYjsProvider,
  updateActiveYjsDocContent,
  evictYjsProviderByDocId,
  evictYjsProvidersByProject,
  clearYjsProviderPool,
  subscribeYjsPoolCleared,
  getYjsPoolEpoch,
} from './yjs-provider-pool';
