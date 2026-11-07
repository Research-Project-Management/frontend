import { create } from 'zustand';
import { multiTabBus } from '@/shared/lib/multi-tab';
import {
  loadReaderStorageState,
  saveReaderTabsToStorage,
  saveReaderBookmarksToStorage,
  loadFeedReadEntryIdsFromStorage,
  saveFeedReadEntryIdsToStorage,
  READER_TABS_STORAGE_KEY,
  READER_BOOKMARKS_STORAGE_KEY,
  FEED_READ_IDS_STORAGE_KEY,
} from '../adapters/project-context.adapter';
import {
  normalizeReaderZoom,
  normalizeReaderTab,
  resolveNextActiveTabOnClose,
  enforceMaxReaderTabs,
  enforceMaxBookmarkedItems,
  MAX_READER_TABS,
  MAX_BOOKMARKED_ITEMS,
} from '@/features/library/domain/reader-tab-pool.domain';
import type { ReaderFitMode, ReaderTab, ReaderTheme } from '@/features/library/types/reader.types';
import type {
  SavedFeedSubscription,
  FeedReadFilterType,
  FeedRetentionDays,
} from '@/features/library/types/ingestion.types';
import { cleanDoi } from '@/features/library/domain/identifiers.domain';
import {
  mapServerFeedSubscriptions,
  type ParsedFeedEntry,
} from '@/features/library/domain/feed-parser.domain';

export {
  normalizeReaderZoom,
  MAX_READER_TABS,
  MAX_BOOKMARKED_ITEMS,
  mapServerFeedSubscriptions,
};
export type { ReaderFitMode, ReaderTab, ReaderTheme };

export type ReaderAnnotationTool =
  | 'select'
  | 'highlight'
  | 'underline'
  | 'note'
  | 'text'
  | 'area'
  | 'ink'
  | 'eraser';

interface ReaderStoreState {
  tabs: ReaderTab[];
  activeTabId: string;
  readingPaperId: string | null;
  activeColor: string;
  activeTool: ReaderAnnotationTool;
  bookmarks: Record<string, number[]>;
  openReader: (paperId: string, title?: string, projectId?: string | null) => void;
  closeReader: (paperId?: string) => void;
  openTab: (tab: ReaderTab) => void;
  closeTab: (id: string) => void;
  reorderTabs: (newTabs: ReaderTab[]) => void;
  setActiveTab: (id: string) => void;
  setActiveColor: (color: string) => void;
  setActiveTool: (tool: ReaderAnnotationTool) => void;
  updateTabState: (
    paperId: string,
    patch: Partial<
      Pick<
        ReaderTab,
        | 'currentPage'
        | 'scrollTop'
        | 'zoom'
        | 'fitMode'
        | 'rotation'
        | 'theme'
        | 'title'
        | 'viewMode'
        | 'splitMode'
        | 'secondaryPage'
        | 'interactionMode'
        | 'attachmentId'
        | 'fileUrl'
        | 'projectId'
      >
    >,
  ) => void;
  toggleBookmark: (paperId: string, pageNumber: number) => boolean;
  setBookmarks: (paperId: string, pages: number[]) => void;
}

const EMPTY_BOOKMARKS: number[] = [];
const initial = loadReaderStorageState();

