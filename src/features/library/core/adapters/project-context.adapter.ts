'use client';

import { useMemo } from 'react';
import { useProjectsQuery } from '@/features/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  type LibrarySchemaRegistrySnapshot,
  updateLibrarySchemaRegistry,
  setSchemaPersistenceListener,
  getSchemaRegistryVersion,
  getLibrarySchemaSnapshot,
  registerSchemaRegistryUpdateListener,
} from '@/features/library/types/core.types';
import type { ReaderFitMode, ReaderTab, ReaderTheme } from '@/features/library/types/reader.types';

export {
  getSchemaRegistryVersion,
  getLibrarySchemaSnapshot,
  registerSchemaRegistryUpdateListener,
  type LibrarySchemaRegistrySnapshot,
};

/**
 * Synchronizes dynamic item-type schemas into the in-memory domain registry,
 * increments the schema registry version counter, and notifies all subscribers.
 * Returns an immutable snapshot of the updated schema registry.
 */
function syncDynamicSchemasToMemory(
  data: unknown,
  options?: { persist?: boolean },
): LibrarySchemaRegistrySnapshot {
  updateLibrarySchemaRegistry(data, options);
  return getLibrarySchemaSnapshot();
}

interface LibraryProjectScope {
  id: string;
  name: string;
  role?: string;
  permissions?: string[] | Record<string, unknown>;
  effectivePermissions?: string[];
  members?: Array<{ id?: string; userId: string; role: string }>;
  [key: string]: unknown;
}

interface LibraryUserSession {
  id?: string;
  email?: string;
  name?: string;
}

interface UseLibraryProjectContextReturn {
  projects: LibraryProjectScope[];
  isLoadingProjects: boolean;
  currentUser: LibraryUserSession | null;
  currentUserId?: string;
  isAuthenticated: boolean;
}

/**
 * Anti-Corruption Layer (ACL) / Adapter for Library Feature.
 * Decouples library internals from external project and authentication module implementations.
 */
export function useLibraryProjectContext(): UseLibraryProjectContextReturn {
  const { projects = [], isLoading } = useProjectsQuery();
  const { user, isAuthenticated } = useAuth();

  const mappedProjects = useMemo(
    () =>
      projects.map(
        (p): LibraryProjectScope => ({
          ...p,
          id: p.id,
          name: p.name,
          role: typeof p.role === 'string' ? p.role : undefined,
          permissions: p.permissions,
        }),
      ),
    [projects],
  );

  const currentUser = useMemo(
    () => (user ? { id: user.id, email: user.email, name: user.name } : null),
    [user],
  );

  return {
    projects: mappedProjects,
    isLoadingProjects: isLoading,
    currentUser,
    currentUserId: user?.id,
    isAuthenticated,
  };
}

/**
 * Centralized Storage Adapter for Zotero Schema v42 Client-Side Bootstrap Cache.
 * Isolates browser localStorage side effects away from pure domain/types modules.
 */
const SCHEMA_CACHE_KEY = 'flux:library:schema-v42:cache';
export const SCHEMA_VERSION = 42;
const SCHEMA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

let memorySchemaSnapshot: unknown | null | undefined = undefined;

function saveSchemaCache(data: unknown): void {
  if (!data) return;
  memorySchemaSnapshot = data;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      SCHEMA_CACHE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        timestamp: Date.now(),
        data,
      }),
    );
  } catch {
    // Gracefully handle storage quota or private browsing mode
  }
}

function loadSchemaCache(): unknown | null {
  if (memorySchemaSnapshot !== undefined && memorySchemaSnapshot !== null) {
    return memorySchemaSnapshot;
  }
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SCHEMA_CACHE_KEY);
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
      window.localStorage.removeItem(SCHEMA_CACHE_KEY);
      memorySchemaSnapshot = null;
      return null;
    }

    memorySchemaSnapshot = parsed.data;
    return memorySchemaSnapshot;
  } catch {
    try {
      window.localStorage.removeItem(SCHEMA_CACHE_KEY);
    } catch {
      // ignore
    }
    memorySchemaSnapshot = null;
    return null;
  }
}

// Register storage persistence listener with domain layer
setSchemaPersistenceListener(saveSchemaCache);

