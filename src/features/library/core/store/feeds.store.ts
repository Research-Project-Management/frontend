import { create } from 'zustand';
import { toast } from 'sonner';
import {
  SavedFeedSubscription,
  FeedReadFilterType,
  FeedRetentionDays,
} from '@/features/library/domain/types/feeds.types';
import type { ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';
import { FeedsService, type FeedSubscriptionResponse } from '@/features/library/sdk/library.client';

export function mapServerFeedSubscriptions(
  subs: FeedSubscriptionResponse[] | undefined | null,
): SavedFeedSubscription[] {
  if (!Array.isArray(subs) || subs.length === 0) return [];
  return subs.map((sub) => {
    const unreadDays = (sub.cleanupUnreadAfter ?? sub.cleanupReadAfter ?? 30) as FeedRetentionDays;
    const readDays = (sub.cleanupReadAfter ?? 7) as FeedRetentionDays;
    return {
      id: sub.feedId || sub.id,
      name: sub.customTitle || sub.feed?.title || 'Academic Feed',
      url: sub.feed?.url || '',
      lastRefreshed: sub.feed?.lastFetchedAt || undefined,
      retentionDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    };
  });
}

interface FeedsStore {
  feeds: SavedFeedSubscription[];
  activeFeedId: string | null;
  selectedFeedEntry: ParsedFeedEntry | null;
  currentFeedEntries: ParsedFeedEntry[];
  readFilter: FeedReadFilterType;
  refreshCounter: number;
  readEntryIds: Set<string>;
  savedEntryIds: string[];
  savingEntryIds: string[];
  isLoadingFeeds: boolean;
  hasInitializedFeeds: boolean;
  hydrateFeeds: (feeds: SavedFeedSubscription[]) => void;
  loadFeeds: (options?: { force?: boolean }) => Promise<void>;
  setActiveFeedId: (id: string | null) => void;
  setSelectedFeedEntry: (entry: ParsedFeedEntry | null) => void;
  setCurrentFeedEntries: (entries: ParsedFeedEntry[]) => void;
  setReadFilter: (filter: FeedReadFilterType) => void;
  triggerRefresh: () => void;
  addFeed: (
    name: string,
    url: string,
    retentionDays?: FeedRetentionDays,
    options?: {
      cleanupReadAfter?: FeedRetentionDays;
      cleanupUnreadAfter?: FeedRetentionDays;
    },
  ) => Promise<SavedFeedSubscription> & SavedFeedSubscription;
  updateFeed: (
    id: string,
    updates: Partial<Omit<SavedFeedSubscription, 'id'>>,
  ) => Promise<void>;
  removeFeed: (id: string) => Promise<void>;
  markEntryAsRead: (entryId: string) => void;
  toggleEntryRead: (entryId: string) => void;
  markAllEntriesAsRead: (entryIds?: string[]) => void;
  isEntryRead: (entryId: string) => boolean;
  markEntrySaved: (id: string) => void;
  setEntrySaving: (id: string, isSaving: boolean) => void;
  isEntrySaved: (
    entry: ParsedFeedEntry | null | undefined,
    libraryItems?: Array<{ doi?: string | null; title?: string | null; url?: string | null }>,
  ) => boolean;
}

export function isFeedEntryInLibrary(
  entry: ParsedFeedEntry | null | undefined,
  savedEntryIds: Iterable<string>,
  libraryItems?: Array<{ doi?: string | null; title?: string | null; url?: string | null }>,
): boolean {
  if (!entry) return false;
  const savedSet = savedEntryIds instanceof Set ? savedEntryIds : new Set(savedEntryIds);
  if (savedSet.has(entry.id)) return true;
  if (!libraryItems || libraryItems.length === 0) return false;
  const normalizedDoi = entry.doi?.trim().toLowerCase();
  const normalizedTitle = entry.title?.trim().toLowerCase();
  const normalizedUrl = entry.url?.trim().toLowerCase();
  for (const item of libraryItems) {
    if (normalizedDoi && item.doi && item.doi.trim().toLowerCase() === normalizedDoi) {
      return true;
    }
    if (normalizedTitle && item.title && item.title.trim().toLowerCase() === normalizedTitle) {
      return true;
    }
    if (normalizedUrl && item.url && item.url.trim().toLowerCase() === normalizedUrl) {
      return true;
    }
  }
  return false;
}

export const useFeedsStore = create<FeedsStore>((set, get) => ({
  feeds: [],
  activeFeedId: null,
  selectedFeedEntry: null,
  currentFeedEntries: [],
  readFilter: 'all',
  refreshCounter: 0,
  readEntryIds: new Set<string>(),
  savedEntryIds: [],
  savingEntryIds: [],
  isLoadingFeeds: false,
  hasInitializedFeeds: false,

  hydrateFeeds: (feeds) => {
    set({
      feeds: Array.isArray(feeds) ? feeds : [],
      isLoadingFeeds: false,
      hasInitializedFeeds: true,
    });
  },

  loadFeeds: async (options) => {
    if (get().isLoadingFeeds || (!options?.force && get().hasInitializedFeeds)) {
      return;
    }
    set({ isLoadingFeeds: true });
    try {
      const res = await FeedsService.getSubscriptions();
      if (res?.data && Array.isArray(res.data)) {
        const mappedFeeds = mapServerFeedSubscriptions(res.data);
        set({
          feeds: mappedFeeds,
          isLoadingFeeds: false,
          hasInitializedFeeds: true,
        });
        return;
      }
    } catch {
      // Backend offline or error: keep current state
    }
    set({ isLoadingFeeds: false, hasInitializedFeeds: true });
  },

  setActiveFeedId: (id) => set({ activeFeedId: id, selectedFeedEntry: null }),

  setSelectedFeedEntry: (entry) => set({ selectedFeedEntry: entry }),

  setCurrentFeedEntries: (entries) => set({ currentFeedEntries: entries }),

  setReadFilter: (filter) => set({ readFilter: filter }),

  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),

  addFeed: (name, url, retentionDays = 30, options) => {
    const trimmedUrl = url.trim();
    const trimmedName =
      name.trim() || trimmedUrl.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 42);
    const unreadDays = (options?.cleanupUnreadAfter ?? retentionDays ?? 30) as FeedRetentionDays;
    const readDays = (options?.cleanupReadAfter ?? 7) as FeedRetentionDays;

    const localId = `feed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newFeed: SavedFeedSubscription = {
      id: localId,
      name: trimmedName,
      url: trimmedUrl,
      retentionDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    };
    const nextFeeds = [...get().feeds.filter((f) => f.id !== localId), newFeed];
    set({ feeds: nextFeeds, activeFeedId: localId });

    const syncPromise = (async (): Promise<SavedFeedSubscription> => {
      try {
        const res = await FeedsService.subscribe({
          url: trimmedUrl,
          customTitle: trimmedName,
          cleanupDays: unreadDays,
          cleanupReadAfter: readDays,
          cleanupUnreadAfter: unreadDays,
        });
        const sub = (res?.data as { feedId?: string; id?: string }) || {};
        const serverId = sub.feedId || sub.id;
        if (serverId && serverId !== localId) {
          const updatedFeed: SavedFeedSubscription = {
            ...(get().feeds.find((f) => f.id === localId) ?? newFeed),
            id: serverId,
          };
          set({
            feeds: get().feeds.map((f) => (f.id === localId ? updatedFeed : f)),
            activeFeedId: get().activeFeedId === localId ? serverId : get().activeFeedId,
          });
          return updatedFeed;
        }
      } catch {
        // Fallback to local feed state
      }
      return get().feeds.find((f) => f.id === localId) ?? newFeed;
    })();

    return Object.assign(syncPromise, newFeed);
  },

  updateFeed: async (id, updates) => {
    const nextFeeds = get().feeds.map((f) =>
      f.id === id
        ? {
            ...f,
            ...updates,
            ...(updates.cleanupUnreadAfter !== undefined
              ? { retentionDays: updates.cleanupUnreadAfter }
              : updates.retentionDays !== undefined
                ? { cleanupUnreadAfter: updates.retentionDays }
                : {}),
          }
        : f,
    );
    set({ feeds: nextFeeds });

    // Sync with backend API
    await FeedsService.updateSubscription(id, {
      customTitle: updates.name,
      cleanupDays: updates.cleanupUnreadAfter ?? updates.retentionDays,
      cleanupReadAfter: updates.cleanupReadAfter,
      cleanupUnreadAfter: updates.cleanupUnreadAfter ?? updates.retentionDays,
      url: updates.url,
    }).catch(() => {});
  },

  removeFeed: async (id) => {
    try {
      await FeedsService.unsubscribe(id);
    } catch {}

    const nextFeeds = get().feeds.filter((f) => f.id !== id);
    const nextActiveId =
      get().activeFeedId === id ? nextFeeds[0]?.id ?? null : get().activeFeedId;

    set({ feeds: nextFeeds, activeFeedId: nextActiveId });
  },

  markEntryAsRead: (entryId: string) => {
    const current = get().readEntryIds;
    if (current.has(entryId)) return;
    const next = new Set(current);
    next.add(entryId);
    set({ readEntryIds: next });

    // Server-authoritative state sync
    FeedsService.markItemRead(entryId, true).catch(() => {});
  },

  toggleEntryRead: (entryId: string) => {
    const current = get().readEntryIds;
    const isNowRead = !current.has(entryId);
    const next = new Set(current);
    if (!isNowRead) {
      next.delete(entryId);
    } else {
      next.add(entryId);
    }
    set({ readEntryIds: next });

    // Server-authoritative state sync
    FeedsService.markItemRead(entryId, isNowRead).catch(() => {});
  },

  markAllEntriesAsRead: (entryIds?: string[]) => {
    const resolvedIds =
      entryIds && entryIds.length > 0
        ? entryIds
        : get().currentFeedEntries.map((e) => e.id);
    if (resolvedIds.length === 0) return;

    const next = new Set(get().readEntryIds);
    for (const id of resolvedIds) {
      if (id) next.add(id);
    }
    set({ readEntryIds: next });

    // Server-authoritative state sync
    FeedsService.markAllRead(resolvedIds).catch(() => {});
  },

  isEntryRead: (entryId: string) => {
    return get().readEntryIds.has(entryId);
  },

  markEntrySaved: (id: string) =>
    set((state) =>
      state.savedEntryIds.includes(id)
        ? state
        : { savedEntryIds: [...state.savedEntryIds, id] },
    ),

  setEntrySaving: (id: string, isSaving: boolean) =>
    set((state) => {
      const exists = state.savingEntryIds.includes(id);
      if (isSaving && !exists) {
        return { savingEntryIds: [...state.savingEntryIds, id] };
      }
      if (!isSaving && exists) {
        return { savingEntryIds: state.savingEntryIds.filter((item) => item !== id) };
      }
      return state;
    }),

  isEntrySaved: (entry, libraryItems) =>
    isFeedEntryInLibrary(entry, get().savedEntryIds, libraryItems),
}));
