/**
 * editor-tabs-storage.adapter.ts
 *
 * Multi-Window Local/Session Storage Adapter for Editor Tabs (1:1 Reader Architecture Parity).
 * - Persists per-page open tab lists to `localStorage` (`flux_editor_tabs_v1`) via Read-Modify-Write
 *   so background browser windows never clobber newly opened tabs in sibling windows.
 * - Isolates per-window view state (`activeTabId`, `splitMode`, `secondaryTabId`) in `sessionStorage`
 *   (`flux_editor_window_state_v1`) so two windows viewing the same Page remain independent while
 *   surviving F5 reloads.
 */

import { EDITOR_STORAGE_KEYS } from '@/features/editor/domain/constants/editor.constants';
import {
  MAX_PERSISTED_EDITOR_PAGES,
  enforceMaxEditorTabs,
} from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';

export type PersistedSplitMode = 'none' | 'vertical' | 'horizontal';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SerializedEditorTab {
  id: string;
  title: string;
  path?: string;
  fileUrl?: string;
  isPinned?: boolean;
  isPreview?: boolean;
  isRoot?: boolean;
  lastAccessedAt?: number;
}

export interface PersistedPageTabsEntry {
  tabs: SerializedEditorTab[];
  activeTabId: string | null;
  updatedAt: number;
}

export interface EditorTabsEnvelope {
  version: 1;
  pages: Record<string, PersistedPageTabsEntry>;
}

export interface PersistedWindowPageState {
  activeTabId: string | null;
  splitMode?: PersistedSplitMode;
  secondaryTabId?: string | null;
  updatedAt: number;
}

export type EditorWindowStateMap = Record<string, PersistedWindowPageState>;

let customStorageProvider: StorageLike | null = null;
let customSessionStorageProvider: StorageLike | null = null;
const pendingActiveTabSaves = new Map<
  string,
  { timer: ReturnType<typeof setTimeout>; execute: () => void }
>();
let beforeUnloadFlushRegistered = false;

function cancelPendingActiveTabSave(pageId: string): void {
  const pending = pendingActiveTabSaves.get(pageId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingActiveTabSaves.delete(pageId);
  }
}

export function flushPendingEditorTabSaves(targetPageId?: string): void {
  if (targetPageId !== undefined) {
    const pending = pendingActiveTabSaves.get(targetPageId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingActiveTabSaves.delete(targetPageId);
      pending.execute();
    }
    return;
  }

  for (const [pageId, pending] of Array.from(pendingActiveTabSaves.entries())) {
    clearTimeout(pending.timer);
    pendingActiveTabSaves.delete(pageId);
    pending.execute();
  }
}

function ensureBeforeUnloadFlushListener(): void {
  if (beforeUnloadFlushRegistered || typeof window === 'undefined') return;
  beforeUnloadFlushRegistered = true;
  window.addEventListener('beforeunload', () => {
    flushPendingEditorTabSaves();
  });
}

export function setEditorTabsStorageProvider(provider: StorageLike | null): void {
  flushPendingEditorTabSaves();
  customStorageProvider = provider;
}

export function setEditorWindowStorageProvider(provider: StorageLike | null): void {
  flushPendingEditorTabSaves();
  customSessionStorageProvider = provider;
}

function getActiveStorage(explicit?: StorageLike | null): StorageLike | null {
  if (explicit !== undefined) return explicit;
  if (customStorageProvider) return customStorageProvider;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

function getActiveSessionStorage(explicit?: StorageLike | null): StorageLike | null {
  if (explicit !== undefined) return explicit;
  if (customSessionStorageProvider) return customSessionStorageProvider;
  if (customStorageProvider) return null;
  if (typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined') {
    return window.sessionStorage;
  }
  return null;
}

function safeSetItem(storage: StorageLike | null, key: string, value: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Gracefully ignore storage quota or private browsing errors
  }
}

function readEnvelope(storage: StorageLike | null): EditorTabsEnvelope {
  if (!storage) return { version: 1, pages: {} };
  try {
    const raw = storage.getItem(EDITOR_STORAGE_KEYS.EDITOR_TABS);
    if (!raw) return { version: 1, pages: {} };
    const parsed = JSON.parse(raw) as Partial<EditorTabsEnvelope> | null;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === 1 &&
      parsed.pages &&
      typeof parsed.pages === 'object' &&
      !Array.isArray(parsed.pages)
    ) {
      return { version: 1, pages: parsed.pages };
    }
  } catch {
    // Ignore malformed JSON
  }
  return { version: 1, pages: {} };
}

