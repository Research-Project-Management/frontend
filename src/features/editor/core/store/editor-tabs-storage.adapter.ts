/**
 * editor-tabs-storage.adapter.ts
 *
 * Compact localStorage/sessionStorage adapter for Editor tabs & per-window split state.
 * - `localStorage` (`flux_editor_tabs_v1`): per-page open tab list (Read-Modify-Write).
 * - `sessionStorage` (`flux_editor_window_state_v1`): per-window activeTabId / splitMode / secondaryTabId.
 */

import { EDITOR_STORAGE_KEYS } from '@/features/editor/domain/constants/editor.constants';
import {
  MAX_PERSISTED_EDITOR_PAGES,
  enforceMaxEditorTabs,
  type WorkspaceTab,
} from '@/features/editor/domain/workspace/editor-tab-pool.domain';

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

let customLocal: StorageLike | null = null;
let customSession: StorageLike | null = null;
const pendingSaves = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>();
let unloadBound = false;

const resolveLocal = (explicit?: StorageLike | null): StorageLike | null =>
  explicit !== undefined
    ? explicit
    : (customLocal ?? (typeof window !== 'undefined' ? window.localStorage : null));

const resolveSession = (explicit?: StorageLike | null): StorageLike | null =>
  explicit !== undefined
    ? explicit
    : (customSession ?? (typeof window !== 'undefined' ? window.sessionStorage : null));

function safeReadJson<T>(storage: StorageLike | null, key: string, fallback: T): T {
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(storage: StorageLike | null, key: string, value: unknown): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or privacy-mode errors
  }
}

function pruneMap<T extends { updatedAt?: number }>(
  map: Record<string, T>,
  max = MAX_PERSISTED_EDITOR_PAGES,
): Record<string, T> {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort((a, b) => (b[1]?.updatedAt ?? 0) - (a[1]?.updatedAt ?? 0));
  return Object.fromEntries(entries.slice(0, max));
}

function toSerializedTab(tab: WorkspaceTab): SerializedEditorTab {
  return {
    id: tab.id,
    title: tab.title,
    ...(tab.path ? { path: tab.path } : {}),
    ...(tab.fileUrl ? { fileUrl: tab.fileUrl } : {}),
    ...(tab.isPinned ? { isPinned: true } : {}),
    ...(tab.isPreview ? { isPreview: true } : {}),
    ...(tab.isRoot ? { isRoot: true } : {}),
    ...(tab.lastAccessedAt ? { lastAccessedAt: tab.lastAccessedAt } : {}),
  };
}

function toWorkspaceTab(raw: unknown): WorkspaceTab | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<SerializedEditorTab>;
  if (typeof t.id !== 'string' || !t.id.trim()) return null;
  return {
    id: t.id,
    title: typeof t.title === 'string' && t.title ? t.title : t.path || t.id,
    ...(typeof t.path === 'string' ? { path: t.path } : {}),
    ...(typeof t.fileUrl === 'string' ? { fileUrl: t.fileUrl } : {}),
    isDirty: false,
    ...(t.isPinned ? { isPinned: true } : {}),
    ...(t.isPreview ? { isPreview: true } : {}),
    ...(t.isRoot ? { isRoot: true } : {}),
    ...(typeof t.lastAccessedAt === 'number' ? { lastAccessedAt: t.lastAccessedAt } : {}),
  };
}

function readEnvelope(storage: StorageLike | null): EditorTabsEnvelope {
  const parsed = safeReadJson<Partial<EditorTabsEnvelope>>(
    storage,
    EDITOR_STORAGE_KEYS.EDITOR_TABS,
    { version: 1, pages: {} },
  );
  return {
    version: 1,
    pages: parsed && typeof parsed.pages === 'object' && parsed.pages ? parsed.pages : {},
  };
}

