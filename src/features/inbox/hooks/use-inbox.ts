'use client';

/**
 * features/inbox/hooks/use-inbox.ts
 * Real-time Reactive Hook for Inbox notifications across All, Project, and Pages (Editor).
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
      // Ignore network errors on initial load
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 1. Initial Load & Polling Fallback (every 45s)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // 2. Real-Time Socket.IO Synchronization (/notifications namespace)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const baseUrl = getEffectiveBaseUrl();
    const token = getAuthToken();

    const socket = io(`${baseUrl}/notifications`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: {
        token: token || undefined,
        userId: user?.id || undefined,
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Re-fetch latest to ensure zero state drift on reconnect
      fetchNotifications();
    });

    // Handle new incoming notification
    socket.on(
      'notification:new',
      (payload: { notification?: NotificationItem; unreadCount?: number }) => {
        if (payload?.notification) {
          const newNotif = payload.notification;
          setNotifications((prev) => {
            // Avoid duplicate by ID
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });

          // Show non-intrusive toast alert
          const actorName = newNotif.messageOpts?.actorName || newNotif.messageOpts?.inviterName || 'Someone';
          const projectName = newNotif.messageOpts?.projectName || 'Manuscript';

          if (newNotif.type === 'mention') {
            toast.info(`${actorName} mentioned you in ${projectName}`);
          } else if (newNotif.type === 'comment_reply') {
            toast.info(`${actorName} replied to your comment in ${projectName}`);
          } else if (newNotif.type === 'project_invite') {
            toast.info(`${actorName} invited you to project ${projectName}`);
          } else if (newNotif.type === 'thread_resolved') {
            toast.info(`Comment thread resolved in ${projectName}`);
          }
        }

        if (typeof payload?.unreadCount === 'number') {
          setUnreadCount(payload.unreadCount);
        } else {
          setUnreadCount((c) => c + 1);
        }
      }
    );

    // Handle live badge count updates
    socket.on('notification:count', (payload: { unreadCount: number }) => {
      if (typeof payload?.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
      }
    });

    // Handle notification dismissed by key or ID
    socket.on('notification:dismissed', (payload: { id?: string; key?: string }) => {
      if (payload?.id) {
        setNotifications((prev) => prev.filter((n) => n.id !== payload.id));
      } else if (payload?.key) {
        setNotifications((prev) => prev.filter((n) => n.key !== payload.key));
      }
      inboxService.getUnreadCount().then(setUnreadCount);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, fetchNotifications]);

  // 3. Mark Single Notification as Read
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic Update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    await inboxService.markAsRead(id);
  }, []);

  // 4. Mark All as Read
  const markAllAsRead = useCallback(async () => {
    // Optimistic Update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    setUnreadCount(0);

    await inboxService.markAllAsRead();
  }, []);

  // 5. Delete / Dismiss Notification
  const deleteNotification = useCallback(async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    await inboxService.deleteNotification(id);
  }, [notifications]);

  // 6. Compute Total Counts per Category
  const categoryCounts = useMemo(() => {
    let project = 0;
    let pages = 0;

    for (const item of notifications) {
      const cat = getNotificationCategory(item);
      if (cat === 'project') project++;
      else if (cat === 'pages') pages++;
    }

    return {
      all: notifications.length,
      project,
      pages,
    };
  }, [notifications]);

  // 7. Compute Unread Counts per Category (for Tab badges)
  const unreadCategoryCounts = useMemo(() => {
    let project = 0;
    let pages = 0;

    for (const item of notifications) {
      if (!item.isRead) {
        const cat = getNotificationCategory(item);
        if (cat === 'project') project++;
        else if (cat === 'pages') pages++;
      }
    }

    return {
      all: notifications.filter((n) => !n.isRead).length,
      project,
      pages,
    };
  }, [notifications]);

  // 8. Filter notifications by active tab
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
