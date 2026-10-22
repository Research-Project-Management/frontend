import { create } from 'zustand';
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
  readFilter: FeedReadFilterType;
  refreshCounter: number;
  readEntryIds: Set<string>;
  loadFeeds: () => Promise<void>;
  setActiveFeedId: (id: string | null) => void;
  setSelectedFeedEntry: (entry: ParsedFeedEntry | null) => void;
  setReadFilter: (filter: FeedReadFilterType) => void;
  triggerRefresh: () => void;
  addFeed: (name: string, url: string, retentionDays?: FeedRetentionDays) => SavedFeedSubscription;
  updateFeed: (id: string, updates: Partial<Omit<SavedFeedSubscription, 'id'>>) => void;
  removeFeed: (id: string) => Promise<void>;
  markEntryAsRead: (entryId: string) => void;
  toggleEntryRead: (entryId: string) => void;
  markAllEntriesAsRead: (entryIds: string[]) => void;
  isEntryRead: (entryId: string) => boolean;
}

export const useFeedsStore = create<FeedsStore>((set, get) => ({
  feeds: DEFAULT_ACADEMIC_FEEDS,
  activeFeedId: null,
  selectedFeedEntry: null,
  readFilter: 'all',
  refreshCounter: 0,
  readEntryIds: new Set<string>(),

  loadFeeds: async () => {
    try {
      const res = await FeedsService.getSubscriptions();
      if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
        const mappedFeeds: SavedFeedSubscription[] = res.data.map((sub) => ({
          id: sub.feedId || sub.id,
          name: sub.customTitle || sub.feed?.title || 'Academic Feed',
          url: sub.feed?.url || '',
          retentionDays: (sub.cleanupReadAfter || 30) as FeedRetentionDays,
        }));
        set({ feeds: mappedFeeds });
        return;
      }
    } catch {
      // Backend offline or error: use defaults
    }
    set({ feeds: DEFAULT_ACADEMIC_FEEDS });
  },

  setActiveFeedId: (id) => set({ activeFeedId: id, selectedFeedEntry: null }),

  setSelectedFeedEntry: (entry) => set({ selectedFeedEntry: entry }),

  setReadFilter: (filter) => set({ readFilter: filter }),

  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),

  addFeed: (name, url, retentionDays = 30) => {
    const trimmedUrl = url.trim();
    const trimmedName =
      name.trim() || trimmedUrl.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 42);
    const id = `feed-${Date.now()}`;

    const newFeed: SavedFeedSubscription = {
      id,
      name: trimmedName,
      url: trimmedUrl,
      retentionDays,
    };
    const nextFeeds = [...get().feeds, newFeed];

    set({ feeds: nextFeeds, activeFeedId: id });

    // Server-authoritative subscription via Backend API
    FeedsService.subscribe({
      url: trimmedUrl,
      customTitle: trimmedName,
      cleanupDays: retentionDays,
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
      .catch(() => {
        // Handled silently
      });

    return newFeed;
  },

  updateFeed: (id, updates) => {
    const nextFeeds = get().feeds.map((f) =>
      f.id === id ? { ...f, ...updates } : f
    );
    set({ feeds: nextFeeds });

    // Sync with backend API
    FeedsService.updateSubscription(id, {
      customTitle: updates.name,
      cleanupDays: updates.retentionDays,
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

  markAllEntriesAsRead: (entryIds: string[]) => {
    const next = new Set(get().readEntryIds);
    for (const id of entryIds) {
      if (id) next.add(id);
    }
    set({ readEntryIds: next });

    // Server-authoritative state sync
    FeedsService.markAllRead(entryIds).catch(() => {});
  },

  isEntryRead: (entryId: string) => {
    return get().readEntryIds.has(entryId);
  },
}));
