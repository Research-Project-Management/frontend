import type { ReaderFitMode, ReaderTab, ReaderTheme } from '../store/reader.store';

export const DEFAULT_READER_TABS: ReaderTab[] = [
  { id: 'library', title: 'My Library', type: 'library' },
];

export const MAX_READER_TABS = 15;
export const MAX_BOOKMARKED_ITEMS = 200;
export const MAX_READER_LRU_ITEMS = 150;

const READER_TABS_STORAGE_KEY = 'flux_reader_tabs';
const READER_ACTIVE_TAB_STORAGE_KEY = 'flux_reader_active_tab';
const READER_BOOKMARKS_STORAGE_KEY = 'flux_reader_bookmarks';
const READER_LRU_INDEX_STORAGE_KEY = 'flux_reader_lru_index';
const READER_PROGRESS_PREFIX = 'flux_reader_progress_';
const READER_ANNOTATIONS_PREFIX = 'flux_reader_annotations_';

/**
 * Evicts the oldest inactive paper tabs when the tab count exceeds MAX_READER_TABS.
 * Always preserves the 'library' tab and the currently active tab.
 */
export function enforceMaxReaderTabs(tabs: ReaderTab[], activeTabId: string): ReaderTab[] {
  if (tabs.length <= MAX_READER_TABS) return tabs;
  const result = [...tabs];
  while (result.length > MAX_READER_TABS) {
    const evictIdx = result.findIndex((t) => t.id !== 'library' && t.id !== activeTabId);
    if (evictIdx === -1) break;
    result.splice(evictIdx, 1);
  }
  return result;
}

/**
 * Evicts the oldest bookmarked items when the bookmark dictionary exceeds MAX_BOOKMARKED_ITEMS.
 */
export function enforceMaxBookmarkedItems(
  bookmarks: Record<string, number[]>,
): Record<string, number[]> {
  const keys = Object.keys(bookmarks);
  if (keys.length <= MAX_BOOKMARKED_ITEMS) return bookmarks;
  const keepKeys = keys.slice(keys.length - MAX_BOOKMARKED_ITEMS);
  const bounded: Record<string, number[]> = {};
  for (const k of keepKeys) {
    if (bookmarks[k] && bookmarks[k].length > 0) {
      bounded[k] = bookmarks[k];
    }
  }
  return bounded;
}

function readLruIndex(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(READER_LRU_INDEX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
  } catch {
    return [];
  }
}

function evictReaderItemStorageKeys(paperId: string): void {
  try {
    localStorage.removeItem(`${READER_PROGRESS_PREFIX}${paperId}`);
    localStorage.removeItem(`${READER_ANNOTATIONS_PREFIX}${paperId}`);
  } catch {
    // Ignore storage removal error
  }
}

/**
 * Updates the bounded LRU index (`flux_reader_lru_index`, max 150 item IDs)
 * and evicts the oldest item's progress/annotation keys when the cap is exceeded.
 */
export function touchReaderItemLruIndex(paperId: string): void {
  if (typeof window === 'undefined' || !paperId || paperId === 'library') return;
  try {
    const current = readLruIndex().filter((id) => id !== paperId);
    current.push(paperId);
    while (current.length > MAX_READER_LRU_ITEMS) {
      const oldestId = current.shift();
      if (oldestId) {
        evictReaderItemStorageKeys(oldestId);
      }
    }
    localStorage.setItem(READER_LRU_INDEX_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignore storage write error
  }
}

function safeSetReaderStorageItem(key: string, value: string, paperId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
    if (paperId) {
      touchReaderItemLruIndex(paperId);
    }
  } catch {
    // Handle QuotaExceededError gracefully by evicting oldest LRU items and retrying once
    try {
      const lru = readLruIndex();
      const evictCount = Math.max(1, Math.min(20, Math.ceil(lru.length / 4)));
      const evicted = lru.splice(0, evictCount);
      for (const oldId of evicted) {
        evictReaderItemStorageKeys(oldId);
      }
      localStorage.setItem(READER_LRU_INDEX_STORAGE_KEY, JSON.stringify(lru));
      localStorage.setItem(key, value);
      if (paperId) {
        touchReaderItemLruIndex(paperId);
      }
    } catch {
      // Ignore if storage remains full
    }
  }
}

/**
 * Persists per-paper reading progress (`flux_reader_progress_${paperId}`) with bounded LRU eviction.
 */
export function saveReaderProgressToStorage(paperId: string, progress: unknown): void {
  if (!paperId || paperId === 'library') return;
  safeSetReaderStorageItem(
    `${READER_PROGRESS_PREFIX}${paperId}`,
    JSON.stringify(progress),
    paperId,
  );
}

/**
 * Persists per-paper annotations cache (`flux_reader_annotations_${paperId}`) with bounded LRU eviction.
 */
export function saveReaderAnnotationsToStorage(paperId: string, annotations: unknown): void {
  if (!paperId || paperId === 'library') return;
  safeSetReaderStorageItem(
    `${READER_ANNOTATIONS_PREFIX}${paperId}`,
    JSON.stringify(annotations),
    paperId,
  );
}

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
        bookmarks = enforceMaxBookmarkedItems(parsedBookmarks as Record<string, number[]>);
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
      const rawTabs: ReaderTab[] = [DEFAULT_READER_TABS[0], ...filtered];
      const activeTabId =
        rawActive && rawTabs.some((t) => t.id === rawActive) ? rawActive : rawTabs[0].id;
      const tabs = enforceMaxReaderTabs(rawTabs, activeTabId);
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
  const boundedTabs = enforceMaxReaderTabs(tabs, activeTabId);
  safeSetReaderStorageItem(
    READER_TABS_STORAGE_KEY,
    JSON.stringify(boundedTabs),
    activeTabId !== 'library' ? activeTabId : undefined,
  );
  safeSetReaderStorageItem(READER_ACTIVE_TAB_STORAGE_KEY, activeTabId);
}

/**
 * Persists reader bookmarks to localStorage.
 */
export function saveReaderBookmarksToStorage(bookmarks: Record<string, number[]>): void {
  if (typeof window === 'undefined') return;
  const bounded = enforceMaxBookmarkedItems(bookmarks);
  safeSetReaderStorageItem(READER_BOOKMARKS_STORAGE_KEY, JSON.stringify(bounded));
}
