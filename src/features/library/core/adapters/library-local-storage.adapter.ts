/**
 * Library Local Storage Adapter (`local-substitutable`)
 *
 * Centralizes browser `localStorage` persistence for:
 * 1. Zotero Schema v42 Client-Side Bootstrap Cache (`flux:library:schema-v42:cache`)
 * 2. Reader Tabs, Active Tab & Bookmarks (`flux_reader_tabs`, `flux_reader_active_tab`, `flux_reader_bookmarks`)
 * 3. Feed Read Entry IDs (`flux_feed_read_entry_ids_v1`)
 *
 * Accepts an optional `StorageLike` implementation so unit tests can verify
 * persistence and eviction policies in-memory without touching `window.localStorage`.
 */

import {
  type LibrarySchemaRegistrySnapshot,
  updateLibrarySchemaRegistry,
  setSchemaPersistenceListener,
  getSchemaRegistryVersion,
  getLibrarySchemaSnapshot,
  registerSchemaRegistryUpdateListener,
} from '@/features/library/types/core.types';
import type { ReaderTab } from '@/features/library/types/reader.types';
import {
  DEFAULT_READER_TABS,
  MAX_READER_TABS,
  MAX_BOOKMARKED_ITEMS,
  MIN_READER_ZOOM,
  MAX_READER_ZOOM,
  enforceMaxReaderTabs,
  enforceMaxBookmarkedItems,
  normalizeReaderZoom,
  normalizeReaderFitMode,
  normalizeReaderTheme,
  normalizeReaderTab,
  resolveNextActiveTabOnClose,
} from '@/features/library/domain/reader-tab-pool.domain';

export {
  getSchemaRegistryVersion,
  getLibrarySchemaSnapshot,
  registerSchemaRegistryUpdateListener,
  type LibrarySchemaRegistrySnapshot,
  DEFAULT_READER_TABS,
  MAX_READER_TABS,
  MAX_BOOKMARKED_ITEMS,
  MIN_READER_ZOOM,
  MAX_READER_ZOOM,
  enforceMaxReaderTabs,
  enforceMaxBookmarkedItems,
  normalizeReaderZoom,
  normalizeReaderFitMode,
  normalizeReaderTheme,
  normalizeReaderTab,
  resolveNextActiveTabOnClose,
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let customStorageProvider: StorageLike | null = null;
let customSessionStorageProvider: StorageLike | null = null;

/**
 * Allows tests to substitute an in-memory `StorageLike` implementation
 * without monkey-patching `window.localStorage`.
 */
export function setLibraryStorageProvider(provider: StorageLike | null): void {
  customStorageProvider = provider;
}

/**
 * Allows tests to substitute an in-memory session `StorageLike` implementation
 * without monkey-patching `window.sessionStorage`.
 */
export function setLibrarySessionStorageProvider(provider: StorageLike | null): void {
  customSessionStorageProvider = provider;
}

function getActiveStorage(): StorageLike | null {
  if (customStorageProvider) return customStorageProvider;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

function getActiveSessionStorage(): StorageLike | null {
  if (customSessionStorageProvider) return customSessionStorageProvider;
  if (customStorageProvider) return null; // When custom localStorage is injected in tests, default sessionStorage to null unless explicitly injected
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    return window.sessionStorage;
  }
  return null;
}

export function isBrowser(): boolean {
  return getActiveStorage() !== null;
}

function safeSetStorageItem(key: string, value: string, storage = getActiveStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Gracefully ignore storage quota or private browsing errors
  }
}

// ── 1. Zotero Schema v42 Bootstrap Cache ─────────────────────────────────────

const SCHEMA_CACHE_KEY = 'flux:library:schema-v42:cache';
export const SCHEMA_VERSION = 42;
const SCHEMA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let memorySchemaSnapshot: unknown | null | undefined = undefined;

/**
 * Synchronizes dynamic item-type schemas into the in-memory domain registry,
 * increments the schema registry version counter, and notifies all subscribers.
 */
export function syncDynamicSchemasToMemory(
  data: unknown,
  options?: { persist?: boolean },
): LibrarySchemaRegistrySnapshot {
  updateLibrarySchemaRegistry(data, options);
  return getLibrarySchemaSnapshot();
}

export function saveSchemaCache(data: unknown, storage = getActiveStorage()): void {
  if (!data) return;
  memorySchemaSnapshot = data;
  if (!storage) return;
  safeSetStorageItem(
    SCHEMA_CACHE_KEY,
    JSON.stringify({
      version: SCHEMA_VERSION,
      timestamp: Date.now(),
      data,
    }),
    storage,
  );
}

