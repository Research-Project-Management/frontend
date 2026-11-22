/**
 * yjs-inbound-events.ts
 *
 * Extracted Socket.IO inbound event registration & dispatch helpers for YjsSocketIOProvider.
 */

import * as Y from 'yjs';
import { io, type Socket } from 'socket.io-client';
import { getRealtimeBaseUrl, getAuthToken } from '@/shared/lib/api';
import type { IEditorCommandBus } from '@/features/editor/core/bus/command-bus.port';
import type { CollaborationPresence } from '../pages/types';
import {
  YjsCrossTabBridge,
  type CrossTabProviderRole,
} from './yjs-cross-tab-bridge';
import type {
  CompileProgressPayload,
  ConnectionStatus,
  DocContentUpdatedPayload,
  ProjectChatMessage,
  RemoteCursorData,
  RemoteCursorPayload,
  RemotePresencePayload,
  RemoteUserJoinedPayload,
  YjsSocketIOProviderOptions,
} from './yjs-awareness-sync';

const RELAYABLE_SOCKET_EVENTS = [
  'compile:progress',
  'doc:evicted',
  'doc:persisted',
  'fileTree:update',
  'doc:content-updated',
  'project:chat:new',
] as const;

const REVIEW_SOCKET_EVENTS = [
  'review:status-changed',
  'track-changes:created',
  'track-changes:resolved',
  'comment:created',
  'comment:reply-added',
  'comment:reply-updated',
  'comment:reply-deleted',
  'comment:updated',
  'comment:deleted',
  'comment:resolved',
] as const;

const REVIEW_EVENT_MAP: Record<string, string> = {
  'review:status-changed': 'review:status-changed',
  'track-changes:created': 'suggestion:recorded',
  'track-changes:resolved': 'suggestion:resolved',
  'comment:created': 'comment:created',
  'comment:reply-added': 'comment:replied',
  'comment:reply-updated': 'comment:replied',
  'comment:reply-deleted': 'comment:replied',
  'comment:updated': 'comment:created',
  'comment:deleted': 'comment:resolved',
  'comment:resolved': 'comment:resolved',
};

export interface InboundEventContext {
  readonly pageId: string;
  readonly isDestroyed: () => boolean;
  readonly getCommandBus: () => IEditorCommandBus | undefined;
  readonly getChatListeners: () => Iterable<(message: ProjectChatMessage) => void>;
  readonly onChatMessage?: (message: ProjectChatMessage) => void;
  readonly onDocEvicted: () => void;
}

export function dispatchInboundServerEventHelper(
  ctx: InboundEventContext,
  eventName: string,
  rawData: unknown,
): void {
  if (ctx.isDestroyed()) return;

  if (eventName === 'compile:progress') {
    const data = rawData as CompileProgressPayload | string;
    const status = typeof data === 'object' && data?.status ? data.status : 'compiling';
    const logs = typeof data === 'object' && data?.logs ? data.logs : typeof data === 'string' ? data : '';
    ctx.getCommandBus()?.dispatch({
      type: 'compiler:progress',
      status,
      logs: Array.isArray(logs) ? logs : logs ? [logs] : [],
    });
    return;
  }

  if (eventName === 'doc:evicted') {
    const data = rawData as { spaceId?: string; docId?: string } | undefined;
    if (data?.docId && data.docId !== ctx.pageId) return;
    ctx.onDocEvicted();
    return;
  }

  if (eventName === 'doc:persisted') {
    const data = rawData as
      | { spaceId?: string; docId?: string; rev?: number; version?: number; savedAt?: string }
      | undefined;
    const targetDocId = data?.docId || ctx.pageId;
    if (targetDocId) {
      ctx.getCommandBus()?.dispatch({
        type: 'document:persisted',
        docId: targetDocId,
        rev: data?.rev,
        version: data?.version,
        savedAt: data?.savedAt,
      });
    }
    return;
  }

  if (eventName === 'fileTree:update') {
    ctx.getCommandBus()?.dispatch({
      type: 'filetree:updated',
      payload: rawData as Record<string, unknown>,
    });
    return;
  }

  if (eventName === 'doc:content-updated') {
    const data = rawData as DocContentUpdatedPayload | undefined;
    if (data?.docId && typeof data?.content === 'string') {
      ctx.getCommandBus()?.dispatch({
        type: 'document:content-updated',
        docId: data.docId,
        content: data.content,
      });
    }
    return;
  }

  if (eventName === 'project:chat:new') {
    const msg = rawData as ProjectChatMessage | undefined;
    if (!msg) return;
    ctx.onChatMessage?.(msg);
    for (const listener of ctx.getChatListeners()) {
      try {
        listener(msg);
      } catch (err) {
        console.warn('[YjsSocketIOProvider] chat listener error:', err);
      }
    }
    return;
  }

  const mappedReviewEvent = REVIEW_EVENT_MAP[eventName];
  if (mappedReviewEvent) {
    const data = (rawData ?? {}) as Record<string, unknown> & { docId?: string };
    ctx.getCommandBus()?.dispatch({
      type: 'editor:review-event',
      pageId: data.docId || ctx.pageId,
      event: mappedReviewEvent,
      payload: data,
    });
  }
}