function readWindowMap(sessionStorage: StorageLike | null): EditorWindowStateMap {
  if (!sessionStorage) return {};
  try {
    const raw = sessionStorage.getItem(EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as EditorWindowStateMap | null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore malformed JSON
  }
  return {};
}

function serializeTab(tab: WorkspaceTab): SerializedEditorTab {
  return {
    id: tab.id,
    title: tab.title,
    ...(tab.path !== undefined ? { path: tab.path } : {}),
    ...(tab.fileUrl !== undefined ? { fileUrl: tab.fileUrl } : {}),
    ...(tab.isPinned !== undefined ? { isPinned: Boolean(tab.isPinned) } : {}),
    ...(tab.isPreview !== undefined ? { isPreview: Boolean(tab.isPreview) } : {}),
    ...(tab.isRoot !== undefined ? { isRoot: Boolean(tab.isRoot) } : {}),
    ...(tab.lastAccessedAt !== undefined ? { lastAccessedAt: tab.lastAccessedAt } : {}),
  };
}

function normalizePersistedTab(raw: unknown): WorkspaceTab | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<SerializedEditorTab>;
  if (typeof candidate.id !== 'string' || !candidate.id) return null;
  const title = typeof candidate.title === 'string' && candidate.title ? candidate.title : candidate.id;
  return {
    id: candidate.id,
    title,
    ...(typeof candidate.path === 'string' ? { path: candidate.path } : {}),
    ...(typeof candidate.fileUrl === 'string' ? { fileUrl: candidate.fileUrl } : {}),
    isPinned: candidate.isRoot ? true : Boolean(candidate.isPinned ?? !candidate.isPreview),
    isPreview: candidate.isRoot ? false : Boolean(candidate.isPreview && !candidate.isPinned),
    ...(candidate.isRoot !== undefined ? { isRoot: Boolean(candidate.isRoot) } : {}),
    lastAccessedAt:
      typeof candidate.lastAccessedAt === 'number' && Number.isFinite(candidate.lastAccessedAt)
        ? candidate.lastAccessedAt
        : 0,
  };
}

function prunePagesMap<T extends { updatedAt?: number }>(
  map: Record<string, T>,
  maxPages = MAX_PERSISTED_EDITOR_PAGES,
): Record<string, T> {
  const entries = Object.entries(map);
  if (entries.length <= maxPages) return map;
  entries.sort((a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0));
  return Object.fromEntries(entries.slice(0, maxPages));
}

/**
 * Merges local in-memory tabs with persisted tabs in `localStorage` (Read-Modify-Write)
 * so concurrent browser windows never erase each other's open tabs.
 */
export function mergeEditorTabsWithStorage(
  pageId: string,
  localTabs: readonly WorkspaceTab[],
  options?: {
    removedIds?: Iterable<string>;
    replaceOrder?: boolean;
    storage?: StorageLike | null;
  },
): WorkspaceTab[] {
  flushPendingEditorTabSaves(pageId);
  const storage = getActiveStorage(options?.storage);
  const removedSet = new Set(options?.removedIds ?? []);
  const filteredLocal = localTabs.filter((t) => !removedSet.has(t.id));

  if (!storage || options?.replaceOrder) {
    return filteredLocal;
  }

  const envelope = readEnvelope(storage);
  const pageEntry = envelope.pages[pageId];
  if (!pageEntry || !Array.isArray(pageEntry.tabs) || pageEntry.tabs.length === 0) {
    return filteredLocal;
  }

  const merged: WorkspaceTab[] = [];
  const seenIds = new Set<string>();

  for (const tab of filteredLocal) {
    if (!tab.id || seenIds.has(tab.id)) continue;
    merged.push(tab);
    seenIds.add(tab.id);
  }

  for (const rawPersisted of pageEntry.tabs) {
    const pTab = normalizePersistedTab(rawPersisted);
    if (!pTab || removedSet.has(pTab.id) || seenIds.has(pTab.id)) continue;
    merged.push(pTab);
    seenIds.add(pTab.id);
  }

  return merged;
}

