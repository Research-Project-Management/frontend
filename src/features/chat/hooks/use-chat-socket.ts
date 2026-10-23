'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken, getEffectiveBaseUrl } from '@/shared/lib/api';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useChatStore } from '../store/chat.store';
import { CHAT_QUERY_KEYS } from './use-chat-queries';
import { ChatMessage, MessagesPageResponse, MessageType } from '../types/chat.types';

export function useChatSocket(activeConversationId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const setTypingUser = useChatStore((s) => s.setTypingUser);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const peerTypingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    if (!user?.id) return;

    const token = getAuthToken();
    const baseUrl = getEffectiveBaseUrl();

    const socket = io(`${baseUrl || ''}/chat`, {
      path: '/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Join active conversation room if set
      if (activeConversationId) {
        socket.emit('conversation:join', { conversationId: activeConversationId });
      }
    });

    // Handle new incoming messages
    socket.on('message:new', (message: ChatMessage) => {
      // 1. If message belongs to active conversation, append to query cache
      if (message.conversationId === activeConversationId) {
        queryClient.setQueryData(
          CHAT_QUERY_KEYS.messages(activeConversationId),
          (oldData: { pages: MessagesPageResponse[]; pageParams: unknown[] } | undefined) => {
            if (!oldData || !oldData.pages || oldData.pages.length === 0) {
              return {
                pages: [{ messages: [message], nextCursor: null }],
                pageParams: [undefined],
              };
            }
            const firstPage = oldData.pages[0];
            // 1. Check if message already exists by real ID
            const exists = firstPage.messages.some((m) => m.id === message.id);
            if (exists) return oldData;

            // 2. Check if this matches a pending optimistic temp message from same sender
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
                pages: [
                  {
                    ...firstPage,
                    messages: updated,
                  },
                  ...oldData.pages.slice(1),
                ],
              };
            }

            const updatedFirstPage = {
              ...firstPage,
              messages: [message, ...firstPage.messages],
            };
            return {
              ...oldData,
              pages: [updatedFirstPage, ...oldData.pages.slice(1)],
            };
          },
        );

        // Auto mark as read if message is from someone else
        if (message.senderId !== user.id) {
          socket.emit('message:read', { conversationId: activeConversationId });
        }

        // Clear sender's typing indicator as they just sent their message
        const senderName = message.sender?.name;
        if (senderName) {
          const key = `${message.conversationId}:${senderName}`;
          if (peerTypingTimeoutsRef.current[key]) {
            clearTimeout(peerTypingTimeoutsRef.current[key]);
            delete peerTypingTimeoutsRef.current[key];
          }
          setTypingUser(message.conversationId, senderName, false);
        }
      }

      // 2. Always refresh conversation list to update lastMessageSnippet and unread badge
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.conversations });
    });

    // Handle typing status from peers with automatic TTL expiration
    socket.on(
      'typing:status',
      (payload: {
        conversationId: string;
        userId: string;
        userName: string;
        isTyping: boolean;
      }) => {
        if (payload.userId === user.id) return;
        const key = `${payload.conversationId}:${payload.userName}`;

        // Clear existing timer if any
        if (peerTypingTimeoutsRef.current[key]) {
          clearTimeout(peerTypingTimeoutsRef.current[key]);
          delete peerTypingTimeoutsRef.current[key];
        }

        if (payload.isTyping) {
          setTypingUser(payload.conversationId, payload.userName, true);

          // Auto-expire typing indicator after 2.5s if no new heartbeat received
          peerTypingTimeoutsRef.current[key] = setTimeout(() => {
            setTypingUser(payload.conversationId, payload.userName, false);
            delete peerTypingTimeoutsRef.current[key];
          }, 2500);
        } else {
          setTypingUser(payload.conversationId, payload.userName, false);
        }
      },
    );

    // Handle reaction updates from peers
    socket.on(
      'reaction_updated',
      (payload: {
        messageId: string;
        userId: string;
        emoji: string;
        action: 'add' | 'remove';
      }) => {
        if (!activeConversationId) return;
        queryClient.setQueryData(
          CHAT_QUERY_KEYS.messages(activeConversationId),
          (oldData: { pages: MessagesPageResponse[]; pageParams: unknown[] } | undefined) => {
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
      },
    );

    return () => {
      Object.values(peerTypingTimeoutsRef.current).forEach(clearTimeout);
      peerTypingTimeoutsRef.current = {};
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, activeConversationId, queryClient, setTypingUser]);

  // Handle active conversation room transitions
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected || !activeConversationId) return;

    socket.emit('conversation:join', { conversationId: activeConversationId });
    socket.emit('message:read', { conversationId: activeConversationId });

    return () => {
      socket.emit('typing:stop', { conversationId: activeConversationId });
      socket.emit('conversation:leave', { conversationId: activeConversationId });
    };
  }, [activeConversationId]);

  // Realtime message send via socket
  const sendSocketMessage = useCallback(
    (
      content: string,
      type: MessageType = 'text',
      attachments: unknown[] = [],
      replyToId?: string,
    ) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || !activeConversationId) return;

      socket.emit('message:send', {
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

  // Reaction event emitter
  const emitReaction = useCallback(
    (messageId: string, emoji: string, action: 'add' | 'remove' = 'add') => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) return;

      socket.emit('message_reaction', {
        messageId,
        emoji,
        action,
      });
    },
    [],
  );

  // Typing event emitters
  const emitTyping = useCallback(
    (isTyping: boolean) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected || !activeConversationId) return;

      const userName =
        (user as any)?.name ||
        (user as any)?.profile?.name ||
        user?.email?.split('@')[0] ||
        'User';

      if (isTyping) {
        socket.emit('typing:start', {
          conversationId: activeConversationId,
          userName,
        });

        // Auto-clear typing after 3 seconds of inactivity
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socket.emit('typing:stop', { conversationId: activeConversationId });
        }, 3000);
      } else {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit('typing:stop', { conversationId: activeConversationId });
      }
    },
    [activeConversationId, user],
  );

  // Mark as read
  const markAsRead = useCallback((conversationId: string) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;
    socket.emit('message:read', { conversationId });
  }, []);

  return {
    socket: socketRef.current,
    sendSocketMessage,
    emitReaction,
    emitTyping,
    markAsRead,
  };
}