function readWindowMap(storage: StorageLike | null): EditorWindowStateMap {
  const parsed = safeReadJson<EditorWindowStateMap>(
    storage,
    EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE,
    {},
  );
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function cancelPending(pageId: string): void {
  const p = pendingSaves.get(pageId);
  if (p) {
    clearTimeout(p.timer);
    pendingSaves.delete(pageId);
  }
}

export function flushPendingEditorTabSaves(targetPageId?: string): void {
  if (targetPageId !== undefined) {
    const p = pendingSaves.get(targetPageId);
    if (p) {
      clearTimeout(p.timer);
      pendingSaves.delete(targetPageId);
      p.run();
    }
    return;
  }
  for (const [id, p] of Array.from(pendingSaves.entries())) {
    clearTimeout(p.timer);
    pendingSaves.delete(id);
    p.run();
  }
}

export function setEditorTabsStorageProvider(provider: StorageLike | null): void {
  flushPendingEditorTabSaves();
  customLocal = provider;
}

export function setEditorWindowStorageProvider(provider: StorageLike | null): void {
  flushPendingEditorTabSaves();
  customSession = provider;
}

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
  const storage = resolveLocal(options?.storage);
  const removed = new Set(options?.removedIds ?? []);
  const filteredLocal = localTabs.filter((t) => !removed.has(t.id));
  if (!storage || options?.replaceOrder) return filteredLocal;

  const entry = readEnvelope(storage).pages[pageId];
  if (!entry?.tabs?.length) return filteredLocal;

  const merged: WorkspaceTab[] = [];
  const seen = new Set<string>();
  for (const tab of filteredLocal) {
    if (tab.id && !seen.has(tab.id)) {
      seen.add(tab.id);
      merged.push(tab);
    }
  }
  for (const raw of entry.tabs) {
    const tab = toWorkspaceTab(raw);
    if (tab && !removed.has(tab.id) && !seen.has(tab.id)) {
      seen.add(tab.id);
      merged.push(tab);
    }
  }
  return merged;
}

export function saveEditorTabsForPage(
  pageId: string,
  tabs: readonly WorkspaceTab[],
  activeTabId: string | null,
  options?: SaveEditorTabsOptions,
): WorkspaceTab[] {
  if (!pageId) return [...tabs];
  cancelPending(pageId);
  const local = resolveLocal(options?.storage);
  const session = resolveSession(options?.sessionStorage);

  const merged = mergeEditorTabsWithStorage(pageId, tabs, {
    removedIds: options?.removedIds,
    replaceOrder: options?.replaceOrder,
    storage: local,
  });
  const bounded = enforceMaxEditorTabs(merged, {
    maxTabs: options?.maxTabs,
    activeTabId,
    rootPageId: options?.rootPageId,
    isDirtyFn: options?.isDirtyFn,
  });
  const now = Date.now();

  if (local) {
    const env = readEnvelope(local);
    const nextPages = pruneMap({
      ...env.pages,
      [pageId]: { tabs: bounded.map(toSerializedTab), activeTabId, updatedAt: now },
    });
    safeWriteJson(local, EDITOR_STORAGE_KEYS.EDITOR_TABS, {
      version: 1,
      pages: nextPages,
    } satisfies EditorTabsEnvelope);
  }

  if (session) {
    const map = readWindowMap(session);
    const prev = map[pageId];
    safeWriteJson(
      session,
      EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE,
      pruneMap({
        ...map,
        [pageId]: {
          activeTabId,
          ...(options?.splitMode !== undefined
            ? { splitMode: options.splitMode }
            : prev?.splitMode !== undefined
              ? { splitMode: prev.splitMode }
              : {}),
          secondaryTabId:
            options?.secondaryTabId !== undefined
              ? options.secondaryTabId
              : (prev?.secondaryTabId ?? null),
          updatedAt: now,
        },
      }),
    );
  }

  return bounded;
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
  const now = Date.now();
  const session = resolveSession(options?.sessionStorage);
  if (session) {
    const map = readWindowMap(session);
    const prev = map[pageId];
    safeWriteJson(
      session,
      EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE,
      pruneMap({
        ...map,
        [pageId]: {
          activeTabId: patch.activeTabId !== undefined ? patch.activeTabId : (prev?.activeTabId ?? null),
          ...(patch.splitMode !== undefined
            ? { splitMode: patch.splitMode }
            : prev?.splitMode !== undefined
              ? { splitMode: prev.splitMode }
              : {}),
          secondaryTabId:
            patch.secondaryTabId !== undefined
              ? patch.secondaryTabId
              : (prev?.secondaryTabId ?? null),
          updatedAt: now,
        },
      }),
    );
  }

  if (!options?.skipLocalStorage && patch.activeTabId !== undefined) {
    const local = resolveLocal(options?.storage);
    if (local) {
      const env = readEnvelope(local);
      const existing = env.pages[pageId];
      if (existing) {
        safeWriteJson(local, EDITOR_STORAGE_KEYS.EDITOR_TABS, {
          version: 1,
          pages: { ...env.pages, [pageId]: { ...existing, activeTabId: patch.activeTabId, updatedAt: now } },
        } satisfies EditorTabsEnvelope);
      }
    }
  }
}

