/**
 * notification-bundler.service.ts
 *
 * Frontend client service for Overleaf-style 10-minute review notification bundling:
 * - Query pending review bundles with countdowns
 * - 1-click manual flush
 * - Notification digest history
 * - Bundling window settings
 */

import { apiGet } from '@/shared/lib/api';
import type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
} from '@/features/editor/domain/collaboration/notification-digest';

// Notification bundling feature is currently disabled (feature not deployed yet)
const NOTIFICATIONS_BUNDLER_ENABLED = false;

export const notificationBundlerService = {
  getPendingBundles: async (): Promise<PendingBundleInfo[]> => {
    if (!NOTIFICATIONS_BUNDLER_ENABLED) return [];
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
    _scopeId?: string,
    _projectId?: string,
  ): Promise<NotificationDigest | null> => {
    if (!NOTIFICATIONS_BUNDLER_ENABLED) return null;
    return null;
  },

  getDigestHistory: async (_limit = 20): Promise<NotificationDigest[]> => {
    if (!NOTIFICATIONS_BUNDLER_ENABLED) return [];
    return [];
  },

  getSettings: async (): Promise<NotificationBundlingSettings> => {
    return { enabled: false, windowMinutes: 10 };
  },

  updateSettings: async (
    _settings: Partial<NotificationBundlingSettings>,
  ): Promise<NotificationBundlingSettings> => {
    return { enabled: false, windowMinutes: 10 };
  },
};
