/**
 * notifications.client.ts
 *
 * Review mention notification bundling & digest sub-API.
 */

import * as api from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
} from '@/features/editor/domain/collaboration/notification-digest';

export type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
};

export const notifications = {
  getPendingBundles: async (): Promise<PendingBundleInfo[]> => {
    try {
      const data = await api.apiGet<{ bundles: PendingBundleInfo[] }>(
        `${PAGES_API_BASE}/notifications/bundles`,
      );
      return data.bundles || [];
    } catch {
      return [];
    }
  },

  flushBundle: async (
    bundleKey?: string,
    spaceId?: string,
    pageId?: string,
  ): Promise<NotificationDigest | null> => {
    const payload: { bundleKey?: string; spaceId?: string; pageId?: string } = {};
    if (bundleKey) payload.bundleKey = bundleKey;
    if (spaceId) payload.spaceId = spaceId;
    if (pageId) payload.pageId = pageId;

    const data = await api.apiPost<{ digest?: NotificationDigest | null }>(
      `${PAGES_API_BASE}/notifications/bundles/flush`,
      payload,
    );
    return data?.digest || null;
  },

  getDigestHistory: async (limit = 20): Promise<NotificationDigest[]> => {
    try {
      const data = await api.apiGet<{ digests: NotificationDigest[] }>(
        `${PAGES_API_BASE}/notifications/digests`,
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
        `${PAGES_API_BASE}/notifications/settings`,
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
        `${PAGES_API_BASE}/notifications/settings`,
        settings,
      );
      return data.settings || { enabled: false, windowMinutes: 10 };
    } catch {
      return { enabled: false, windowMinutes: 10 };
    }
  },
};
