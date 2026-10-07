'use client';

/**
 * features/shell/hooks/use-inbox.ts
 * Real-time Reactive Hook for Inbox notifications across All, Project, and Pages (Editor).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { getEffectiveBaseUrl, getAuthToken } from '@/shared/lib/api';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { inboxService } from '../services/inbox.service';
import {
  NotificationItem,
  InboxCategory,
  getNotificationCategory,
} from '../types/inbox.types';
import { toast } from 'sonner';

export interface UseInboxReturn {
  notifications: NotificationItem[];
  filteredNotifications: NotificationItem[];
  activeCategory: InboxCategory;
  setActiveCategory: (cat: InboxCategory) => void;
  isLoading: boolean;
  unreadCount: number;
  categoryCounts: {
    all: number;
    project: number;
    pages: number;
  };
  unreadCategoryCounts: {
    all: number;
    project: number;
    pages: number;
  };
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useInbox(initialCategory: InboxCategory = 'all'): UseInboxReturn {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<InboxCategory>(initialCategory);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const [items, count] = await Promise.all([
        inboxService.getNotifications({ limit: 100 }),
        inboxService.getUnreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } catch {
      // Graceful fallback to empty
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch on mount or user change
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user, fetchNotifications]);

  // WebSocket Subscription for Real-time In-app Notifications
  useEffect(() => {
    if (!user?.id) return;

    const baseUrl = getEffectiveBaseUrl();
    const token = getAuthToken();

    try {
      const socket = io(baseUrl, {
        path: '/socket.io',
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('subscribe:user', { userId: user.id });
      });

      socket.on('notification:new', (newNotification: NotificationItem) => {
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Friendly Sonner toast notification
        const title =
          newNotification.templateKey === 'project_invite'
            ? 'New Project Invitation'
            : newNotification.templateKey.startsWith('pages_')
            ? 'New Manuscript Activity'
            : 'New Notification';

        toast.info(title, {
          description:
            newNotification.messageOpts?.snippet ||
            newNotification.messageOpts?.projectName ||
            'You have received an update.',
        });
      });

      socket.on('notification:read', ({ id }: { id: string }) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      });

      socket.on('notification:read-all', () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      });

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    } catch (e) {
      console.warn('Could not establish real-time inbox socket:', e);
    }
  }, [user?.id]);

  // Actions
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    await inboxService.markAsRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    await inboxService.markAllAsRead();
    toast.success('All notifications marked as read');
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    await inboxService.deleteNotification(id);
    toast.success('Notification removed');
  }, [notifications]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: notifications.length, project: 0, pages: 0 };
    for (const item of notifications) {
      const cat = getNotificationCategory(item);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [notifications]);

  // Unread counts per category
  const unreadCategoryCounts = useMemo(() => {
    const unread = { all: unreadCount, project: 0, pages: 0 };
    for (const item of notifications) {
      if (!item.isRead) {
        const cat = getNotificationCategory(item);
        unread[cat] = (unread[cat] || 0) + 1;
      }
    }
    return unread;
  }, [notifications, unreadCount]);

  // Filtered notifications by selected tab
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    return notifications.filter((item) => getNotificationCategory(item) === activeCategory);
  }, [notifications, activeCategory]);

  return {
    notifications,
    filteredNotifications,
    activeCategory,
    setActiveCategory,
    isLoading,
    unreadCount,
    categoryCounts,
    unreadCategoryCounts,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
}

/**
 * Lightweight, cached unread badge count hook for topbars and account menus.
 * Avoids opening real-time socket connections and fetching 100 items.
 */
export function useUnreadNotificationCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    queryFn: () => inboxService.getUnreadCount(),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