export const useReaderStore = create<ReaderStoreState>((set, get) => ({
  tabs: initial.tabs,
  activeTabId: initial.activeTabId,
  readingPaperId: initial.activeTabId !== 'library' ? initial.activeTabId : null,
  activeColor: '#ffd400',
  activeTool: 'select',
  bookmarks: initial.bookmarks,

  openReader: (paperId: string, title?: string, projectId?: string | null) => {
    const { tabs, activeTabId, readingPaperId } = get();
    const existing = tabs.find((t) => t.id === paperId);
    let nextTabs = tabs;
    if (!existing) {
      nextTabs = enforceMaxReaderTabs(
        [
          ...tabs,
          normalizeReaderTab({
            id: paperId,
            title: title || 'Loading...',
            type: 'paper',
            currentPage: 1,
            zoom: 1.0,
            fitMode: 'fit-width',
            rotation: 0,
            theme: 'normal',
            ...(projectId !== undefined ? { projectId } : {}),
          }),
        ],
        paperId,
      );
    } else if (
      (title && existing.title !== title) ||
      (projectId !== undefined && existing.projectId !== projectId)
    ) {
      nextTabs = tabs.map((t) =>
        t.id === paperId
          ? {
              ...t,
              ...(title ? { title } : {}),
              ...(projectId !== undefined ? { projectId } : {}),
            }
          : t,
      );
    }

    if (nextTabs === tabs && activeTabId === paperId && readingPaperId === paperId) {
      return;
    }

    const mergedTabs = saveReaderTabsToStorage(nextTabs, paperId);
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: paperId,
      readingPaperId: paperId,
    });
  },

  closeReader: (paperId?: string) => {
    const { tabs, activeTabId } = get();
    const targetId = paperId || (activeTabId !== 'library' ? activeTabId : null);
    if (!targetId || targetId === 'library') return;

    const nextTabs = tabs.filter((t) => t.id !== targetId);
    const nextActive = resolveNextActiveTabOnClose(tabs, targetId, activeTabId);
    const mergedTabs = saveReaderTabsToStorage(nextTabs, nextActive, undefined, {
      removedIds: [targetId],
    });
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  openTab: (tab: ReaderTab) => {
    const { tabs } = get();
    const normalized = normalizeReaderTab(tab);
    const exists = tabs.some((t) => t.id === normalized.id);
    const nextTabs = exists
      ? tabs.map((t) =>
          t.id === normalized.id
            ? {
                ...t,
                title: normalized.title || t.title,
                currentPage:
                  tab.currentPage !== undefined ? normalized.currentPage : t.currentPage,
                zoom: tab.zoom !== undefined ? normalized.zoom : t.zoom,
                fitMode: tab.fitMode !== undefined ? normalized.fitMode : t.fitMode,
                rotation: tab.rotation !== undefined ? normalized.rotation : t.rotation,
                theme: tab.theme !== undefined ? normalized.theme : t.theme,
                ...(tab.projectId !== undefined ? { projectId: normalized.projectId } : {}),
              }
            : t,
        )
      : enforceMaxReaderTabs([...tabs, normalized], normalized.id);
    const mergedTabs = saveReaderTabsToStorage(nextTabs, normalized.id);
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: normalized.id,
      readingPaperId: normalized.id !== 'library' ? normalized.id : null,
    });
  },

  closeTab: (id: string) => {
    if (id === 'library') return;
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.filter((t) => t.id !== id);
    const nextActive = resolveNextActiveTabOnClose(tabs, id, activeTabId);
    const mergedTabs = saveReaderTabsToStorage(nextTabs, nextActive, undefined, {
      removedIds: [id],
    });
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({
      tabs: mergedTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  reorderTabs: (newTabs: ReaderTab[]) => {
    const { activeTabId } = get();
    const mergedTabs = saveReaderTabsToStorage(newTabs, activeTabId, undefined, {
      replaceOrder: true,
    });
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({ tabs: mergedTabs });
  },

  setActiveTab: (id: string) => {
    const { tabs, activeTabId } = get();
    if (activeTabId === id || !tabs.some((t) => t.id === id)) return;
    const mergedTabs = saveReaderTabsToStorage(tabs, id);
    set({
      tabs: mergedTabs,
      activeTabId: id,
      readingPaperId: id !== 'library' ? id : null,
    });
  },

  setActiveColor: (color: string) =>
    set((s) => (s.activeColor === color ? s : { activeColor: color })),

  setActiveTool: (tool: ReaderAnnotationTool) =>
    set((s) => (s.activeTool === tool ? s : { activeTool: tool })),

  updateTabState: (paperId, patch) => {
    const { tabs, activeTabId } = get();
    let changed = false;
    const nextTabs = tabs.map((t) => {
      if (t.id !== paperId) return t;
      const nextTab: ReaderTab = {
        ...t,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.currentPage !== undefined
          ? { currentPage: Math.max(1, Math.floor(patch.currentPage)) }
          : {}),
        ...(patch.scrollTop !== undefined
          ? { scrollTop: Math.max(0, Math.round(patch.scrollTop)) }
          : {}),
        ...(patch.zoom !== undefined ? { zoom: normalizeReaderZoom(patch.zoom) } : {}),
        ...(patch.fitMode !== undefined ? { fitMode: patch.fitMode } : {}),
        ...(patch.rotation !== undefined
          ? { rotation: (((patch.rotation % 360) + 360) % 360) }
          : {}),
        ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
        ...(patch.viewMode !== undefined ? { viewMode: patch.viewMode } : {}),
        ...(patch.splitMode !== undefined ? { splitMode: patch.splitMode } : {}),
        ...(patch.secondaryPage !== undefined
          ? { secondaryPage: Math.max(1, Math.floor(patch.secondaryPage)) }
          : {}),
        ...(patch.interactionMode !== undefined ? { interactionMode: patch.interactionMode } : {}),
        ...(patch.attachmentId !== undefined ? { attachmentId: patch.attachmentId } : {}),
        ...(patch.fileUrl !== undefined ? { fileUrl: patch.fileUrl } : {}),
        ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
      };
      if (
        nextTab.title !== t.title ||
        nextTab.currentPage !== t.currentPage ||
        nextTab.scrollTop !== t.scrollTop ||
        nextTab.zoom !== t.zoom ||
        nextTab.fitMode !== t.fitMode ||
        nextTab.rotation !== t.rotation ||
        nextTab.theme !== t.theme ||
        nextTab.viewMode !== t.viewMode ||
        nextTab.splitMode !== t.splitMode ||
        nextTab.secondaryPage !== t.secondaryPage ||
        nextTab.interactionMode !== t.interactionMode ||
        nextTab.attachmentId !== t.attachmentId ||
        nextTab.fileUrl !== t.fileUrl ||
        nextTab.projectId !== t.projectId
      ) {
        changed = true;
        return nextTab;
      }
      return t;
    });

    if (!changed) return;
    const mergedTabs = saveReaderTabsToStorage(nextTabs, activeTabId);
    multiTabBus.publish({ type: 'READER_TABS_SYNC' });
    set({ tabs: mergedTabs });
  },

  toggleBookmark: (paperId: string, pageNumber: number) => {
    const safePage = Math.max(1, Math.floor(pageNumber));
    const prevBookmarks = get().bookmarks;
    const current = prevBookmarks[paperId] || EMPTY_BOOKMARKS;
    const exists = current.includes(safePage);
    const nextPages = exists
      ? current.filter((p) => p !== safePage)
      : [...current, safePage].sort((a, b) => a - b);

    const updated: Record<string, number[]> = { ...prevBookmarks };
    delete updated[paperId];
    if (nextPages.length > 0) {
      updated[paperId] = nextPages;
    }
    const nextBookmarks = saveReaderBookmarksToStorage(
      enforceMaxBookmarkedItems(updated),
      undefined,
      paperId,
    );
    multiTabBus.publish({ type: 'READER_BOOKMARKS_SYNC' });
    set({ bookmarks: nextBookmarks });
    return !exists;
  },

  setBookmarks: (paperId: string, pages: number[]) => {
    if (!paperId || paperId === 'library') return;
    const normalizedPages = Array.from(
      new Set(
        pages
          .filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p >= 1)
          .map((p) => Math.max(1, Math.floor(p))),
      ),
    ).sort((a, b) => a - b);

    const prevBookmarks = get().bookmarks;
    const current = prevBookmarks[paperId] || EMPTY_BOOKMARKS;
    if (
      current.length === normalizedPages.length &&
      current.every((val, idx) => val === normalizedPages[idx])
    ) {
      return;
    }

    const updated: Record<string, number[]> = { ...prevBookmarks };
    delete updated[paperId];
    if (normalizedPages.length > 0) {
      updated[paperId] = normalizedPages;
    }
    const nextBookmarks = saveReaderBookmarksToStorage(
      enforceMaxBookmarkedItems(updated),
      undefined,
      paperId,
    );
    multiTabBus.publish({ type: 'READER_BOOKMARKS_SYNC' });
    set({ bookmarks: nextBookmarks });
  },
}));