export interface SocketListenerCallbacks {
  readonly spaceId: string;
  readonly pageId: string;
  readonly isDestroyed: () => boolean;
  readonly isChatOnlyRoom: () => boolean;
  readonly isEvicted: () => boolean;
  readonly onConnected: () => void;
  readonly onChatOnlyConnected: () => void;
  readonly onInitialDocPresence: (presence: RemotePresencePayload[]) => void;
  readonly onInitiateYjsSync: () => void;
  readonly onDisconnect: () => void;
  readonly onConnectError: () => void;
  readonly onSyncUpdate: (payload: { spaceId?: string; docId: string; data: Uint8Array | ArrayLike<number> }) => void;
  readonly onSyncStep2: (payload: { docId: string; data: Uint8Array | ArrayLike<number> }) => void;
  readonly onRemoteCursor: (data: RemoteCursorPayload) => void;
  readonly onUserJoined: (data: RemoteUserJoinedPayload) => void;
  readonly onUserLeft: (data: { userId?: string; socketId?: string }) => void;
  readonly onRelayableEvent: (eventName: string, data: unknown) => void;
}

export function registerProviderSocketListeners(
  socket: Socket,
  cb: SocketListenerCallbacks,
): void {
  socket.on('connect', () => {
    if (cb.isDestroyed()) return;
    cb.onConnected();

    socket.emit(
      'project:join',
      { spaceId: cb.spaceId },
      (res?: { success?: boolean; projectPresence?: CollaborationPresence[]; error?: string }) => {
        if (res?.error) {
          console.debug('[YjsSocketIOProvider] project:join info:', res.error);
        }
      },
    );

    if (cb.isChatOnlyRoom()) {
      cb.onChatOnlyConnected();
      return;
    }

    if (cb.isEvicted()) {
      return;
    }

    socket.emit(
      'doc:join',
      { spaceId: cb.spaceId, docId: cb.pageId },
      (res?: { success?: boolean; docPresence?: RemotePresencePayload[]; error?: string }) => {
        if (res?.success && Array.isArray(res.docPresence)) {
          cb.onInitialDocPresence(res.docPresence);
        }
        cb.onInitiateYjsSync();
      },
    );
  });

  socket.on('disconnect', () => {
    if (cb.isDestroyed()) return;
    cb.onDisconnect();
  });

  socket.on('connect_error', () => {
    if (cb.isDestroyed()) return;
    cb.onConnectError();
  });

  socket.on('doc:sync:update', (payload: {
    spaceId?: string;
    docId: string;
    data: Uint8Array | ArrayLike<number>;
  }) => {
    if (
      cb.isDestroyed() ||
      (payload.spaceId && payload.spaceId !== cb.spaceId) ||
      payload.docId !== cb.pageId ||
      !payload.data
    ) {
      return;
    }
    cb.onSyncUpdate(payload);
  });

  socket.on('doc:sync:step2', (payload: {
    docId: string;
    data: Uint8Array | ArrayLike<number>;
  }) => {
    if (cb.isDestroyed() || payload.docId !== cb.pageId || !payload.data) return;
    cb.onSyncStep2(payload);
  });

  socket.on('doc:cursor', (data: RemoteCursorPayload) => {
    if (cb.isDestroyed()) return;
    cb.onRemoteCursor(data);
  });

  socket.on('doc:user-joined', (data: RemoteUserJoinedPayload) => {
    if (cb.isDestroyed() || data.socketId === socket.id) return;
    cb.onUserJoined(data);
  });

  socket.on('doc:user-left', (data: { userId?: string; socketId?: string }) => {
    if (cb.isDestroyed()) return;
    cb.onUserLeft(data);
  });

  socket.on('project:user-joined', (data: RemoteUserJoinedPayload) => {
    if (cb.isDestroyed() || !data || data.socketId === socket.id) return;
    cb.onUserJoined(data);
  });

  socket.on('project:user-left', (data: { userId?: string; socketId?: string }) => {
    if (cb.isDestroyed()) return;
    cb.onUserLeft(data);
  });

  for (const eventName of RELAYABLE_SOCKET_EVENTS) {
    socket.on(eventName, (data: unknown) => {
      if (cb.isDestroyed()) return;
      cb.onRelayableEvent(eventName, data);
    });
  }

  for (const socketEvent of REVIEW_SOCKET_EVENTS) {
    socket.on(socketEvent, (data: unknown) => {
      if (cb.isDestroyed()) return;
      cb.onRelayableEvent(socketEvent, data);
    });
  }
}