export interface SaveEditorTabsOptions {
  maxTabs?: number;
  removedIds?: Iterable<string>;
  replaceOrder?: boolean;
  splitMode?: PersistedSplitMode;
  secondaryTabId?: string | null;
  rootPageId?: string | null;
  isDirtyFn?: (id: string) => boolean;
  storage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
}

export function saveEditorTabsForPage(
  pageId: string,
  tabs: readonly WorkspaceTab[],
  activeTabId: string | null,
  options?: SaveEditorTabsOptions,
): WorkspaceTab[] {
  if (!pageId) return [...tabs];
  cancelPendingActiveTabSave(pageId);
  const storage = getActiveStorage(options?.storage);
  const sessionStorage = getActiveSessionStorage(options?.sessionStorage);

  const merged = mergeEditorTabsWithStorage(pageId, tabs, {
    removedIds: options?.removedIds,
    replaceOrder: options?.replaceOrder,
    storage,
  });

  const boundedTabs = enforceMaxEditorTabs(merged, {
    ...(options?.maxTabs !== undefined ? { maxTabs: options.maxTabs } : {}),
    activeTabId,
    secondaryTabId: options?.secondaryTabId,
    rootPageId: options?.rootPageId ?? pageId,
    isDirtyFn: options?.isDirtyFn,
  });

  const now = Date.now();

  if (storage) {
    const envelope = readEnvelope(storage);
    const nextPages = prunePagesMap({
      ...envelope.pages,
      [pageId]: {
        tabs: boundedTabs.map(serializeTab),
        activeTabId,
        updatedAt: now,
      },
    });
    safeSetItem(
      storage,
      EDITOR_STORAGE_KEYS.EDITOR_TABS,
      JSON.stringify({ version: 1, pages: nextPages } satisfies EditorTabsEnvelope),
    );
  }

  if (sessionStorage) {
    const windowMap = readWindowMap(sessionStorage);
    const prevWindow = windowMap[pageId];
    const nextWindowState: PersistedWindowPageState = {
      activeTabId,
      ...(options?.splitMode !== undefined
        ? { splitMode: options.splitMode }
        : prevWindow?.splitMode !== undefined
          ? { splitMode: prevWindow.splitMode }
          : {}),
      ...(options?.secondaryTabId !== undefined
        ? { secondaryTabId: options.secondaryTabId }
        : prevWindow?.secondaryTabId !== undefined
          ? { secondaryTabId: prevWindow.secondaryTabId }
          : {}),
      updatedAt: now,
    };
    const nextWindowMap = prunePagesMap({
      ...windowMap,
      [pageId]: nextWindowState,
    });
    safeSetItem(
      sessionStorage,
      EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE,
      JSON.stringify(nextWindowMap),
    );
  }

  return boundedTabs;
}

export function saveEditorWindowSplitState(
  pageId: string,
  patch: {
    activeTabId?: string | null;
    splitMode?: PersistedSplitMode;
    secondaryTabId?: string | null;
  },
  options?: {
    storage?: StorageLike | null;
    sessionStorage?: StorageLike | null;
    skipLocalStorage?: boolean;
  },
): void {
  if (!pageId) return;
  const sessionStorage = getActiveSessionStorage(options?.sessionStorage);
  if (sessionStorage) {
    const windowMap = readWindowMap(sessionStorage);
    const prev = windowMap[pageId];
    const nextWindowMap = prunePagesMap({
      ...windowMap,
      [pageId]: {
        activeTabId: patch.activeTabId !== undefined ? patch.activeTabId : (prev?.activeTabId ?? null),
        ...(patch.splitMode !== undefined
          ? { splitMode: patch.splitMode }
          : prev?.splitMode !== undefined
            ? { splitMode: prev.splitMode }
            : {}),
        ...(patch.secondaryTabId !== undefined
          ? { secondaryTabId: patch.secondaryTabId }
          : prev?.secondaryTabId !== undefined
            ? { secondaryTabId: prev.secondaryTabId }
            : {}),
        updatedAt: Date.now(),
      },
    });
    safeSetItem(
      sessionStorage,
      EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE,
      JSON.stringify(nextWindowMap),
    );
  }

  if (patch.activeTabId !== undefined && !options?.skipLocalStorage) {
    const storage = getActiveStorage(options?.storage);
    if (storage) {
      const envelope = readEnvelope(storage);
      const pageEntry = envelope.pages[pageId];
      if (pageEntry) {
        const nextPages = {
          ...envelope.pages,
          [pageId]: {
            ...pageEntry,
            activeTabId: patch.activeTabId,
            updatedAt: Date.now(),
          },
        };
        safeSetItem(
          storage,
          EDITOR_STORAGE_KEYS.EDITOR_TABS,
          JSON.stringify({ version: 1, pages: nextPages } satisfies EditorTabsEnvelope),
        );
      }
    }
  }
}

