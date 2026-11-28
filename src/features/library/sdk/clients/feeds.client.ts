import type { FeedSubscriptionResponse } from '@/features/library/types/core.types';
import { libraryClient, resolveLibraryUrl } from './http.client';

export type { FeedSubscriptionResponse };

export const FeedsService = {
  getSubscriptions: () =>
    libraryClient.get<{ data: FeedSubscriptionResponse[] }>(
      resolveLibraryUrl('ingestion', '/feeds/subscriptions'),
    ),

  subscribe: (data: {
    url: string;
    customTitle?: string;
    cleanupDays?: number;
    cleanupReadAfter?: number;
    cleanupUnreadAfter?: number;
  }) =>
    libraryClient.post<{ data: unknown }>(resolveLibraryUrl('ingestion', '/feeds/subscriptions'), data),

  updateSubscription: (
    feedId: string,
    data: {
      customTitle?: string;
      cleanupDays?: number;
      cleanupReadAfter?: number;
      cleanupUnreadAfter?: number;
      url?: string;
    },
  ) =>
    libraryClient.patch<{ data: unknown }>(resolveLibraryUrl('ingestion', `/feeds/subscriptions/${encodeURIComponent(feedId)}`), data),

  unsubscribe: (feedId: string) =>
    libraryClient.delete<void>(resolveLibraryUrl('ingestion', `/feeds/subscriptions/${encodeURIComponent(feedId)}`)),

  getItems: (
    feedId: string,
    params?: {
      readStatus?: 'read' | 'unread' | 'all';
      limit?: number;
      cursor?: string;
      page?: number;
      search?: string;
      forceRefresh?: boolean;
    },
  ) =>
    libraryClient.get<{
      data: unknown[];
      meta?: {
        hasNextPage: boolean;
        nextCursor: string | null;
        limit: number;
      };
      hasNextPage?: boolean;
      nextCursor?: string | null;
    }>(
      resolveLibraryUrl('ingestion', `/feeds/${encodeURIComponent(feedId)}/items`),
      { params },
    ),

  markItemRead: (itemId: string, isRead = true) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', `/feeds/items/${encodeURIComponent(itemId)}/read`), { isRead }),

  markAllRead: (itemIds: string[]) =>
    libraryClient.post<{ success: boolean }>(resolveLibraryUrl('ingestion', '/feeds/items/mark-all-read'), { itemIds }),

  markFeedAllRead: (feedId: string) =>
    libraryClient.post<{ success: boolean; markedCount?: number }>(
      resolveLibraryUrl('ingestion', `/feeds/${encodeURIComponent(feedId)}/mark-all-read`),
      {},
    ),

  exportOpml: () =>
    libraryClient.get<{ data: { opmlXml: string; count: number } }>(
      resolveLibraryUrl('ingestion', '/feeds/opml/export'),
    ),

  importOpml: (opmlXml: string) =>
    libraryClient.post<{
      data: {
        importedCount: number;
        totalParsed: number;
        subscriptions: FeedSubscriptionResponse[];
      };
    }>(resolveLibraryUrl('ingestion', '/feeds/opml/import'), { opmlXml }),
};

