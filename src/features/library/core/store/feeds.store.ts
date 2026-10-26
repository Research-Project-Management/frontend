import { create } from 'zustand';
import { toast } from 'sonner';
import {
  SavedFeedSubscription,
  DEFAULT_ACADEMIC_FEEDS,
  FeedReadFilterType,
  FeedRetentionDays,
} from '@/features/library/domain/types/feeds.types';
import type { ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';
import { FeedsService } from '@/features/library/sdk/library.client';

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
  loadFeeds: () => Promise<void>;
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
  ) => SavedFeedSubscription;
  updateFeed: (id: string, updates: Partial<Omit<SavedFeedSubscription, 'id'>>) => void;
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
  feeds: DEFAULT_ACADEMIC_FEEDS,
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

  loadFeeds: async () => {
    if (get().isLoadingFeeds || get().hasInitializedFeeds) {
      return;
    }
    set({ isLoadingFeeds: true });
    try {
      const res = await FeedsService.getSubscriptions();
      if (res?.data && Array.isArray(res.data)) {
        if (res.data.length > 0) {
          const mappedFeeds: SavedFeedSubscription[] = res.data.map((sub) => {
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
          set({ feeds: mappedFeeds, isLoadingFeeds: false, hasInitializedFeeds: true });
          return;
        }
        // Server returned an empty subscription list: if already initialized, preserve empty list;
        // otherwise keep defaults and mark initialized so subsequent empty checks don't overwrite user deletions.
        if (get().hasInitializedFeeds) {
          set({ feeds: [], isLoadingFeeds: false });
          return;
        }
        set({ isLoadingFeeds: false, hasInitializedFeeds: true });
        return;
      }
    } catch {
      // Backend offline or error: use defaults if not yet initialized
    }
    if (!get().hasInitializedFeeds) {
      set({ feeds: DEFAULT_ACADEMIC_FEEDS, isLoadingFeeds: false, hasInitializedFeeds: true });
    } else {
      set({ isLoadingFeeds: false });
    }
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
    const id = `feed-${Date.now()}`;
    const unreadDays = (options?.cleanupUnreadAfter ?? retentionDays ?? 30) as FeedRetentionDays;
    const readDays = (options?.cleanupReadAfter ?? 7) as FeedRetentionDays;

    const newFeed: SavedFeedSubscription = {
      id,
      name: trimmedName,
      url: trimmedUrl,
      retentionDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    };
    const nextFeeds = [...get().feeds.filter((f) => f.id !== id), newFeed];

    set({ feeds: nextFeeds, activeFeedId: id });

    // Sync with backend asynchronously in background
    FeedsService.subscribe({
      url: trimmedUrl,
      customTitle: trimmedName,
      cleanupDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    })
      .then((res) => {
        const sub = (res?.data as { feedId?: string; id?: string }) || {};
        const serverId = sub.feedId || sub.id;
        if (serverId && serverId !== id) {
          set((state) => ({
            feeds: state.feeds.map((f) => (f.id === id ? { ...f, id: serverId } : f)),
            activeFeedId: state.activeFeedId === id ? serverId : state.activeFeedId,
          }));
        }
      })
      .catch(() => {});

    return newFeed;
  },

  updateFeed: (id, updates) => {
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
    FeedsService.updateSubscription(id, {
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