/**
 * Updates per-window `sessionStorage` immediately and debounces the heavier `localStorage`
 * RMW envelope write by 150 ms so rapid tab switching across 30+ files incurs zero synchronous JSON churn.
 */
export function scheduleSaveActiveEditorTab(
  pageId: string,
  tabs: readonly WorkspaceTab[],
  activeTabId: string | null,
  options?: SaveEditorTabsOptions,
  delayMs = 150,
): void {
  if (!pageId) return;
  saveEditorWindowSplitState(
    pageId,
    { activeTabId },
    {
      storage: options?.storage,
      sessionStorage: options?.sessionStorage,
      skipLocalStorage: delayMs > 0,
    },
  );

  if (delayMs <= 0) {
    saveEditorTabsForPage(pageId, tabs, activeTabId, options);
    return;
  }

  cancelPendingActiveTabSave(pageId);
  ensureBeforeUnloadFlushListener();

  const snapshotTabs = [...tabs];
  const execute = () => {
    saveEditorTabsForPage(pageId, snapshotTabs, activeTabId, options);
  };
  const timer = setTimeout(() => {
    pendingActiveTabSaves.delete(pageId);
    execute();
  }, delayMs);
  pendingActiveTabSaves.set(pageId, { timer, execute });
}

export function loadEditorTabsForPage(
  pageId: string,
  options?: {
    storage?: StorageLike | null;
    sessionStorage?: StorageLike | null;
  },
): {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  splitMode?: PersistedSplitMode;
  secondaryTabId: string | null;
} {
  if (!pageId) {
    return { tabs: [], activeTabId: null, secondaryTabId: null };
  }
  flushPendingEditorTabSaves(pageId);

  const storage = getActiveStorage(options?.storage);
  const sessionStorage = getActiveSessionStorage(options?.sessionStorage);

  const envelope = readEnvelope(storage);
  const pageEntry = envelope.pages[pageId];
  const windowMap = readWindowMap(sessionStorage);
  const windowEntry = windowMap[pageId];

  const tabs: WorkspaceTab[] = [];
  const seen = new Set<string>();
  if (pageEntry && Array.isArray(pageEntry.tabs)) {
    for (const raw of pageEntry.tabs) {
      const tab = normalizePersistedTab(raw);
      if (tab && !seen.has(tab.id)) {
        seen.add(tab.id);
        tabs.push(tab);
      }
    }
  }

  const candidateActive = windowEntry?.activeTabId ?? pageEntry?.activeTabId ?? null;
  const activeTabId =
    candidateActive && tabs.some((t) => t.id === candidateActive)
      ? candidateActive
      : (tabs[0]?.id ?? candidateActive ?? null);

  return {
    tabs,
    activeTabId,
    ...(windowEntry?.splitMode !== undefined ? { splitMode: windowEntry.splitMode } : {}),
    secondaryTabId: windowEntry?.secondaryTabId ?? null,
  };
}

export function removeEditorTabsForPage(
  pageId: string,
  options?: {
    storage?: StorageLike | null;
    sessionStorage?: StorageLike | null;
  },
): void {
  if (!pageId) return;
  cancelPendingActiveTabSave(pageId);
  const storage = getActiveStorage(options?.storage);
  const sessionStorage = getActiveSessionStorage(options?.sessionStorage);

  if (storage) {
    const envelope = readEnvelope(storage);
    if (envelope.pages[pageId]) {
      const { [pageId]: _removed, ...restPages } = envelope.pages;
      safeSetItem(
        storage,
        EDITOR_STORAGE_KEYS.EDITOR_TABS,
        JSON.stringify({ version: 1, pages: restPages } satisfies EditorTabsEnvelope),
      );
    }
  }

  if (sessionStorage) {
    const windowMap = readWindowMap(sessionStorage);
    if (windowMap[pageId]) {
      const { [pageId]: _removedWindow, ...restWindow } = windowMap;
      safeSetItem(
        sessionStorage,
        EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE,
        JSON.stringify(restWindow),
      );
    }
  }
}
