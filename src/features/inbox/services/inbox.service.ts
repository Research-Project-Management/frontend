/**
 * features/inbox/services/inbox.service.ts
 * API Service for fetching, managing, and reacting to notifications.
 */

import { apiGet, apiPatch, apiDelete, apiPost } from '@/shared/lib/api';
import type { NotificationItem } from '../types/inbox.types';

export interface QueryNotificationsParams {
  isRead?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

export const inboxService = {
  /**
   * Fetch list of notifications for the current authenticated user.
   */
  getNotifications: async (params?: QueryNotificationsParams): Promise<NotificationItem[]> => {
    try {
      const data = await apiGet<NotificationItem[]>('/notifications', {
        params: {
          isRead: params?.isRead !== undefined ? String(params.isRead) : undefined,
          type: params?.type,
          limit: params?.limit ? String(params.limit) : undefined,
          offset: params?.offset ? String(params.offset) : undefined,
        },
      });
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  },

  /**
   * Get unread notification badge count.
   */
  getUnreadCount: async (): Promise<number> => {
    try {
      const res = await apiGet<{ count: number }>('/notifications/unread-count');
      return res?.count ?? 0;
    } catch {
      return 0;
    }
  },

  /**
   * Mark a specific notification as read.
   */
  markAsRead: async (id: string): Promise<boolean> => {
    try {
      await apiPatch(`/notifications/${id}/read`);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Mark all notifications as read for current user.
   */
  markAllAsRead: async (): Promise<number> => {
    try {
      const res = await apiPatch<{ count: number }>('/notifications/read-all');
      return res?.count ?? 0;
    } catch {
      return 0;
    }
  },

  /**
   * Delete or dismiss a notification by ID.
   */
  deleteNotification: async (id: string): Promise<boolean> => {
    try {
      await apiDelete(`/notifications/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Accept project invitation directly from the Inbox.
   */
  acceptInvitation: async (tokenOrId: string): Promise<{ success: boolean; projectId?: string }> => {
    try {
      const res = await apiPost<{ projectId?: string }>(`/projects/invitations/accept/${tokenOrId}`, {});
      return { success: true, projectId: res?.projectId };
    } catch {
      // Fallback join by code if needed
      try {
        const res = await apiPost<{ projectId?: string }>('/projects/join', { code: tokenOrId });
        return { success: true, projectId: res?.projectId };
      } catch {
        return { success: false };
      }
    }
  },

  /**
   * Decline project invitation.
   */
  declineInvitation: async (invitationId: string): Promise<boolean> => {
    try {
      await apiPost(`/projects/invitations/${invitationId}/decline`, {});
      return true;
    } catch {
      return false;
    }
  },
};
