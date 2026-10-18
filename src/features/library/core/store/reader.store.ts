import { create } from 'zustand';
import {
  normalizeReaderZoom,
  normalizeReaderTab,
  resolveNextActiveTabOnClose,
  loadReaderStorageState,
  saveReaderTabsToStorage,
  saveReaderBookmarksToStorage,
} from '../adapters/reader-storage.adapter';

export { normalizeReaderZoom };

export type ReaderFitMode = 'page-width' | 'page-fit' | 'auto' | 'custom';
export type ReaderTheme = 'light' | 'sepia' | 'dark';

export interface ReaderTab {
  id: string; // 'library' or paperId
  title: string;
  type: 'library' | 'paper';
  currentPage?: number;
  zoom?: number;
  fitMode?: ReaderFitMode;
  rotation?: number;
  theme?: ReaderTheme;
}

// Zotero 7 official annotation tools (in order, Alt+1 through Alt+7):
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

export interface ReaderStoreState {
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
  setActiveTab: (id: string) => void;
  setActiveColor: (color: string) => void;
  setActiveTool: (tool: ReaderAnnotationTool) => void;
  updateTabPage: (paperId: string, pageNumber: number) => void;
  updateTabState: (
    paperId: string,
    patch: Partial<
      Pick<ReaderTab, 'currentPage' | 'zoom' | 'fitMode' | 'rotation' | 'theme' | 'title'>
    >,
  ) => void;
  toggleBookmark: (paperId: string, pageNumber: number) => boolean;
  getBookmarks: (paperId: string) => number[];
}

const EMPTY_BOOKMARKS: number[] = [];
const initial = loadReaderStorageState();

export const useReaderStore = create<ReaderStoreState>((set, get) => ({
  tabs: initial.tabs,
  activeTabId: initial.activeTabId,
  readingPaperId: initial.activeTabId !== 'library' ? initial.activeTabId : null,
  activeColor: '#ffd400',
  activeTool: 'highlight',
  bookmarks: initial.bookmarks,

  openReader: (paperId: string, title?: string) => {
    const { tabs, activeTabId, readingPaperId } = get();
    const existing = tabs.find((t) => t.id === paperId);
    let nextTabs = tabs;
    if (!existing) {
      nextTabs = [
        ...tabs,
        normalizeReaderTab({
          id: paperId,
          title: title || 'Loading...',
          type: 'paper',
          currentPage: 1,
          zoom: 1.0,
          fitMode: 'page-width',
          rotation: 0,
          theme: 'light',
        }),
      ];
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
      : [...tabs, normalized];
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

  updateTabPage: (paperId: string, pageNumber: number) => {
    const safePage = Math.max(1, Math.floor(pageNumber));
    const { tabs, activeTabId } = get();
    const target = tabs.find((t) => t.id === paperId);
    if (!target || target.currentPage === safePage) return;

    const nextTabs = tabs.map((t) =>
      t.id === paperId ? { ...t, currentPage: safePage } : t,
    );
    saveReaderTabsToStorage(nextTabs, activeTabId);
    set({ tabs: nextTabs });
  },

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
        ...(patch.zoom !== undefined ? { zoom: normalizeReaderZoom(patch.zoom) } : {}),
        ...(patch.fitMode !== undefined ? { fitMode: patch.fitMode } : {}),
        ...(patch.rotation !== undefined
          ? { rotation: (((patch.rotation % 360) + 360) % 360) }
          : {}),
        ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
      };
      if (
        nextTab.title !== t.title ||
        nextTab.currentPage !== t.currentPage ||
        nextTab.zoom !== t.zoom ||
        nextTab.fitMode !== t.fitMode ||
        nextTab.rotation !== t.rotation ||
        nextTab.theme !== t.theme
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
    const current = get().bookmarks[paperId] || EMPTY_BOOKMARKS;
    const exists = current.includes(safePage);
    const nextPages = exists
      ? current.filter((p) => p !== safePage)
      : [...current, safePage].sort((a, b) => a - b);
    const nextBookmarks = {
      ...get().bookmarks,
      [paperId]: nextPages,
    };
    saveReaderBookmarksToStorage(nextBookmarks);
    set({ bookmarks: nextBookmarks });
    return !exists;
  },

  getBookmarks: (paperId: string) => {
    return get().bookmarks[paperId] || EMPTY_BOOKMARKS;
  },
}));

export const useLibraryReaderStore = useReaderStore;
