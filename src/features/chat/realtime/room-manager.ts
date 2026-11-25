'use client';

import type { Socket } from 'socket.io-client';
import { NAMESPACES } from '@/shared/realtime/config';
import { socketPool } from '@/shared/realtime/socket-pool';

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

const joinedRoomCounts = new Map<string, number>();
let boundSocket: Socket | null = null;

function rejoinActiveRooms(socket: Socket): void {
  for (const [conversationId, count] of joinedRoomCounts.entries()) {
    if (count > 0) {
      socket.emit(CHAT_SOCKET_EVENTS.CONVERSATION_JOIN, { conversationId });
    }
  }
}

export function acquireChatSocket(userId: string): Socket {
  const socket = socketPool.acquire(NAMESPACES.CHAT, userId);

  if (boundSocket !== socket) {
    boundSocket = socket;
    socket.on('connect', () => rejoinActiveRooms(socket));
  }

  return socket;
}

export function releaseChatSocket(_userId: string, graceMs = 150): void {
  socketPool.release(NAMESPACES.CHAT, graceMs);
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
  socketPool.release(NAMESPACES.CHAT, 0);
  boundSocket = null;
  joinedRoomCounts.clear();
}

export const resetChatSocketForTesting = disconnectChatSocketImmediately;
