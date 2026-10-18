import type { ReaderFitMode, ReaderTab, ReaderTheme } from '../store/reader.store';

export const DEFAULT_READER_TABS: ReaderTab[] = [
  { id: 'library', title: 'My Library', type: 'library' },
];

const READER_TABS_STORAGE_KEY = 'flux_reader_tabs';
const READER_ACTIVE_TAB_STORAGE_KEY = 'flux_reader_active_tab';
const READER_BOOKMARKS_STORAGE_KEY = 'flux_reader_bookmarks';

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

/**
 * Normalizes a ReaderTab record to guarantee valid page, zoom, fitMode, rotation, and theme values.
 */
export function normalizeReaderTab(tab: ReaderTab): ReaderTab {
  if (tab.type === 'library' || tab.id === 'library') {
    return { id: 'library', title: tab.title || 'My Library', type: 'library' };
  }
  return {
    ...tab,
    type: 'paper',
    currentPage: Math.max(1, Math.floor(tab.currentPage ?? 1)),
    zoom: normalizeReaderZoom(tab.zoom ?? 1.0),
    fitMode: (tab.fitMode ?? 'page-width') as ReaderFitMode,
    rotation: (((tab.rotation ?? 0) % 360) + 360) % 360,
    theme: (tab.theme ?? 'light') as ReaderTheme,
  };
}

/**
 * Resolves the next active tab ID when closing a tab:
 * prefers right neighbor -> left neighbor -> first remaining tab -> 'library'.
 */
export function resolveNextActiveTabOnClose(
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
  const rightNeighbor = tabs[idx + 1];
  if (rightNeighbor) return rightNeighbor.id;
  const leftNeighbor = tabs[idx - 1];
  if (leftNeighbor) return leftNeighbor.id;
  return nextTabs[0]?.id ?? 'library';
}

/**
 * Hydrates initial reader tabs and bookmarks from localStorage (SSR-safe).
 */
export function loadReaderStorageState(): {
  tabs: ReaderTab[];
  activeTabId: string;
  bookmarks: Record<string, number[]>;
} {
  if (typeof window === 'undefined') {
    return { tabs: DEFAULT_READER_TABS, activeTabId: 'library', bookmarks: {} };
  }

  let bookmarks: Record<string, number[]> = {};
  try {
    const rawBookmarks = localStorage.getItem(READER_BOOKMARKS_STORAGE_KEY);
    if (rawBookmarks) {
      const parsedBookmarks = JSON.parse(rawBookmarks);
      if (parsedBookmarks && typeof parsedBookmarks === 'object' && !Array.isArray(parsedBookmarks)) {
        bookmarks = parsedBookmarks as Record<string, number[]>;
      }
    }
  } catch {
    // Ignore storage read error
  }

  try {
    const raw = localStorage.getItem(READER_TABS_STORAGE_KEY);
    const rawActive = localStorage.getItem(READER_ACTIVE_TAB_STORAGE_KEY);
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
        .map(normalizeReaderTab);
      const tabs: ReaderTab[] = [DEFAULT_READER_TABS[0], ...filtered];
      const activeTabId =
        rawActive && tabs.some((t) => t.id === rawActive) ? rawActive : tabs[0].id;
      return { tabs, activeTabId, bookmarks };
    }
  } catch {
    // Ignore parse error
  }

  return { tabs: DEFAULT_READER_TABS, activeTabId: 'library', bookmarks };
}

/**
 * Persists reader tabs and activeTabId to localStorage.
 */
export function saveReaderTabsToStorage(tabs: ReaderTab[], activeTabId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READER_TABS_STORAGE_KEY, JSON.stringify(tabs));
    localStorage.setItem(READER_ACTIVE_TAB_STORAGE_KEY, activeTabId);
  } catch {
    // Ignore storage write error
  }
}

/**
 * Persists reader bookmarks to localStorage.
 */
export function saveReaderBookmarksToStorage(bookmarks: Record<string, number[]>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(READER_BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // Ignore storage write error
  }
}
