import { create } from 'zustand';
import { z } from 'zod';
import {
  SavedFeedSubscription,
  savedFeedSubscriptionSchema,
  DEFAULT_ACADEMIC_FEEDS,
  FEEDS_STORAGE_KEY,
  FEEDS_READ_STATE_KEY,
  FeedReadFilterType,
  FeedRetentionDays,
} from '@/features/library/domain/types/feeds.types';
import type { ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';

interface FeedsStore {
  feeds: SavedFeedSubscription[];
  activeFeedId: string | null;
  selectedFeedEntry: ParsedFeedEntry | null;
  readFilter: FeedReadFilterType;
  refreshCounter: number;
  readEntryIds: Set<string>;
  loadFeeds: () => void;
  setActiveFeedId: (id: string | null) => void;
  setSelectedFeedEntry: (entry: ParsedFeedEntry | null) => void;
  setReadFilter: (filter: FeedReadFilterType) => void;
  triggerRefresh: () => void;
  addFeed: (name: string, url: string, retentionDays?: FeedRetentionDays) => SavedFeedSubscription;
  updateFeed: (id: string, updates: Partial<Omit<SavedFeedSubscription, 'id'>>) => void;
  removeFeed: (id: string) => void;
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

  loadFeeds: () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(FEEDS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const parsedFeeds = z.array(savedFeedSubscriptionSchema).safeParse(parsed);
        if (parsedFeeds.success && parsedFeeds.data.length > 0) {
          set({ feeds: parsedFeeds.data });
        } else {
          set({ feeds: DEFAULT_ACADEMIC_FEEDS });
        }
      } else {
        set({ feeds: DEFAULT_ACADEMIC_FEEDS });
      }

      const savedRead = window.localStorage.getItem(FEEDS_READ_STATE_KEY);
      if (savedRead) {
        const parsedRead = JSON.parse(savedRead);
        if (Array.isArray(parsedRead)) {
          set({
            readEntryIds: new Set(
              parsedRead.filter((id): id is string => typeof id === 'string'),
            ),
          });
        }
      }
    } catch {
      // ignore JSON parse or localStorage errors
    }
  },

  setActiveFeedId: (id) => set({ activeFeedId: id }),

  setSelectedFeedEntry: (entry) => set({ selectedFeedEntry: entry }),

  setReadFilter: (filter) => set({ readFilter: filter }),

  triggerRefresh: () => set((s) => ({ refreshCounter: s.refreshCounter + 1 })),

  addFeed: (name, url, retentionDays: FeedRetentionDays = 30) => {
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
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(nextFeeds));
      } catch {
        // ignore storage errors
      }
    }
    return newFeed;
  },

  updateFeed: (id, updates) => {
    const nextFeeds = get().feeds.map((f) =>
      f.id === id ? { ...f, ...updates } : f
    );
    set({ feeds: nextFeeds });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(nextFeeds));
      } catch {
        // ignore storage errors
      }
    }
  },

  removeFeed: (id) => {
    const nextFeeds = get().feeds.filter((f) => f.id !== id);
    const nextActiveId =
      get().activeFeedId === id ? nextFeeds[0]?.id ?? null : get().activeFeedId;

    set({ feeds: nextFeeds, activeFeedId: nextActiveId });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FEEDS_STORAGE_KEY, JSON.stringify(nextFeeds));
      } catch {
        // ignore storage errors
      }
    }
  },

  markEntryAsRead: (entryId: string) => {
    const current = get().readEntryIds;
    if (current.has(entryId)) return;
    const next = new Set(current);
    next.add(entryId);
    set({ readEntryIds: next });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FEEDS_READ_STATE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore storage errors
      }
    }
  },

  toggleEntryRead: (entryId: string) => {
    const current = get().readEntryIds;
    const next = new Set(current);
    if (next.has(entryId)) {
      next.delete(entryId);
    } else {
      next.add(entryId);
    }
    set({ readEntryIds: next });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FEEDS_READ_STATE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore storage errors
      }
    }
  },

  markAllEntriesAsRead: (entryIds: string[]) => {
    const next = new Set(get().readEntryIds);
    for (const id of entryIds) {
      if (id) next.add(id);
    }
    set({ readEntryIds: next });
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(FEEDS_READ_STATE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore storage errors
      }
    }
  },

  isEntryRead: (entryId: string) => {
    return get().readEntryIds.has(entryId);
  },
}));