// Immediately hydrate domain registry from cached schema if available
if (isBrowser()) {
  const cached = loadSchemaCache();
  if (cached) {
    syncDynamicSchemasToMemory(cached, { persist: false });
  }
}

const DEFAULT_READER_TABS: ReaderTab[] = [
  { id: 'library', title: 'My Library', type: 'library' },
];

export const MAX_READER_TABS = 15;
export const MAX_BOOKMARKED_ITEMS = 200;
export const MIN_READER_ZOOM = 0.25;
export const MAX_READER_ZOOM = 5.0;

const READER_TABS_STORAGE_KEY = 'flux_reader_tabs';
const READER_ACTIVE_TAB_STORAGE_KEY = 'flux_reader_active_tab';
const READER_BOOKMARKS_STORAGE_KEY = 'flux_reader_bookmarks';
const FEED_READ_IDS_STORAGE_KEY = 'flux_feed_read_entry_ids_v1';
const MAX_PERSISTED_FEED_READ_IDS = 2000;

export function loadFeedReadEntryIdsFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(FEED_READ_IDS_STORAGE_KEY);
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

export function saveFeedReadEntryIdsToStorage(readIds: Iterable<string>): void {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.from(readIds).filter(Boolean);
    const bounded =
      arr.length > MAX_PERSISTED_FEED_READ_IDS
        ? arr.slice(arr.length - MAX_PERSISTED_FEED_READ_IDS)
        : arr;
    safeSetReaderStorageItem(FEED_READ_IDS_STORAGE_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore storage quota error
  }
}

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

function safeSetReaderStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Normalizes zoom input whether provided as a float scale (e.g. 1.25)
 * or percentage (e.g. 125) into a clamped float scale in [0.25, 3.0].
 */
export function normalizeReaderZoom(rawZoom?: number | null): number {
  if (typeof rawZoom !== 'number' || Number.isNaN(rawZoom) || rawZoom <= 0) {
    return 1.0;
  }
  const scale = rawZoom > 10 ? rawZoom / 100 : rawZoom;
  return Math.min(MAX_READER_ZOOM, Math.max(MIN_READER_ZOOM, Number(scale.toFixed(4))));
}

export function normalizeReaderFitMode(raw?: string | null): ReaderFitMode {
  if (raw === 'fit-width' || raw === 'page-width') return 'fit-width';
  if (raw === 'fit-page' || raw === 'page-fit') return 'fit-page';
  if (raw === 'manual') return 'custom';
  if (raw === 'auto' || raw === 'custom') return raw;
  return 'fit-width';
}

export function normalizeReaderTheme(raw?: string | null): ReaderTheme {
  if (raw === 'normal' || raw === 'light') return 'normal';
  if (raw === 'sepia' || raw === 'dark' || raw === 'invert') return raw;
  return 'normal';
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
    scrollTop:
      typeof tab.scrollTop === 'number' && Number.isFinite(tab.scrollTop) && tab.scrollTop >= 0
        ? Math.round(tab.scrollTop)
        : undefined,
    zoom: normalizeReaderZoom(tab.zoom ?? 1.0),
    fitMode: normalizeReaderFitMode(tab.fitMode),
    rotation: (((tab.rotation ?? 0) % 360) + 360) % 360,
    theme: normalizeReaderTheme(tab.theme),
    viewMode:
      tab.viewMode === 'single' || tab.viewMode === 'continuous' || tab.viewMode === 'spread'
        ? tab.viewMode
        : 'continuous',
    splitMode:
      tab.splitMode === 'none' || tab.splitMode === 'horizontal' || tab.splitMode === 'vertical'
        ? tab.splitMode
        : 'none',
    secondaryPage:
      typeof tab.secondaryPage === 'number' && Number.isFinite(tab.secondaryPage) && tab.secondaryPage >= 1
        ? Math.max(1, Math.floor(tab.secondaryPage))
        : 1,
    interactionMode:
      tab.interactionMode === 'select' || tab.interactionMode === 'hand'
        ? tab.interactionMode
        : 'select',
    ...(tab.attachmentId !== undefined ? { attachmentId: tab.attachmentId } : {}),
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
