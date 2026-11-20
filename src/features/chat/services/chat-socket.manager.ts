'use client';

import { io, type Socket } from 'socket.io-client';
import { getAuthToken, getRealtimeBaseUrl } from '@/shared/lib/api';

export const CHAT_SOCKET_EVENTS = {
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  CONVERSATION_UPDATED: 'conversation:updated',
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  MESSAGE_REACTION: 'message:reaction',
  REACTION_UPDATED: 'message:reaction_updated',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  TYPING_STATUS: 'typing:status',
} as const;

let sharedSocket: Socket | null = null;
let ownerUserId: string | null = null;
let consumerCount = 0;
const joinedRoomCounts = new Map<string, number>();
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

function clearPendingDisconnect(): void {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
}

function createChatSocket(): Socket {
  const baseUrl = getRealtimeBaseUrl();
  const socket = io(`${baseUrl || ''}/chat`, {
    path: '/socket.io',
    auth: (cb) => cb({ token: getAuthToken() }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    for (const [conversationId, count] of joinedRoomCounts.entries()) {
      if (count > 0) {
        socket.emit(CHAT_SOCKET_EVENTS.CONVERSATION_JOIN, { conversationId });
      }
    }
  });

  return socket;
}

export function acquireChatSocket(userId: string): Socket {
  clearPendingDisconnect();

  if (sharedSocket && ownerUserId !== userId) {
    disconnectChatSocketImmediately();
  }

  if (!sharedSocket) {
    sharedSocket = createChatSocket();
    ownerUserId = userId;
  }

  consumerCount += 1;
  return sharedSocket;
}

export function releaseChatSocket(userId: string, graceMs = 150): void {
  consumerCount = Math.max(0, consumerCount - 1);

  if (consumerCount === 0 && ownerUserId === userId) {
    clearPendingDisconnect();
    disconnectTimer = setTimeout(() => {
      if (consumerCount === 0 && ownerUserId === userId) {
        disconnectChatSocketImmediately();
      }
    }, graceMs);
  }
}

export function joinConversationRoom(socket: Socket, conversationId: string): void {
  const prevCount = joinedRoomCounts.get(conversationId) ?? 0;
  joinedRoomCounts.set(conversationId, prevCount + 1);

  if (prevCount === 0 && socket.connected) {
    socket.emit(CHAT_SOCKET_EVENTS.CONVERSATION_JOIN, { conversationId });
  }
}

export function leaveConversationRoom(socket: Socket, conversationId: string): void {
  const prevCount = joinedRoomCounts.get(conversationId) ?? 0;
  if (prevCount <= 1) {
    joinedRoomCounts.delete(conversationId);
    if (prevCount > 0 && socket.connected) {
      socket.emit(CHAT_SOCKET_EVENTS.CONVERSATION_LEAVE, { conversationId });
    }
    return;
  }

  joinedRoomCounts.set(conversationId, prevCount - 1);
}

export function disconnectChatSocketImmediately(): void {
  clearPendingDisconnect();
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
  }
  sharedSocket = null;
  ownerUserId = null;
  consumerCount = 0;
  joinedRoomCounts.clear();
}

export const resetChatSocketForTesting = disconnectChatSocketImmediately;
