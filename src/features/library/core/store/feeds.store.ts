import { create } from 'zustand';
import {
  SavedFeedSubscription,
  FeedReadFilterType,
  FeedRetentionDays,
} from '@/features/library/domain/types/feeds.types';
import { cleanDoi } from '@/features/library/domain/identifiers';
import {
  mapServerFeedSubscriptions,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser.domain';
import { FeedsService } from '@/features/library/sdk/library.client';
import { registerFeedHydrationObserver } from '@/features/library/sdk/queries/feed-hydration.port';

export { mapServerFeedSubscriptions };

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
  hydrateReadEntries: (entryIds: Iterable<string>) => void;
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
  markFeedAsRead: (feedId: string) => Promise<void>;
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
  const serverFlags = entry as { isSaved?: boolean; savedItemId?: string | null };
  if (serverFlags.isSaved === true || Boolean(serverFlags.savedItemId)) {
    return true;
  }
  const savedSet = savedEntryIds instanceof Set ? savedEntryIds : new Set(savedEntryIds);
  if (savedSet.has(entry.id)) return true;
  if (!libraryItems || libraryItems.length === 0) return false;
  const normalizedDoi = cleanDoi(entry.doi).toLowerCase();
  const normalizedTitle = entry.title?.trim().toLowerCase();
  const normalizedUrl = entry.url?.trim().toLowerCase();
  for (const item of libraryItems) {
    if (normalizedDoi && item.doi && cleanDoi(item.doi).toLowerCase() === normalizedDoi) {
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

function shouldRollbackOptimisticReadUpdate(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : '';
  return Boolean(msg && !msg.includes('Network Error') && !msg.includes('fetch'));
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

  hydrateReadEntries: (entryIds) => {
    const current = get().readEntryIds;
    let changed = false;
    const next = new Set(current);
    for (const id of entryIds) {
      if (id && !next.has(id)) {
        next.add(id);
        changed = true;
      }
    }
    if (changed) {
      set({ readEntryIds: next });
    }
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

  setCurrentFeedEntries: (entries) => {
    const serverReadIds: string[] = [];
    for (const entry of entries || []) {
      if (entry?.id && entry.isRead === true && !get().readEntryIds.has(entry.id)) {
        serverReadIds.push(entry.id);
      }
    }
    if (serverReadIds.length > 0) {
      const nextRead = new Set(get().readEntryIds);
      for (const id of serverReadIds) nextRead.add(id);
      set({ currentFeedEntries: entries, readEntryIds: nextRead });
      return;
    }
    set({ currentFeedEntries: entries });
  },

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
    const previousFeeds = get().feeds;
    const nextFeeds = previousFeeds.map((f) =>
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
    try {
      const req = FeedsService?.updateSubscription?.(id, {
        customTitle: updates.name,
        cleanupDays: updates.cleanupUnreadAfter ?? updates.retentionDays,
        cleanupReadAfter: updates.cleanupReadAfter,
        cleanupUnreadAfter: updates.cleanupUnreadAfter ?? updates.retentionDays,
        url: updates.url,
      });
      if (req && typeof req.then === 'function') {
        await req;
      }
    } catch (err) {
      if (!id.startsWith('feed-')) {
        set({ feeds: previousFeeds });
        throw err;
      }
    }
  },

  removeFeed: async (id) => {
    const previousFeeds = get().feeds;
    const previousActiveId = get().activeFeedId;
    const nextFeeds = previousFeeds.filter((f) => f.id !== id);
    const nextActiveId =
      previousActiveId === id ? nextFeeds[0]?.id ?? null : previousActiveId;

    set({ feeds: nextFeeds, activeFeedId: nextActiveId });

    try {
      const req = FeedsService?.unsubscribe?.(id);
      if (req && typeof req.then === 'function') {
        await req;
      }
    } catch (err) {
      if (!id.startsWith('feed-')) {
        set({ feeds: previousFeeds, activeFeedId: previousActiveId });
        throw err;
      }
    }
  },

  markEntryAsRead: (entryId: string) => {
    const current = get().readEntryIds;
    if (current.has(entryId)) return;
    const previous = new Set(current);
    const next = new Set(current);
    next.add(entryId);
    set({ readEntryIds: next });

    try {
      const req = FeedsService?.markItemRead?.(entryId, true);
      if (req && typeof req.catch === 'function') {
        req.catch((err: unknown) => {
          if (shouldRollbackOptimisticReadUpdate(err)) {
            set({ readEntryIds: previous });
          }
        });
      }
    } catch {
      // Offline / unmocked test fallback
    }
  },

  toggleEntryRead: (entryId: string) => {
    const current = get().readEntryIds;
    const previous = new Set(current);
    const isNowRead = !current.has(entryId);
    const next = new Set(current);
    if (!isNowRead) {
      next.delete(entryId);
    } else {
      next.add(entryId);
    }
    set({ readEntryIds: next });

    try {
      const req = FeedsService?.markItemRead?.(entryId, isNowRead);
      if (req && typeof req.catch === 'function') {
        req.catch((err: unknown) => {
          if (shouldRollbackOptimisticReadUpdate(err)) {
            set({ readEntryIds: previous });
          }
        });
      }
    } catch {
      // Offline / unmocked test fallback
    }
  },

  markAllEntriesAsRead: (entryIds?: string[]) => {
    const resolvedIds =
      entryIds && entryIds.length > 0
        ? entryIds
        : get().currentFeedEntries.map((e) => e.id);
    if (resolvedIds.length === 0) return;

    const previous = new Set(get().readEntryIds);
    const next = new Set(previous);
    for (const id of resolvedIds) {
      if (id) next.add(id);
    }
    set({ readEntryIds: next });

    try {
      const req = FeedsService?.markAllRead?.(resolvedIds);
      if (req && typeof req.catch === 'function') {
        req.catch((err: unknown) => {
          if (shouldRollbackOptimisticReadUpdate(err)) {
            set({ readEntryIds: previous });
          }
        });
      }
    } catch {
      // Offline / unmocked test fallback
    }
  },

  markFeedAsRead: async (feedId: string) => {
    const res = await FeedsService.getItems(feedId);
    const items = (res?.data as Array<{ id?: string; guid?: string; url?: string }>) || [];
    const itemIds = items
      .map((it) => it.id || it.guid || it.url)
      .filter(Boolean) as string[];
    if (itemIds.length > 0) {
      get().markAllEntriesAsRead(itemIds);
    } else {
      get().markAllEntriesAsRead();
    }
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

registerFeedHydrationObserver({
  onServerFeedsHydrated: (feeds) => useFeedsStore.getState().hydrateFeeds(feeds),
  onReadEntriesHydrated: (entryIds) => useFeedsStore.getState().hydrateReadEntries(entryIds),
  onLoadFeedsFallback: async (options) => {
    await useFeedsStore.getState().loadFeeds(options);
    return useFeedsStore.getState().feeds;
  },
  onAddFeed: (name, url, retentionDays, options) =>
    useFeedsStore.getState().addFeed(name, url, retentionDays, options),
  onUpdateFeed: (id, updates) => useFeedsStore.getState().updateFeed(id, updates),
  onRemoveFeed: (id) => useFeedsStore.getState().removeFeed(id),
  getFeeds: () => useFeedsStore.getState().feeds,
});