export interface FeedsTransportAdapter {
  getSubscriptions: () => Promise<{ data?: Parameters<typeof mapServerFeedSubscriptions>[0] } | undefined>;
  subscribe: (payload: {
    url: string;
    customTitle?: string;
    cleanupDays?: number;
    cleanupReadAfter?: number;
    cleanupUnreadAfter?: number;
  }) => Promise<{ data?: unknown } | undefined>;
  updateSubscription: (
    id: string,
    payload: {
      customTitle?: string;
      cleanupDays?: number;
      cleanupReadAfter?: number;
      cleanupUnreadAfter?: number;
      url?: string;
    },
  ) => Promise<unknown>;
  unsubscribe: (id: string) => Promise<unknown>;
  markItemRead?: (entryId: string, isRead: boolean) => Promise<unknown>;
  markAllRead?: (entryIds: string[]) => Promise<unknown>;
  markFeedAllRead?: (feedId: string) => Promise<unknown>;
  getItems: (feedId: string) => Promise<{ data?: unknown[] } | undefined>;
}

let activeFeedsTransport: FeedsTransportAdapter | null = null;

export function registerFeedsTransportAdapter(adapter: FeedsTransportAdapter): void {
  activeFeedsTransport = adapter;
}

export interface FeedsStore {
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
  hydrateSavedEntries: (entryIds: Iterable<string>) => void;
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
  ) => SavedFeedSubscription;
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
}