export function loadSchemaCache(storage = getActiveStorage()): unknown | null {
  if (memorySchemaSnapshot !== undefined && memorySchemaSnapshot !== null) {
    return memorySchemaSnapshot;
  }
  if (!storage) return null;
  try {
    const raw = storage.getItem(SCHEMA_CACHE_KEY);
    if (!raw) {
      memorySchemaSnapshot = null;
      return null;
    }
    const parsed = JSON.parse(raw) as {
      version?: number;
      timestamp?: number;
      data?: unknown;
    } | null;

    const isValid =
      parsed !== null &&
      typeof parsed === 'object' &&
      parsed.version === SCHEMA_VERSION &&
      Boolean(parsed.data) &&
      typeof parsed.timestamp === 'number' &&
      Date.now() - parsed.timestamp <= SCHEMA_MAX_AGE_MS;

    if (!isValid) {
      storage.removeItem(SCHEMA_CACHE_KEY);
      memorySchemaSnapshot = null;
      return null;
    }

    memorySchemaSnapshot = parsed.data;
    return memorySchemaSnapshot;
  } catch {
    try {
      storage.removeItem(SCHEMA_CACHE_KEY);
    } catch {
      // ignore
    }
    memorySchemaSnapshot = null;
    return null;
  }
}

// Register storage persistence listener with domain layer
setSchemaPersistenceListener((data) => saveSchemaCache(data));

// Immediately hydrate domain registry from cached schema if available
if (isBrowser()) {
  const cached = loadSchemaCache();
  if (cached) {
    syncDynamicSchemasToMemory(cached, { persist: false });
  }
}

// ── 2. Feed Read Entry IDs Persistence ───────────────────────────────────────

const FEED_READ_IDS_STORAGE_KEY = 'flux_feed_read_entry_ids_v1';
const MAX_PERSISTED_FEED_READ_IDS = 2000;

export function loadFeedReadEntryIdsFromStorage(
  storage = getActiveStorage(),
): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(FEED_READ_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(
        parsed
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .slice(-MAX_PERSISTED_FEED_READ_IDS),
      );
    }
  } catch {
    // Ignore storage read error
  }
  return new Set();
}

export function saveFeedReadEntryIdsToStorage(
  readIds: Iterable<string>,
  storage = getActiveStorage(),
): void {
  if (!storage) return;
  try {
    const arr = Array.from(readIds).filter(Boolean);
    const bounded =
      arr.length > MAX_PERSISTED_FEED_READ_IDS
        ? arr.slice(arr.length - MAX_PERSISTED_FEED_READ_IDS)
        : arr;
    safeSetStorageItem(FEED_READ_IDS_STORAGE_KEY, JSON.stringify(bounded), storage);
  } catch {
    // Ignore storage quota error
  }
}

// ── 3. Reader Tabs & Bookmarks Persistence ───────────────────────────────────

export const READER_TABS_STORAGE_KEY = 'flux_reader_tabs';
export const READER_ACTIVE_TAB_STORAGE_KEY = 'flux_reader_active_tab';
export const READER_BOOKMARKS_STORAGE_KEY = 'flux_reader_bookmarks';
export { FEED_READ_IDS_STORAGE_KEY };

/**
 * Hydrates initial reader tabs and bookmarks from storage (SSR-safe).
 * Per-window `activeTabId` prefers `sessionStorage` so two browser windows can
 * read two different papers side-by-side without clobbering each other's active tab,
 * falling back to `localStorage` when opening a fresh tab.
 */
export function loadReaderStorageState(
  storage = getActiveStorage(),
  sessionStorage = getActiveSessionStorage(),
): {
  tabs: ReaderTab[];
  activeTabId: string;
  bookmarks: Record<string, number[]>;
} {
  if (!storage) {
    return { tabs: DEFAULT_READER_TABS, activeTabId: 'library', bookmarks: {} };
  }

  let bookmarks: Record<string, number[]> = {};
  try {
    const rawBookmarks = storage.getItem(READER_BOOKMARKS_STORAGE_KEY);
    if (rawBookmarks) {
      const parsedBookmarks = JSON.parse(rawBookmarks);
      if (
        parsedBookmarks &&
        typeof parsedBookmarks === 'object' &&
        !Array.isArray(parsedBookmarks)
      ) {
        bookmarks = enforceMaxBookmarkedItems(
          parsedBookmarks as Record<string, number[]>,
        );
      }
    }
  } catch {
    // Ignore storage read error
  }

  try {
    const raw = storage.getItem(READER_TABS_STORAGE_KEY);
    let sessionActive: string | null = null;
    try {
      sessionActive = sessionStorage?.getItem(READER_ACTIVE_TAB_STORAGE_KEY) ?? null;
    } catch {
      sessionActive = null;
    }
    const rawActive = sessionActive || storage.getItem(READER_ACTIVE_TAB_STORAGE_KEY);
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
        rawActive && rawTabs.some((t) => t.id === rawActive)
          ? rawActive
          : rawTabs[0].id;
      const tabs = enforceMaxReaderTabs(rawTabs, activeTabId);
      return { tabs, activeTabId, bookmarks };
    }
  } catch {
    // Ignore parse error
  }

  return { tabs: DEFAULT_READER_TABS, activeTabId: 'library', bookmarks };
}

