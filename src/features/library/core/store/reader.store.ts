import { create } from 'zustand';
import {
  loadReaderStorageState,
  saveReaderTabsToStorage,
  saveReaderBookmarksToStorage,
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
import {
  useFeedsStore,
  registerFeedsTransportAdapter,
  isFeedEntryInLibrary,
  mapServerFeedSubscriptions,
  type FeedsTransportAdapter,
  type FeedsStore,
} from './feeds.store';

export {
  normalizeReaderZoom,
  MAX_READER_TABS,
  MAX_BOOKMARKED_ITEMS,
  useFeedsStore,
  registerFeedsTransportAdapter,
  isFeedEntryInLibrary,
  mapServerFeedSubscriptions,
  type FeedsTransportAdapter,
  type FeedsStore,
};
export type { ReaderFitMode, ReaderTab, ReaderTheme };

// Standard Reader annotation tools (in order, Alt+1 through Alt+7):
// highlight, underline, note, text, area, ink, eraser
// 'select' is an internal interaction mode, not an annotation tool
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
  openReader: (paperId: string, title?: string) => void;
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

  openReader: (paperId: string, title?: string) => {
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
          }),
        ],
        paperId,
      );
    } else if (title && existing.title !== title) {
      nextTabs = tabs.map((t) => (t.id === paperId ? { ...t, title } : t));
    }

    if (nextTabs === tabs && activeTabId === paperId && readingPaperId === paperId) {
      return;
    }

    saveReaderTabsToStorage(nextTabs, paperId);
    set({
      tabs: nextTabs,
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
    saveReaderTabsToStorage(nextTabs, nextActive);
    set({
      tabs: nextTabs,
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
              }
            : t,
        )
      : enforceMaxReaderTabs([...tabs, normalized], normalized.id);
    saveReaderTabsToStorage(nextTabs, normalized.id);
    set({
      tabs: nextTabs,
      activeTabId: normalized.id,
      readingPaperId: normalized.id !== 'library' ? normalized.id : null,
    });
  },

  closeTab: (id: string) => {
    if (id === 'library') return;
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.filter((t) => t.id !== id);
    const nextActive = resolveNextActiveTabOnClose(tabs, id, activeTabId);
    saveReaderTabsToStorage(nextTabs, nextActive);
    set({
      tabs: nextTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  reorderTabs: (newTabs: ReaderTab[]) => {
    const { activeTabId } = get();
    saveReaderTabsToStorage(newTabs, activeTabId);
    set({ tabs: newTabs });
  },

  setActiveTab: (id: string) => {
    const { tabs, activeTabId } = get();
    if (activeTabId === id || !tabs.some((t) => t.id === id)) return;
    saveReaderTabsToStorage(tabs, id);
    set({
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
        nextTab.fileUrl !== t.fileUrl
      ) {
        changed = true;
        return nextTab;
      }
      return t;
    });

    if (!changed) return;
    saveReaderTabsToStorage(nextTabs, activeTabId);
    set({ tabs: nextTabs });
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
    const nextBookmarks = enforceMaxBookmarkedItems(updated);
    saveReaderBookmarksToStorage(nextBookmarks);
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
    const nextBookmarks = enforceMaxBookmarkedItems(updated);
    saveReaderBookmarksToStorage(nextBookmarks);
    set({ bookmarks: nextBookmarks });
  },
}));