export function isFeedEntryInLibrary(
  entry: ParsedFeedEntry | null | undefined,
  savedEntryIds: Iterable<string>,
  libraryItems?: Array<{ doi?: string | null; title?: string | null; url?: string | null }>,
): boolean {
  if (!entry) return false;
  const serverFlags = entry as { isSaved?: boolean; savedItemId?: string | null };
  if (serverFlags.isSaved === true || Boolean(serverFlags.savedItemId)) return true;
  const savedSet = savedEntryIds instanceof Set ? savedEntryIds : new Set(savedEntryIds);
  if (savedSet.has(entry.id)) return true;
  if (!libraryItems || libraryItems.length === 0) return false;
  const normalizedDoi = cleanDoi(entry.doi).toLowerCase();
  const normalizedTitle = entry.title?.trim().toLowerCase();
  const normalizedUrl = entry.url?.trim().toLowerCase();
  for (const item of libraryItems) {
    if (normalizedDoi && item.doi && cleanDoi(item.doi).toLowerCase() === normalizedDoi) return true;
    if (normalizedTitle && item.title && item.title.trim().toLowerCase() === normalizedTitle) return true;
    if (normalizedUrl && item.url && item.url.trim().toLowerCase() === normalizedUrl) return true;
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
  readEntryIds: loadFeedReadEntryIdsFromStorage(),
  savedEntryIds: [],
  savingEntryIds: [],
  isLoadingFeeds: false,
  hasInitializedFeeds: false,

  hydrateFeeds: (feeds) =>
    set({
      feeds: Array.isArray(feeds) ? feeds : [],
      isLoadingFeeds: false,
      hasInitializedFeeds: true,
    }),

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
      saveFeedReadEntryIdsToStorage(next);
      set({ readEntryIds: next });
    }
  },

  hydrateSavedEntries: (entryIds) => {
    const current = get().savedEntryIds;
    const currentSet = new Set(current);
    const additions: string[] = [];
    for (const id of entryIds) {
      if (id && !currentSet.has(id)) {
        currentSet.add(id);
        additions.push(id);
      }
    }
    if (additions.length > 0) set({ savedEntryIds: [...current, ...additions] });
  },

  loadFeeds: async (options) => {
    if (get().isLoadingFeeds || (!options?.force && get().hasInitializedFeeds)) return;
    set({ isLoadingFeeds: true });
    try {
      const res = await activeFeedsTransport?.getSubscriptions();
      if (res?.data && Array.isArray(res.data)) {
        set({
          feeds: mapServerFeedSubscriptions(res.data),
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
    const serverSavedIds: string[] = [];
    const currentRead = get().readEntryIds;
    const currentSaved = get().savedEntryIds;
    for (const entry of entries || []) {
      if (entry?.id && entry.isRead === true && !currentRead.has(entry.id)) {
        serverReadIds.push(entry.id);
      }
      if (entry?.id && (entry.isSaved === true || Boolean(entry.savedItemId)) && !currentSaved.includes(entry.id)) {
        serverSavedIds.push(entry.id);
      }
    }
    const updates: Partial<FeedsStore> = { currentFeedEntries: entries };
    if (serverReadIds.length > 0) {
      const nextRead = new Set(currentRead);
      for (const id of serverReadIds) nextRead.add(id);
      updates.readEntryIds = nextRead;
    }
    if (serverSavedIds.length > 0) {
      updates.savedEntryIds = Array.from(new Set([...currentSaved, ...serverSavedIds]));
    }
    set(updates);
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
    const createdFeed: SavedFeedSubscription = {
      id: localId,
      name: trimmedName,
      url: trimmedUrl,
      retentionDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    };

    set({ feeds: [...get().feeds.filter((f) => f.id !== localId), createdFeed], activeFeedId: localId });

    void activeFeedsTransport?.subscribe({
      url: trimmedUrl,
      customTitle: trimmedName,
      cleanupDays: unreadDays,
      cleanupReadAfter: readDays,
      cleanupUnreadAfter: unreadDays,
    })
      ?.then((res) => {
        const sub = (res?.data as { feedId?: string; id?: string; feed?: { id?: string; url?: string } }) || {};
        const serverId = sub.feedId || sub.id || sub.feed?.id;
        if (serverId && serverId !== localId) {
          createdFeed.id = serverId;
          if (sub.feed?.url) createdFeed.url = sub.feed.url;
          set((state) => ({
            feeds: state.feeds.map((f) => (f.id === localId ? { ...f, id: serverId, url: sub.feed?.url || f.url } : f)),
            activeFeedId: state.activeFeedId === localId ? serverId : state.activeFeedId,
          }));
        }
      })
      .catch(() => {
        if (activeFeedsTransport) {
          set((state) => {
            const next = state.feeds.filter((f) => f.id !== localId);
            return {
              feeds: next,
              activeFeedId: state.activeFeedId === localId ? (next[0]?.id ?? null) : state.activeFeedId,
            };
          });
        }
      });

    return createdFeed;
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

    try {
      await activeFeedsTransport?.updateSubscription(id, {
        customTitle: updates.name,
        cleanupDays: updates.cleanupUnreadAfter ?? updates.retentionDays,
        cleanupReadAfter: updates.cleanupReadAfter,
        cleanupUnreadAfter: updates.cleanupUnreadAfter ?? updates.retentionDays,
        url: updates.url,
      });
    } catch (err) {
      set({ feeds: previousFeeds });
      throw err;
    }
  },

  removeFeed: async (id) => {
    const previousFeeds = get().feeds;
    const previousActiveId = get().activeFeedId;
    const nextFeeds = previousFeeds.filter((f) => f.id !== id);
    const nextActiveId = previousActiveId === id ? nextFeeds[0]?.id ?? null : previousActiveId;
    set({ feeds: nextFeeds, activeFeedId: nextActiveId });

    try {
      await activeFeedsTransport?.unsubscribe(id);
    } catch (err) {
      set({ feeds: previousFeeds, activeFeedId: previousActiveId });
      throw err;
    }
  },

  markEntryAsRead: (entryId: string) => {
    const current = get().readEntryIds;
    if (current.has(entryId)) return;
    const previous = new Set(current);
    const next = new Set(current);
    next.add(entryId);
    saveFeedReadEntryIdsToStorage(next);
    multiTabBus.publish({ type: 'FEEDS_READ_IDS_SYNC' });
    set({ readEntryIds: next });
    try {
      const req = activeFeedsTransport?.markItemRead?.(entryId, true);
      if (req && typeof req.catch === 'function') {
        req.catch((err: unknown) => {
          if (shouldRollbackOptimisticReadUpdate(err)) {
            saveFeedReadEntryIdsToStorage(previous);
            multiTabBus.publish({ type: 'FEEDS_READ_IDS_SYNC' });
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
    if (!isNowRead) next.delete(entryId);
    else next.add(entryId);
    saveFeedReadEntryIdsToStorage(next);
    multiTabBus.publish({ type: 'FEEDS_READ_IDS_SYNC' });
    set({ readEntryIds: next });
    try {
      const req = activeFeedsTransport?.markItemRead?.(entryId, isNowRead);
      if (req && typeof req.catch === 'function') {
        req.catch((err: unknown) => {
          if (shouldRollbackOptimisticReadUpdate(err)) {
            saveFeedReadEntryIdsToStorage(previous);
            multiTabBus.publish({ type: 'FEEDS_READ_IDS_SYNC' });
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
      entryIds && entryIds.length > 0 ? entryIds : get().currentFeedEntries.map((e) => e.id);
    if (resolvedIds.length === 0) return;
    const previous = new Set(get().readEntryIds);
    const next = new Set(previous);
    for (const id of resolvedIds) {
      if (id) next.add(id);
    }
    saveFeedReadEntryIdsToStorage(next);
    multiTabBus.publish({ type: 'FEEDS_READ_IDS_SYNC' });
    set({ readEntryIds: next });
    try {
      const req = activeFeedsTransport?.markAllRead?.(resolvedIds);
      if (req && typeof req.catch === 'function') {
        req.catch((err: unknown) => {
          if (shouldRollbackOptimisticReadUpdate(err)) {
            saveFeedReadEntryIdsToStorage(previous);
            multiTabBus.publish({ type: 'FEEDS_READ_IDS_SYNC' });
            set({ readEntryIds: previous });
          }
        });
      }
    } catch {
      // Offline / unmocked test fallback
    }
  },

  markFeedAsRead: async (feedId: string) => {
    set((state) => ({
      feeds: state.feeds.map((f) => (f.id === feedId ? { ...f, unreadCount: 0 } : f)),
    }));
    if (activeFeedsTransport?.markFeedAllRead) {
      try {
        await activeFeedsTransport.markFeedAllRead(feedId);
      } catch {
        // Fall through to item-by-item fallback
      }
    }
    const res = await activeFeedsTransport?.getItems(feedId);
    const items = (res?.data as Array<{ id?: string; guid?: string; url?: string }>) || [];
    const itemIds = items.map((it) => it.id || it.guid || it.url).filter(Boolean) as string[];
    if (itemIds.length > 0) get().markAllEntriesAsRead(itemIds);
    else get().markAllEntriesAsRead();
  },

  isEntryRead: (entryId: string) => get().readEntryIds.has(entryId),

  markEntrySaved: (id: string) =>
    set((state) =>
      state.savedEntryIds.includes(id)
        ? state
        : { savedEntryIds: [...state.savedEntryIds, id] },
    ),

  setEntrySaving: (id: string, isSaving: boolean) =>
    set((state) => {
      const exists = state.savingEntryIds.includes(id);
      if (isSaving && !exists) return { savingEntryIds: [...state.savingEntryIds, id] };
      if (!isSaving && exists) {
        return { savingEntryIds: state.savingEntryIds.filter((item) => item !== id) };
      }
      return state;
    }),
}));

// ── Cross-Tab Store Synchronization (BroadcastChannel + StorageEvent) ────────

export function rehydrateReaderStoreFromStorage(): void {
  const latest = loadReaderStorageState();
  const current = useReaderStore.getState();

  // Preserve current window's activeTabId if it still exists in the synced tab list
  const keepCurrentActive = current.tabs.some((t) => t.id === current.activeTabId) &&
    latest.tabs.some((t) => t.id === current.activeTabId);
  const nextActiveId = keepCurrentActive ? current.activeTabId : latest.activeTabId;

  useReaderStore.setState({
    tabs: latest.tabs,
    activeTabId: nextActiveId,
    readingPaperId: nextActiveId !== 'library' ? nextActiveId : null,
    bookmarks: latest.bookmarks,
  });
}

export function rehydrateFeedsReadIdsFromStorage(): void {
  const latestReadIds = loadFeedReadEntryIdsFromStorage();
  useFeedsStore.setState({ readEntryIds: latestReadIds });
}

if (typeof window !== 'undefined') {
  multiTabBus.subscribe((event) => {
    if (event.type === 'READER_TABS_SYNC' || event.type === 'READER_BOOKMARKS_SYNC') {
      rehydrateReaderStoreFromStorage();
    } else if (event.type === 'FEEDS_READ_IDS_SYNC') {
      rehydrateFeedsReadIdsFromStorage();
    }
  });

  window.addEventListener('storage', (e: StorageEvent) => {
    if (
      e.key === READER_TABS_STORAGE_KEY ||
      e.key === READER_BOOKMARKS_STORAGE_KEY
    ) {
      rehydrateReaderStoreFromStorage();
    } else if (e.key === FEED_READ_IDS_STORAGE_KEY) {
      rehydrateFeedsReadIdsFromStorage();
    }
  });
}
