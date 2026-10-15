import { create } from 'zustand';

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

/**
 * Normalizes zoom input whether provided as a float scale (e.g. 1.25)
 * or percentage (e.g. 125) into a clamped float scale in [0.25, 5.0].
 */
export function normalizeReaderZoom(rawZoom?: number | null): number {
  if (typeof rawZoom !== 'number' || Number.isNaN(rawZoom) || rawZoom <= 0) {
    return 1.0;
  }
  const scale = rawZoom > 10 ? rawZoom / 100 : rawZoom;
  return Math.min(5.0, Math.max(0.25, Number(scale.toFixed(4))));
}

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
    patch: Partial<Pick<ReaderTab, 'currentPage' | 'zoom' | 'fitMode' | 'rotation' | 'theme' | 'title'>>,
  ) => void;
  toggleBookmark: (paperId: string, pageNumber: number) => boolean;
  getBookmarks: (paperId: string) => number[];
}

const DEFAULT_TABS: ReaderTab[] = [
  { id: 'library', title: 'My Library', type: 'library' },
];

function normalizeTab(tab: ReaderTab): ReaderTab {
  if (tab.type === 'library' || tab.id === 'library') {
    return { id: 'library', title: tab.title || 'My Library', type: 'library' };
  }
  return {
    ...tab,
    type: 'paper',
    currentPage: Math.max(1, Math.floor(tab.currentPage ?? 1)),
    zoom: normalizeReaderZoom(tab.zoom ?? 1.0),
    fitMode: tab.fitMode ?? 'page-width',
    rotation: ((tab.rotation ?? 0) % 360 + 360) % 360,
    theme: tab.theme ?? 'light',
  };
}

function loadInitialTabs(): { tabs: ReaderTab[]; activeTabId: string } {
  if (typeof window === 'undefined') {
    return { tabs: DEFAULT_TABS, activeTabId: 'library' };
  }
  try {
    const raw = localStorage.getItem('flux_reader_tabs');
    const rawActive = localStorage.getItem('flux_reader_active_tab');
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const filtered = parsed
        .filter(
          (t: unknown): t is ReaderTab =>
            Boolean(
              t &&
                typeof t === 'object' &&
                'id' in t &&
                (t as { id: unknown }).id &&
                (t as { id: unknown }).id !== 'library',
            ),
        )
        .map(normalizeTab);
      const tabs: ReaderTab[] = [DEFAULT_TABS[0], ...filtered];
      const activeTabId =
        rawActive && tabs.some((t) => t.id === rawActive) ? rawActive : tabs[0].id;
      return { tabs, activeTabId };
    }
  } catch {
    // Ignore parse error
  }
  return { tabs: DEFAULT_TABS, activeTabId: 'library' };
}

function saveTabsToStorage(tabs: ReaderTab[], activeTabId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('flux_reader_tabs', JSON.stringify(tabs));
    localStorage.setItem('flux_reader_active_tab', activeTabId);
  } catch {
    // Ignore storage write error
  }
}

function resolveNextActiveTabOnClose(
  tabs: ReaderTab[],
  closedTabId: string,
  currentActiveId: string,
): string {
  const nextTabs = tabs.filter((t) => t.id !== closedTabId);
  if (currentActiveId !== closedTabId) {
    return nextTabs.some((t) => t.id === currentActiveId)
      ? currentActiveId
      : (nextTabs[0]?.id ?? 'library');
  }
  const idx = tabs.findIndex((t) => t.id === closedTabId);
  // Prefer adjacent paper tab (right neighbor first, then left neighbor if it's a paper tab),
  // falling back to 'library' when no paper tabs remain.
  const rightNeighbor = tabs[idx + 1];
  if (rightNeighbor) return rightNeighbor.id;
  const leftNeighbor = tabs[idx - 1];
  if (leftNeighbor) return leftNeighbor.id;
  return nextTabs[0]?.id ?? 'library';
}