export function scheduleSaveActiveEditorTab(
  pageId: string,
  tabs: readonly WorkspaceTab[],
  activeTabId: string | null,
  options?: SaveEditorTabsOptions & { delayMs?: number },
): void {
  if (!pageId) return;
  const delayMs = options?.delayMs ?? 150;
  if (delayMs <= 0) {
    saveEditorTabsForPage(pageId, tabs, activeTabId, options);
    return;
  }
  cancelPending(pageId);
  if (!unloadBound && typeof window !== 'undefined') {
    unloadBound = true;
    window.addEventListener('beforeunload', () => flushPendingEditorTabSaves());
  }
  const snapshot = [...tabs];
  const run = () => saveEditorTabsForPage(pageId, snapshot, activeTabId, options);
  const timer = setTimeout(() => {
    pendingSaves.delete(pageId);
    run();
  }, delayMs);
  pendingSaves.set(pageId, { timer, run });
}

export function loadEditorTabsForPage(
  pageId: string,
  options?: { storage?: StorageLike | null; sessionStorage?: StorageLike | null },
): {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  splitMode?: PersistedSplitMode;
  secondaryTabId: string | null;
} {
  if (!pageId) return { tabs: [], activeTabId: null, secondaryTabId: null };
  flushPendingEditorTabSaves(pageId);

  const entry = readEnvelope(resolveLocal(options?.storage)).pages[pageId];
  const win = readWindowMap(resolveSession(options?.sessionStorage))[pageId];
  const tabs: WorkspaceTab[] = [];
  const seen = new Set<string>();
  for (const raw of entry?.tabs ?? []) {
    const tab = toWorkspaceTab(raw);
    if (tab && !seen.has(tab.id)) {
      seen.add(tab.id);
      tabs.push(tab);
    }
  }
  const candidate = win?.activeTabId ?? entry?.activeTabId ?? null;
  const activeTabId =
    candidate && tabs.some((t) => t.id === candidate)
      ? candidate
      : (tabs[0]?.id ?? candidate ?? null);

  return {
    tabs,
    activeTabId,
    ...(win?.splitMode !== undefined ? { splitMode: win.splitMode } : {}),
    secondaryTabId: win?.secondaryTabId ?? null,
  };
}

export function removeEditorTabsForPage(
  pageId: string,
  options?: { storage?: StorageLike | null; sessionStorage?: StorageLike | null },
): void {
  if (!pageId) return;
  cancelPending(pageId);
  const local = resolveLocal(options?.storage);
  if (local) {
    const env = readEnvelope(local);
    if (env.pages[pageId]) {
      const { [pageId]: _r, ...rest } = env.pages;
      safeWriteJson(local, EDITOR_STORAGE_KEYS.EDITOR_TABS, {
        version: 1,
        pages: rest,
      } satisfies EditorTabsEnvelope);
    }
  }
  const session = resolveSession(options?.sessionStorage);
  if (session) {
    const map = readWindowMap(session);
    if (map[pageId]) {
      const { [pageId]: _r, ...rest } = map;
      safeWriteJson(session, EDITOR_STORAGE_KEYS.EDITOR_WINDOW_STATE, rest);
    }
  }
}
