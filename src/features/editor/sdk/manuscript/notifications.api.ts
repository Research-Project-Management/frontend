/**
 * notifications.api.ts
 *
 * Review Notification Bundling Sub-API (Part of manuscriptService SDK).
 * Implements Overleaf-parity 10-minute review notification bundling endpoints.
 */

import * as api from '@/shared/lib/api';
import type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
} from '@/features/editor/domain/collaboration/notification-digest';

export const notifications = {
  getPendingBundles: async (): Promise<PendingBundleInfo[]> => {
    try {
      const data = await api.apiGet<{ bundles: PendingBundleInfo[] }>(
        '/api/documents/notifications/bundles',
      );
      return data.bundles || [];
    } catch {
      return [];
    }
  },

  flushBundle: async (
    scopeId?: string,
    projectId?: string,
  ): Promise<NotificationDigest | null> => {
    try {
      const data = await api.apiPost<{ digest: NotificationDigest }>(
        '/api/documents/notifications/bundles/flush',
        { scopeId, projectId },
      );
      return data.digest || null;
    } catch {
      return null;
    }
  },

  getDigestHistory: async (limit = 20): Promise<NotificationDigest[]> => {
    try {
      const data = await api.apiGet<{ digests: NotificationDigest[] }>(
        '/api/documents/notifications/digests',
        { params: { limit } },
      );
      return data.digests || [];
    } catch {
      return [];
    }
  },

  getSettings: async (): Promise<NotificationBundlingSettings> => {
    try {
      const data = await api.apiGet<{ settings: NotificationBundlingSettings }>(
        '/api/documents/notifications/settings',
      );
      return data.settings || { enabled: false, windowMinutes: 10 };
    } catch {
      return { enabled: false, windowMinutes: 10 };
    }
  },

  updateSettings: async (
    settings: Partial<NotificationBundlingSettings>,
  ): Promise<NotificationBundlingSettings> => {
    try {
      const data = await api.apiPut<{ settings: NotificationBundlingSettings }>(
        '/api/documents/notifications/settings',
        settings,
      );
      return data.settings || { enabled: false, windowMinutes: 10 };
    } catch {
      return { enabled: false, windowMinutes: 10 };
    }
  },
};

export const notificationBundlerService = notifications;
