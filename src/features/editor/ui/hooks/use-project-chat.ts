'use client';

/**
 * use-project-chat.ts
 *
 * Real-time Collaborator Chat hook (Overleaf Parity):
 * - Connects to Backend ManuscriptRealtimeGateway (/manuscripts)
 * - Joins room project:${projectId}
 * - Loads past project messages and streams incoming chat messages
 * - Increments unread counter when tab is in background
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getEffectiveBaseUrl, getAuthToken } from '@/shared/lib/api';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useDocumentCollaborationStore } from '../../store/collaboration.store';

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

export function useProjectChat(projectId: string | undefined | null, isTabActive: boolean) {
  const [messages, setMessages] = useState<ProjectChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const incrementUnread = useDocumentCollaborationStore((s) => s.incrementUnreadChatCount);
  const resetUnread = useDocumentCollaborationStore((s) => s.resetUnreadChatCount);

  // Clear unread count when tab is active
  useEffect(() => {
    if (isTabActive) {
      resetUnread();
    }
  }, [isTabActive, resetUnread]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const rawBase = (getEffectiveBaseUrl() || '').replace(/\/$/, '');
    const socketUrl = rawBase ? `${rawBase}/manuscripts` : '/manuscripts';
    const token = getAuthToken() || undefined;

    const userExtra = user as (typeof user & { avatar?: string; image?: string; color?: string }) | null;
    const authPayload: Record<string, any> = {
      token,
      userId: user?.id,
      name: user?.name || user?.email || 'Collaborator',
      avatar: userExtra?.avatar || userExtra?.image,
      color: userExtra?.color,
    };

    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: authPayload,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);

      // Join project room
      socket.emit('project:join', { projectId }, () => {
        // Fetch recent chat history
        socket.emit('project:chat:history', { projectId }, (res?: { success?: boolean; messages?: ProjectChatMessage[] }) => {
          if (res?.success && Array.isArray(res.messages)) {
            setMessages(res.messages);
          }
        });
      });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('project:chat:message', (msg: ProjectChatMessage) => {
      if (msg.projectId === projectId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // If message is from someone else and tab is not active, increment unread badge
        if (!isTabActive && msg.userId !== user?.id) {
          incrementUnread();
        }
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId, user, isTabActive, incrementUnread]);

  const sendMessage = useCallback(
    async (text: string, replyToId?: string): Promise<boolean> => {
      const socket = socketRef.current;
      if (!socket || !projectId || !text.trim()) return false;

      setIsSending(true);
      return new Promise((resolve) => {
        socket.emit(
          'project:chat:send',
          { projectId, text: text.trim(), replyToId },
          (res?: { success?: boolean; message?: ProjectChatMessage; error?: string }) => {
            setIsSending(false);
            if (res?.success && res.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === res.message!.id)) return prev;
                return [...prev, res.message!];
              });
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
      });
    },
    [projectId]
  );

  return {
    messages,
    isConnected,
    isSending,
    sendMessage,
    currentUser: user,
  };
}