export interface CrossTabBridgeHost {
  readonly spaceId: string;
  readonly pageId: string;
  readonly options: YjsSocketIOProviderOptions;
  readonly locksApi: YjsSocketIOProviderOptions['locksApi'];
  readonly enableMultiplexing: boolean;
  readonly isDestroyed: () => boolean;
  readonly getDoc: () => Y.Doc;
  readonly getRole: () => CrossTabProviderRole;
  readonly setRole: (role: CrossTabProviderRole) => void;
  readonly getStatus: () => ConnectionStatus;
  readonly setStatus: (status: ConnectionStatus) => void;
  readonly getIsSynced: () => boolean;
  readonly setIsSynced: (synced: boolean) => void;
  readonly getSocket: () => Socket | null;
  readonly connect: () => void;
  readonly queueLeaderUpdate: (update: Uint8Array) => void;
  readonly flushPendingUpdates: () => boolean;
  readonly broadcastLeaderPresence: () => void;
  readonly clearPendingUpdates: () => void;
  readonly collaboratorsMap: Map<string, CollaborationPresence>;
  readonly emitStatus: (status: ConnectionStatus) => void;
  readonly emitSynced: () => void;
  readonly dispatchInboundServerEvent: (eventName: string, payload: unknown) => void;
}

export function createCrossTabBridgeForProvider(host: CrossTabBridgeHost): YjsCrossTabBridge {
  const bridge = new YjsCrossTabBridge({
    spaceId: host.spaceId,
    pageId: host.pageId,
    userId: host.options.user?.id,
    getDoc: () => host.getDoc(),
    broadcastChannelFactory: host.options.broadcastChannelFactory,
    locksApi: host.locksApi,
    enableMultiplexing: host.enableMultiplexing,
    onPeerDocUpdate: (update, fromServer) => {
      if (host.isDestroyed()) return;
      Y.applyUpdate(host.getDoc(), update, 'broadcast-channel');
      if (!fromServer && host.getRole() === 'leader') {
        host.queueLeaderUpdate(update);
      }
    },
    onBecameLeader: () => {
      if (host.isDestroyed()) return;
      host.setRole(host.enableMultiplexing ? 'leader' : 'standalone');
      if (!host.getSocket()) {
        host.connect();
      } else {
        host.flushPendingUpdates();
      }
      host.broadcastLeaderPresence();
    },
    onBecameFollower: () => {
      if (host.isDestroyed()) return;
      host.setRole('follower');
      if (host.getStatus() === 'connecting') {
        host.setStatus('disconnected');
      }
    },
    onFollowerHello: (followerId) => {
      if (host.isDestroyed() || host.getRole() !== 'leader') return;
      host.broadcastLeaderPresence();
      bridge.sendFullSyncToFollower(followerId);
    },
    onLeaderStatus: (nextStatus, nextIsSynced, collaborators) => {
      if (host.isDestroyed() || host.getRole() !== 'follower') return;
      const statusChanged = host.getStatus() !== nextStatus;
      const becameSynced = !host.getIsSynced() && nextIsSynced;
      host.setStatus(nextStatus);
      host.setIsSynced(nextIsSynced);
      if (collaborators.length > 0 || host.collaboratorsMap.size > 0) {
        host.collaboratorsMap.clear();
        for (const c of collaborators) {
          const collabKey = c.socketId || c.userId || c.id;
          if (collabKey) host.collaboratorsMap.set(collabKey, c);
        }
        host.options.onCollaboratorsChange?.(Array.from(host.collaboratorsMap.values()));
      }
      if (statusChanged) host.emitStatus(nextStatus);
      if (becameSynced) host.emitSynced();
    },
    onLeaderAck: (ackDocId) => {
      if (host.isDestroyed() || host.getRole() !== 'follower') return;
      if (ackDocId !== host.pageId) return;
      host.clearPendingUpdates();
      host.options.onUpdatesAcked?.(host.pageId);
    },
    onRemoteEvent: (eventName, payload) => {
      if (host.isDestroyed() || host.getRole() !== 'follower') return;
      host.dispatchInboundServerEvent(eventName, payload);
    },
    onFollowerCursor: (cursor: RemoteCursorData) => {
      if (host.isDestroyed() || host.getRole() !== 'leader') return;
      const sock = host.getSocket();
      if (sock?.connected) {
        sock.emit('doc:cursor', {
          spaceId: host.spaceId,
          docId: host.pageId,
          cursor,
        });
      }
    },
  });
  return bridge;
}

