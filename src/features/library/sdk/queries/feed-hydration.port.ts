import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';

export interface FeedHydrationObserver {
  onServerFeedsHydrated: (feeds: SavedFeedSubscription[]) => void;
  onReadEntriesHydrated: (entryIds: Iterable<string>) => void;
  onLoadFeedsFallback?: (options?: { force?: boolean }) => Promise<SavedFeedSubscription[]>;
  onAddFeed?: (
    name: string,
    url: string,
    retentionDays?: SavedFeedSubscription['retentionDays'],
    options?: {
      cleanupReadAfter?: SavedFeedSubscription['cleanupReadAfter'];
      cleanupUnreadAfter?: SavedFeedSubscription['cleanupUnreadAfter'];
    },
  ) => Promise<SavedFeedSubscription>;
  onUpdateFeed?: (
    id: string,
    updates: Partial<Omit<SavedFeedSubscription, 'id'>>,
  ) => Promise<void>;
  onRemoveFeed?: (id: string) => Promise<void>;
  getFeeds?: () => SavedFeedSubscription[];
}

let activeObserver: FeedHydrationObserver | null = null;
let draftCacheClearListener: ((groupKey?: string) => void) | null = null;

export function registerFeedHydrationObserver(observer: FeedHydrationObserver): void {
  activeObserver = observer;
}

export function registerDraftCacheClearListener(
  listener: (groupKey?: string) => void,
): void {
  draftCacheClearListener = listener;
}

export function notifyServerFeedsHydrated(feeds: SavedFeedSubscription[]): void {
  activeObserver?.onServerFeedsHydrated(feeds);
}

export function notifyReadEntriesHydrated(entryIds: Iterable<string>): void {
  activeObserver?.onReadEntriesHydrated(entryIds);
}

export async function invokeLoadFeedsFallback(options?: {
  force?: boolean;
}): Promise<SavedFeedSubscription[]> {
  if (activeObserver?.onLoadFeedsFallback) {
    return activeObserver.onLoadFeedsFallback(options);
  }
  return activeObserver?.getFeeds?.() ?? [];
}

export async function invokeAddFeed(
  name: string,
  url: string,
  retentionDays?: SavedFeedSubscription['retentionDays'],
  options?: {
    cleanupReadAfter?: SavedFeedSubscription['cleanupReadAfter'];
    cleanupUnreadAfter?: SavedFeedSubscription['cleanupUnreadAfter'];
  },
): Promise<SavedFeedSubscription> {
  if (!activeObserver?.onAddFeed) {
    throw new Error('FeedHydrationObserver.onAddFeed is not registered');
  }
  return activeObserver.onAddFeed(name, url, retentionDays, options);
}

export async function invokeUpdateFeed(
  id: string,
  updates: Partial<Omit<SavedFeedSubscription, 'id'>>,
): Promise<void> {
  await activeObserver?.onUpdateFeed?.(id, updates);
}

export async function invokeRemoveFeed(id: string): Promise<void> {
  await activeObserver?.onRemoveFeed?.(id);
}

export function getRegisteredFeedsSnapshot(): SavedFeedSubscription[] {
  return activeObserver?.getFeeds?.() ?? [];
}

export function notifyDraftCacheCleared(groupKey?: string): void {
  draftCacheClearListener?.(groupKey);
}
