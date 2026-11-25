'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useChatStore } from '../store/chat.store';
import { CHAT_QUERY_KEYS } from '../hooks/use-chat-queries';
import type { ChatMessage, MessagesPageResponse, MessageType } from '../types/chat.types';
import {
  CHAT_SOCKET_EVENTS,
  acquireChatSocket,
  joinConversationRoom,
  leaveConversationRoom,
  releaseChatSocket,
} from './room-manager';

interface TypingStatusPayload {
  conversationId: string;
  userId: string;
  userName?: string;
  isTyping: boolean;
}

interface ReactionUpdatedPayload {
  conversationId?: string;
  messageId: string;
  userId: string;
  emoji: string;
  action: 'add' | 'remove';
}

interface PeerTypingEntry {
  timer: ReturnType<typeof setTimeout>;
  userName: string;
}

interface UserDisplayLike {
  name?: string | null;
  email?: string | null;
  profile?: { name?: string | null } | null;
}

function resolveDisplayName(user: UserDisplayLike | null | undefined): string {
  return user?.name || user?.profile?.name || user?.email?.split('@')[0] || 'User';
}

type MessagesInfiniteData = InfiniteData<MessagesPageResponse, unknown>;

export function useChatSocket(activeConversationId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const displayName = resolveDisplayName(user as UserDisplayLike | null | undefined);
  const displayNameRef = useRef<string>(displayName);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  const setTypingUser = useChatStore((s) => s.setTypingUser);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingMapRef = useRef<Map<string, PeerTypingEntry>>(new Map());

  // 1. Acquire one persistent /chat connection per userId (never reconnect on conversation switch)
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const peerTypingMap = peerTypingMapRef.current;
    const socket = acquireChatSocket(userId);
    socketRef.current = socket;

    const clearPeerTyping = (conversationId: string, senderId?: string, fallbackName?: string) => {
      if (senderId) {
        const key = `${conversationId}:${senderId}`;
        const existing = peerTypingMap.get(key);
        if (existing) {
          clearTimeout(existing.timer);
          peerTypingMap.delete(key);
          setTypingUser(conversationId, existing.userName, false);
          return;
        }
      }
      if (fallbackName) {
        setTypingUser(conversationId, fallbackName, false);
      }
    };

    const handleNewMessage = (message: ChatMessage) => {
      const targetConvId = message.conversationId;
      const isActive = targetConvId === activeConversationIdRef.current;
      const hasCache = Boolean(queryClient.getQueryData(CHAT_QUERY_KEYS.messages(targetConvId)));

      if (isActive || hasCache) {
        queryClient.setQueryData<MessagesInfiniteData>(
          CHAT_QUERY_KEYS.messages(targetConvId),
          (oldData) => {
            if (!oldData?.pages?.length) {
              return {
                pages: [{ messages: [message], nextCursor: null }],
                pageParams: [undefined],
              };
            }

            const firstPage = oldData.pages[0];
            if (firstPage.messages.some((m) => m.id === message.id)) {
              return oldData;
            }

            const tempIndex = firstPage.messages.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.senderId === message.senderId &&
                m.content === message.content,
            );

            if (tempIndex !== -1) {
              const updated = [...firstPage.messages];
              updated[tempIndex] = message;
              return {
                ...oldData,
                pages: [{ ...firstPage, messages: updated }, ...oldData.pages.slice(1)],
              };
            }

            return {
              ...oldData,
              pages: [
                { ...firstPage, messages: [message, ...firstPage.messages] },
                ...oldData.pages.slice(1),
              ],
            };
          },
        );
      }

      if (isActive && message.senderId !== userId) {
        socket.emit(CHAT_SOCKET_EVENTS.MESSAGE_READ, { conversationId: targetConvId });
      }

      clearPeerTyping(targetConvId, message.senderId, message.sender?.name);
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    };

    const handleConversationUpdated = () => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    };

    const handleTypingStatus = (payload: TypingStatusPayload) => {
      if (payload.userId === userId) return;

      const key = `${payload.conversationId}:${payload.userId}`;
      const existing = peerTypingMap.get(key);
      if (existing) {
        clearTimeout(existing.timer);
        peerTypingMap.delete(key);
      }

      const resolvedName = payload.userName || existing?.userName || 'Someone';
      if (payload.isTyping) {
        setTypingUser(payload.conversationId, resolvedName, true);
        const timer = setTimeout(() => {
          setTypingUser(payload.conversationId, resolvedName, false);
          peerTypingMap.delete(key);
        }, 2500);
        peerTypingMap.set(key, { timer, userName: resolvedName });
      } else {
        setTypingUser(payload.conversationId, resolvedName, false);
      }
    };

    const handleReactionUpdated = (payload: ReactionUpdatedPayload) => {
      const targetConvId = payload.conversationId || activeConversationIdRef.current;
      if (!targetConvId) return;

      queryClient.setQueryData<MessagesInfiniteData>(
        CHAT_QUERY_KEYS.messages(targetConvId),
        (oldData) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              messages: page.messages.map((msg) => {
                if (msg.id !== payload.messageId) return msg;
                const existing = msg.reactions || [];
                let updatedReactions = [...existing];
                if (payload.action === 'remove') {
                  updatedReactions = updatedReactions.filter(
                    (r) => !(r.userId === payload.userId && r.emoji === payload.emoji),
                  );
                } else {
                  const alreadyHas = updatedReactions.some(
                    (r) => r.userId === payload.userId && r.emoji === payload.emoji,
                  );
                  if (!alreadyHas) {
                    updatedReactions.push({
                      id: `temp-${Date.now()}`,
                      emoji: payload.emoji,
                      userId: payload.userId,
                    });
                  }
                }
                return {
                  ...msg,
                  reactions: updatedReactions,
                };
              }),
            })),
          };
        },
      );
    };

    socket.on(CHAT_SOCKET_EVENTS.MESSAGE_NEW, handleNewMessage);
    socket.on(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, handleConversationUpdated);
    socket.on(CHAT_SOCKET_EVENTS.TYPING_STATUS, handleTypingStatus);
    socket.on(CHAT_SOCKET_EVENTS.REACTION_UPDATED, handleReactionUpdated);

    return () => {
      socket.off(CHAT_SOCKET_EVENTS.MESSAGE_NEW, handleNewMessage);
      socket.off(CHAT_SOCKET_EVENTS.CONVERSATION_UPDATED, handleConversationUpdated);
      socket.off(CHAT_SOCKET_EVENTS.TYPING_STATUS, handleTypingStatus);
      socket.off(CHAT_SOCKET_EVENTS.REACTION_UPDATED, handleReactionUpdated);

      for (const entry of peerTypingMap.values()) {
        clearTimeout(entry.timer);
      }
      peerTypingMap.clear();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      socketRef.current = null;
      releaseChatSocket(userId);
    };
  }, [user?.id, queryClient, setTypingUser]);

  // 2. Join/leave conversation rooms cleanly on activeConversationId transitions
  useEffect(() => {
    const socket = socketRef.current;
    if (!user?.id || !activeConversationId || !socket) return;

    joinConversationRoom(socket, activeConversationId);

    const markConversationReadOnConnect = () => {
      socket.emit(CHAT_SOCKET_EVENTS.MESSAGE_READ, { conversationId: activeConversationId });
    };

    if (socket.connected) {
      markConversationReadOnConnect();
    }
    socket.on('connect', markConversationReadOnConnect);

    return () => {
      socket.off('connect', markConversationReadOnConnect);
      if (socket.connected) {
        socket.emit(CHAT_SOCKET_EVENTS.TYPING_STOP, {
          conversationId: activeConversationId,
          userName: displayNameRef.current,
        });
      }
      leaveConversationRoom(socket, activeConversationId);
    };
  }, [user?.id, activeConversationId]);

  const sendSocketMessage = useCallback(
    (
      content: string,
      type: MessageType = 'text',
      attachments: unknown[] = [],
      replyToId?: string,
    ) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || !activeConversationId) return;

      socket.emit(CHAT_SOCKET_EVENTS.MESSAGE_SEND, {
        conversationId: activeConversationId,
        dto: {
          content,
          type,
          attachments,
          replyToId,
        },
      });
    },
    [activeConversationId],
  );

  const emitReaction = useCallback(
    (messageId: string, emoji: string, action: 'add' | 'remove' = 'add') => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      socket.emit(CHAT_SOCKET_EVENTS.MESSAGE_REACTION, {
        messageId,
        emoji,
        action,
      });
    },
    [],
  );

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || !activeConversationId) return;

      const userName = displayNameRef.current;

      if (isTyping) {
        socket.emit(CHAT_SOCKET_EVENTS.TYPING_START, {
          conversationId: activeConversationId,
          userName,
        });

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit(CHAT_SOCKET_EVENTS.TYPING_STOP, {
            conversationId: activeConversationId,
            userName: displayNameRef.current,
          });
        }, 3000);
      } else {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit(CHAT_SOCKET_EVENTS.TYPING_STOP, {
          conversationId: activeConversationId,
          userName,
        });
      }
    },
    [activeConversationId],
  );

  const markAsRead = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit(CHAT_SOCKET_EVENTS.MESSAGE_READ, { conversationId });
  }, []);

  return {
    socket: socketRef.current,
    sendSocketMessage,
    emitReaction,
    emitTyping,
    markAsRead,
  };
}