const initial = loadInitialTabs();

export const useReaderStore = create<ReaderStoreState>((set, get) => ({
  tabs: initial.tabs,
  activeTabId: initial.activeTabId,
  readingPaperId: initial.activeTabId !== 'library' ? initial.activeTabId : null,
  activeColor: '#ffd400',
  activeTool: 'highlight',
  bookmarks: {},

  openReader: (paperId: string, title?: string) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === paperId);
    let nextTabs = tabs;
    if (!existing) {
      nextTabs = [
        ...tabs,
        normalizeTab({
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
    saveTabsToStorage(nextTabs, paperId);
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
    saveTabsToStorage(nextTabs, nextActive);
    set({
      tabs: nextTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  openTab: (tab: ReaderTab) => {
    const { tabs } = get();
    const normalized = normalizeTab(tab);
    const exists = tabs.some((t) => t.id === normalized.id);
    const nextTabs = exists
      ? tabs.map((t) =>
          t.id === normalized.id
            ? {
                ...t,
                title: normalized.title || t.title,
                currentPage: tab.currentPage !== undefined ? normalized.currentPage : t.currentPage,
                zoom: tab.zoom !== undefined ? normalized.zoom : t.zoom,
                fitMode: tab.fitMode !== undefined ? normalized.fitMode : t.fitMode,
                rotation: tab.rotation !== undefined ? normalized.rotation : t.rotation,
                theme: tab.theme !== undefined ? normalized.theme : t.theme,
              }
            : t,
        )
      : [...tabs, normalized];
    saveTabsToStorage(nextTabs, normalized.id);
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
    saveTabsToStorage(nextTabs, nextActive);
    set({
      tabs: nextTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  setActiveTab: (id: string) => {
    const { tabs } = get();
    if (!tabs.some((t) => t.id === id)) return;
    saveTabsToStorage(tabs, id);
    set({
      activeTabId: id,
      readingPaperId: id !== 'library' ? id : null,
    });
  },

  setActiveColor: (color: string) => set({ activeColor: color }),
  setActiveTool: (tool: ReaderAnnotationTool) => set({ activeTool: tool }),

  updateTabPage: (paperId: string, pageNumber: number) => {
    const safePage = Math.max(1, Math.floor(pageNumber));
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.map((t) =>
      t.id === paperId ? { ...t, currentPage: safePage } : t,
    );
    saveTabsToStorage(nextTabs, activeTabId);
    set({ tabs: nextTabs });
  },

  updateTabState: (paperId, patch) => {
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.map((t) => {
      if (t.id !== paperId) return t;
      return {
        ...t,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.currentPage !== undefined
          ? { currentPage: Math.max(1, Math.floor(patch.currentPage)) }
          : {}),
        ...(patch.zoom !== undefined ? { zoom: normalizeReaderZoom(patch.zoom) } : {}),
        ...(patch.fitMode !== undefined ? { fitMode: patch.fitMode } : {}),
        ...(patch.rotation !== undefined
          ? { rotation: ((patch.rotation % 360) + 360) % 360 }
          : {}),
        ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
      };
    });
    saveTabsToStorage(nextTabs, activeTabId);
    set({ tabs: nextTabs });
  },

  toggleBookmark: (paperId: string, pageNumber: number) => {
    const safePage = Math.max(1, Math.floor(pageNumber));
    const current = get().bookmarks[paperId] || [];
    const exists = current.includes(safePage);
    const nextPages = exists
      ? current.filter((p) => p !== safePage)
      : [...current, safePage].sort((a, b) => a - b);
    set((state) => ({
      bookmarks: {
        ...state.bookmarks,
        [paperId]: nextPages,
      },
    }));
    return !exists;
  },

  getBookmarks: (paperId: string) => {
    return get().bookmarks[paperId] || [];
  },
}));

// Backward-compatible alias
export const useLibraryReaderStore = useReaderStore;