export function resolveCrossTabTransportConfig(
  options: YjsSocketIOProviderOptions,
  isChatOnlyRoom: boolean,
): {
  canBroadcast: boolean;
  resolvedLocks: YjsSocketIOProviderOptions['locksApi'];
  useMultiplexing: boolean;
} {
  const hasCustomTestSocket = Boolean(
    options.socketFactory || (globalThis as { __fluxFakeSocket?: unknown }).__fluxFakeSocket,
  );
  const canBroadcast =
    !isChatOnlyRoom &&
    options.enableCrossTabSync !== false &&
    (Boolean(options.broadcastChannelFactory) ||
      (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined' && !hasCustomTestSocket));
  const resolvedLocks =
    options.locksApi ??
    (typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : undefined);
  const useMultiplexing =
    !isChatOnlyRoom &&
    Boolean(resolvedLocks?.request) &&
    canBroadcast &&
    (options.enableCrossTabMultiplexing === true ||
      (options.enableCrossTabMultiplexing !== false && !hasCustomTestSocket));
  return { canBroadcast, resolvedLocks, useMultiplexing };
}

export function createRealtimeSocketInstance(options: YjsSocketIOProviderOptions): Socket {
  const rawBase = (options.baseUrl || getRealtimeBaseUrl() || '').replace(/\/$/, '');
  const socketUrl = rawBase ? `${rawBase}/pages` : '/pages';
  const user = options.user;
  const socketOpts = {
    path: '/socket.io',
    transports: ['polling', 'websocket'],
    auth: (cb: (data: Record<string, unknown>) => void) => {
      const currentToken = options.getToken?.() || options.token || getAuthToken() || undefined;
      cb({
        token: currentToken,
        userId: user?.id,
        name: user?.name,
        avatar: user?.avatar,
        color: user?.color,
      });
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  };
  const fakeSocket = (globalThis as { __fluxFakeSocket?: Socket }).__fluxFakeSocket;
  return options.socketFactory?.(socketUrl, socketOpts) ?? fakeSocket ?? io(socketUrl, socketOpts);
}

export function emitSocketDisconnectAndLeave(
  socket: Socket,
  spaceId: string,
  pageId: string,
  isChatOnlyRoom: boolean,
  isEvicted: boolean,
): void {
  try {
    if (socket.connected) {
      if (!isChatOnlyRoom && !isEvicted) {
        socket.emit('doc:leave', { spaceId, docId: pageId });
      }
      socket.emit('project:leave', { spaceId });
    }
    socket.removeAllListeners();
    socket.disconnect();
  } catch {
    // Socket cleanup error ignored on unmount
  }
}

export function emitProjectChatSend(
  socket: Socket | null,
  isDestroyed: boolean,
  spaceId: string,
  text: string,
  replyToId?: string,
): Promise<ProjectChatMessage | null> {
  return new Promise((resolve) => {
    if (isDestroyed || !socket || !socket.connected || !text.trim()) {
      resolve(null);
      return;
    }
    socket.emit(
      'project:chat:send',
      { spaceId, text: text.trim(), replyToId },
      (res?: { success?: boolean; message?: ProjectChatMessage }) => {
        resolve(res?.success && res.message ? res.message : null);
      },
    );
  });
}

export function fetchProjectChatHistory(
  socket: Socket | null,
  isDestroyed: boolean,
  spaceId: string,
): Promise<ProjectChatMessage[]> {
  return new Promise((resolve) => {
    if (isDestroyed || !socket || !socket.connected) {
      resolve([]);
      return;
    }
    socket.emit(
      'project:chat:history',
      { spaceId },
      (res?: { success?: boolean; messages?: ProjectChatMessage[] }) => {
        resolve(res?.success && Array.isArray(res.messages) ? res.messages : []);
      },
    );
  });
}