/**
 * Merges incoming tabs with existing persisted tabs in `localStorage` (Read-Modify-Write)
 * to prevent a background browser tab with stale in-memory state from clobbering
 * newly opened tabs in another browser tab.
 */
export function mergeReaderTabsWithStorage(
  localTabs: ReaderTab[],
  options?: {
    removedIds?: Iterable<string>;
    replaceOrder?: boolean;
    storage?: StorageLike | null;
  },
): ReaderTab[] {
  const storage = options?.storage !== undefined ? options.storage : getActiveStorage();
  if (!storage || options?.replaceOrder) {
    return localTabs;
  }

  const removedSet = new Set(options?.removedIds ?? []);
  try {
    const raw = storage.getItem(READER_TABS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return localTabs;
    }

    const persistedTabs = parsed
      .filter(
        (t: unknown): t is ReaderTab =>
          Boolean(
            t &&
              typeof t === 'object' &&
              'id' in t &&
              typeof (t as { id: unknown }).id === 'string' &&
              (t as { id: string }).id !== 'library' &&
              !removedSet.has((t as { id: string }).id),
          ),
      )
      .map(normalizeReaderTab);

    const localById = new Map<string, ReaderTab>();
    for (const tab of localTabs) {
      if (tab.id !== 'library' && !removedSet.has(tab.id)) {
        localById.set(tab.id, tab);
      }
    }

    const mergedNonLibrary: ReaderTab[] = [];
    const seenIds = new Set<string>();

    // Preserve local tabs order and latest local state
    for (const tab of localTabs) {
      if (tab.id === 'library' || removedSet.has(tab.id)) continue;
      mergedNonLibrary.push(tab);
      seenIds.add(tab.id);
    }

    // Append any tabs opened in other browser tabs that this tab didn't know about
    for (const pTab of persistedTabs) {
      if (!seenIds.has(pTab.id) && !localById.has(pTab.id)) {
        mergedNonLibrary.push(pTab);
        seenIds.add(pTab.id);
      }
    }

    return [DEFAULT_READER_TABS[0], ...mergedNonLibrary];
  } catch {
    return localTabs;
  }
}

/**
 * Persists reader tabs to `localStorage` and `activeTabId` to both `sessionStorage`
 * (window-isolated) and `localStorage` (fallback for new tabs).
 */
export function saveReaderTabsToStorage(
  tabs: ReaderTab[],
  activeTabId: string,
  storage = getActiveStorage(),
  options?: {
    removedIds?: Iterable<string>;
    replaceOrder?: boolean;
    sessionStorage?: StorageLike | null;
  },
): ReaderTab[] {
  const sessionStorage =
    options?.sessionStorage !== undefined ? options.sessionStorage : getActiveSessionStorage();
  if (!storage) return tabs;

  const merged = mergeReaderTabsWithStorage(tabs, {
    removedIds: options?.removedIds,
    replaceOrder: options?.replaceOrder,
    storage,
  });
  const boundedTabs = enforceMaxReaderTabs(merged, activeTabId);
  safeSetStorageItem(READER_TABS_STORAGE_KEY, JSON.stringify(boundedTabs), storage);
  safeSetStorageItem(READER_ACTIVE_TAB_STORAGE_KEY, activeTabId, storage);
  if (sessionStorage) {
    safeSetStorageItem(READER_ACTIVE_TAB_STORAGE_KEY, activeTabId, sessionStorage);
  }
  return boundedTabs;
}

/**
 * Persists reader bookmarks to storage, merging with other tabs' bookmarks unless
 * a specific `updatedPaperId` was modified/cleared by this tab.
 */
export function saveReaderBookmarksToStorage(
  bookmarks: Record<string, number[]>,
  storage = getActiveStorage(),
  updatedPaperId?: string,
): Record<string, number[]> {
  if (!storage) return bookmarks;

  let mergedSource: Record<string, number[]> = bookmarks;
  if (updatedPaperId) {
    try {
      const raw = storage.getItem(READER_BOOKMARKS_STORAGE_KEY);
      if (raw) {
        const persisted = JSON.parse(raw);
        if (persisted && typeof persisted === 'object' && !Array.isArray(persisted)) {
          mergedSource = {
            ...(persisted as Record<string, number[]>),
            ...bookmarks,
          };
          if (!(updatedPaperId in bookmarks)) {
            delete mergedSource[updatedPaperId];
          }
        }
      }
    } catch {
      mergedSource = bookmarks;
    }
  }

  const bounded = enforceMaxBookmarkedItems(mergedSource);
  safeSetStorageItem(READER_BOOKMARKS_STORAGE_KEY, JSON.stringify(bounded), storage);
  return bounded;
}
