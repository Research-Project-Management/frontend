/**
 * notification-bundler.service.ts
 *
 * Frontend client service for Overleaf-style 10-minute review notification bundling:
 * - Query pending review bundles with countdowns
 * - 1-click manual flush
 * - Notification digest history
 * - Bundling window settings
 */

import { apiGet, apiPost, apiPut } from '@/shared/lib/api';
import type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
} from '../utils/notification-digest.util';

export const notificationBundlerService = {
  getPendingBundles: async (): Promise<PendingBundleInfo[]> => {
    try {
      const data = await apiGet<{ bundles: PendingBundleInfo[] }>(
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
    const data = await apiPost<{ digest: NotificationDigest | null }>(
      '/api/documents/notifications/bundles/flush',
      { scopeId, projectId },
    );
    return data.digest;
  },

  getDigestHistory: async (limit = 20): Promise<NotificationDigest[]> => {
    try {
      const data = await apiGet<{ digests: NotificationDigest[] }>(
        `/api/documents/notifications/digests?limit=${limit}`,
      );
      return data.digests || [];
    } catch {
      return [];
    }
  },

  getSettings: async (): Promise<NotificationBundlingSettings> => {
    try {
      const data = await apiGet<{ settings: NotificationBundlingSettings }>(
        '/api/documents/notifications/settings',
      );
      return data.settings;
    } catch {
      return { enabled: true, windowMinutes: 10 };
    }
  },

  updateSettings: async (
    settings: Partial<NotificationBundlingSettings>,
  ): Promise<NotificationBundlingSettings> => {
    const data = await apiPut<{ settings: NotificationBundlingSettings }>(
      '/api/documents/notifications/settings',
      settings,
    );
    return data.settings;
  },
};
