/**
 * workspace-tabs-bulk.ts
 *
 * Pure state-transition helpers for bulk tab close, reorder, hydration,
 * and cross-window storage rehydration.
 */

import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';
import { isMainTexTabOrFile } from '@/features/editor/domain/constants/editor.constants';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { isProtectedRootTab } from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import {
  loadEditorTabsForPage,
  saveEditorTabsForPage,
} from './editor-tabs-storage.adapter';
import type { EditorSplitMode } from './workspace-layout.slice';

export interface HydratePageTabsOptions {
  rootDocId?: string | null;
  rootTitle?: string;
  urlFileId?: string | null;
}

export interface WorkspaceTabCollectionSnapshot {
  readonly tabsByProject: Record<string, readonly WorkspaceTab[]>;
  readonly activeByProject: Record<string, string | null>;
  readonly secondaryActiveByProject: Record<string, string | null>;
  readonly editorSplitMode: EditorSplitMode;
  readonly secondaryFileId: string | null;
}

export function isMainDocTab(tab: { id?: string; title?: string }, projectId: string): boolean {
  return isMainTexTabOrFile(tab, projectId);
}

export function decorateTabWithDirtyGetter(
  tab: Omit<WorkspaceTab, 'lastAccessedAt'> & { isDirty?: boolean; lastAccessedAt?: number },
  now?: number,
): WorkspaceTab {
  const isRoot = Boolean(tab.isRoot);
  const isPinned = isRoot ? true : Boolean(tab.isPinned ?? !tab.isPreview);
  const isPreview = isRoot ? false : Boolean(tab.isPreview && !isPinned);

  const result: WorkspaceTab = {
    id: tab.id,
    title: tab.title,
    ...(tab.path !== undefined ? { path: tab.path } : {}),
    ...(tab.fileUrl !== undefined ? { fileUrl: tab.fileUrl } : {}),
    isPinned,
    isPreview,
    ...(isRoot ? { isRoot: true } : {}),
    lastAccessedAt: now ?? tab.lastAccessedAt ?? Date.now(),
  };

  Object.defineProperty(result, 'isDirty', {
    get: () => lruDocumentCache.isDirty(tab.id),
    enumerable: true,
    configurable: true,
  });

  return result;
}

function finalizeBulkCloseTransition(
  state: WorkspaceTabCollectionSnapshot,
  projectId: string,
  remaining: WorkspaceTab[],
  closedIds: string[],
  nextActive: string | null,
): Partial<WorkspaceTabCollectionSnapshot> {
  let nextSec = state.secondaryActiveByProject[projectId] ?? null;
  if (nextSec && closedIds.includes(nextSec)) nextSec = null;
  let nextSecGlobal = state.secondaryFileId;
  if (nextSecGlobal && closedIds.includes(nextSecGlobal)) nextSecGlobal = null;

  const persistedRemaining = saveEditorTabsForPage(
    projectId,
    remaining,
    nextActive,
    {
      removedIds: closedIds,
      replaceOrder: true,
      splitMode: state.editorSplitMode,
      secondaryTabId: nextSec,
      rootPageId: projectId,
      isDirtyFn: (id) => lruDocumentCache.isDirty(id),
    },
  ).map((t) => decorateTabWithDirtyGetter(t, t.lastAccessedAt));

  return {
    tabsByProject: {
      ...state.tabsByProject,
      [projectId]: persistedRemaining,
    },
    activeByProject: {
      ...state.activeByProject,
      [projectId]: nextActive,
    },
    secondaryActiveByProject: {
      ...state.secondaryActiveByProject,
      [projectId]: nextSec,
    },
    secondaryFileId: nextSecGlobal,
  };
}

export function computeCloseOtherTabsState(
  state: WorkspaceTabCollectionSnapshot,
  projectId: string,
  keepTabId: string,
): { patch: Partial<WorkspaceTabCollectionSnapshot> | null; evictedIds: string[] } {
  const currentTabs = state.tabsByProject[projectId] ?? [];
  if (currentTabs.length === 0) return { patch: null, evictedIds: [] };

  const evictedIds: string[] = [];
  const remaining: WorkspaceTab[] = [];
  for (const tab of currentTabs) {
    const keep =
      tab.id === keepTabId ||
      isProtectedRootTab(tab, projectId) ||
      lruDocumentCache.isDirty(tab.id);
    if (keep) {
      remaining.push(tab);
    } else {
      evictedIds.push(tab.id);
    }
  }

  if (evictedIds.length === 0) return { patch: null, evictedIds };

  const currentActive = state.activeByProject[projectId];
  const nextActive =
    currentActive && remaining.some((t) => t.id === currentActive)
      ? currentActive
      : remaining.some((t) => t.id === keepTabId)
        ? keepTabId
        : (remaining[0]?.id ?? null);

  return {
    patch: finalizeBulkCloseTransition(state, projectId, remaining, evictedIds, nextActive),
    evictedIds,
  };
}

export function computeCloseTabsToRightState(
  state: WorkspaceTabCollectionSnapshot,
  projectId: string,
  fromTabId: string,
): { patch: Partial<WorkspaceTabCollectionSnapshot> | null; closedIds: string[] } {
  const currentTabs = state.tabsByProject[projectId] ?? [];
  const pivotIdx = currentTabs.findIndex((t) => t.id === fromTabId);
  if (pivotIdx === -1 || pivotIdx >= currentTabs.length - 1) {
    return { patch: null, closedIds: [] };
  }

  const closedIds: string[] = [];
  const remaining: WorkspaceTab[] = [];
  for (let i = 0; i < currentTabs.length; i++) {
    const tab = currentTabs[i];
    const keep =
      i <= pivotIdx ||
      isProtectedRootTab(tab, projectId) ||
      lruDocumentCache.isDirty(tab.id);
    if (keep) {
      remaining.push(tab);
    } else {
      closedIds.push(tab.id);
    }
  }

  if (closedIds.length === 0) return { patch: null, closedIds };

  const currentActive = state.activeByProject[projectId];
  const nextActive =
    currentActive && remaining.some((t) => t.id === currentActive)
      ? currentActive
      : remaining.some((t) => t.id === fromTabId)
        ? fromTabId
        : (remaining[remaining.length - 1]?.id ?? null);

  return {
    patch: finalizeBulkCloseTransition(state, projectId, remaining, closedIds, nextActive),
    closedIds,
  };
}

export function computeCloseSavedTabsState(
  state: WorkspaceTabCollectionSnapshot,
  projectId: string,
): { patch: Partial<WorkspaceTabCollectionSnapshot> | null; closedIds: string[] } {
  const currentTabs = state.tabsByProject[projectId] ?? [];
  if (currentTabs.length === 0) return { patch: null, closedIds: [] };

  const closedIds: string[] = [];
  const remaining: WorkspaceTab[] = [];
  for (const tab of currentTabs) {
    const keep = isProtectedRootTab(tab, projectId) || lruDocumentCache.isDirty(tab.id);
    if (keep) {
      remaining.push(tab);
    } else {
      closedIds.push(tab.id);
    }
  }

  if (closedIds.length === 0) return { patch: null, closedIds };

  const currentActive = state.activeByProject[projectId];
  const nextActive =
    currentActive && remaining.some((t) => t.id === currentActive)
      ? currentActive
      : (remaining[0]?.id ?? projectId ?? null);

  return {
    patch: finalizeBulkCloseTransition(state, projectId, remaining, closedIds, nextActive),
    closedIds,
  };
}

export function computeReorderTabsState(
  state: WorkspaceTabCollectionSnapshot,
  projectId: string,
  orderedTabIds: string[],
): Partial<WorkspaceTabCollectionSnapshot> | null {
  const current = state.tabsByProject[projectId] ?? [];
  if (current.length <= 1) return null;

  const byId = new Map(current.map((t) => [t.id, t]));
  const rootTabs = current.filter((t) => isProtectedRootTab(t, projectId));
  const rootIds = new Set(rootTabs.map((t) => t.id));

  const orderedNonRoot: WorkspaceTab[] = [];
  const seen = new Set<string>(rootIds);
  for (const id of orderedTabIds) {
    if (seen.has(id)) continue;
    const match = byId.get(id);
    if (match) {
      orderedNonRoot.push(
        decorateTabWithDirtyGetter(
          { ...match, isPinned: true, isPreview: false },
          match.lastAccessedAt,
        ),
      );
      seen.add(id);
    }
  }

  for (const tab of current) {
    if (!seen.has(tab.id)) {
      orderedNonRoot.push(tab);
      seen.add(tab.id);
    }
  }

  const nextTabs = [...rootTabs, ...orderedNonRoot];
  const activeTabId = state.activeByProject[projectId] ?? nextTabs[0]?.id ?? null;

  saveEditorTabsForPage(projectId, nextTabs, activeTabId, {
    replaceOrder: true,
    splitMode: state.editorSplitMode,
    secondaryTabId: state.secondaryActiveByProject[projectId] ?? state.secondaryFileId,
    rootPageId: projectId,
    isDirtyFn: (id) => lruDocumentCache.isDirty(id),
  });

  return {
    tabsByProject: {
      ...state.tabsByProject,
      [projectId]: nextTabs,
    },
  };
}

export function computeHydratePageTabsState(
  state: WorkspaceTabCollectionSnapshot,
  pageId: string,
  options?: HydratePageTabsOptions,
): Partial<WorkspaceTabCollectionSnapshot> {
  const loaded = loadEditorTabsForPage(pageId);
  const existingMemory = state.tabsByProject[pageId] ?? [];
  const baseTabs = loaded.tabs.length > 0 ? loaded.tabs : existingMemory;

  const decorated = baseTabs.map((t) =>
    decorateTabWithDirtyGetter(
      {
        ...t,
        ...(options?.rootDocId && t.id === options.rootDocId
          ? { isRoot: true, isPinned: true, isPreview: false }
          : {}),
      },
      t.lastAccessedAt,
    ),
  );

  if (options?.rootDocId && !decorated.some((t) => t.id === options.rootDocId || t.isRoot)) {
    decorated.unshift(
      decorateTabWithDirtyGetter(
        {
          id: options.rootDocId,
          title: options.rootTitle || 'main.tex',
          path: options.rootTitle || 'main.tex',
          isRoot: true,
          isPinned: true,
          isPreview: false,
        },
        Date.now(),
      ),
    );
  }

  const resolvedActive =
    (options?.urlFileId && decorated.some((t) => t.id === options.urlFileId)
      ? options.urlFileId
      : null) ??
    (state.activeByProject[pageId] && decorated.some((t) => t.id === state.activeByProject[pageId])
      ? state.activeByProject[pageId]
      : null) ??
    loaded.activeTabId ??
    decorated[0]?.id ??
    null;

  if (decorated.length > 0) {
    saveEditorTabsForPage(pageId, decorated, resolvedActive, {
      replaceOrder: loaded.tabs.length === 0,
      splitMode: loaded.splitMode ?? state.editorSplitMode,
      secondaryTabId: loaded.secondaryTabId ?? state.secondaryActiveByProject[pageId] ?? null,
      rootPageId: pageId,
      isDirtyFn: (id) => lruDocumentCache.isDirty(id),
    });
  }

  const nextSplitMode = loaded.splitMode ?? state.editorSplitMode;
  const nextSecondaryTabId =
    loaded.secondaryTabId ?? state.secondaryActiveByProject[pageId] ?? null;

  return {
    tabsByProject: {
      ...state.tabsByProject,
      [pageId]: decorated,
    },
    activeByProject: {
      ...state.activeByProject,
      [pageId]: resolvedActive,
    },
    secondaryActiveByProject: {
      ...state.secondaryActiveByProject,
      [pageId]: nextSecondaryTabId,
    },
    ...(loaded.splitMode !== undefined ? { editorSplitMode: nextSplitMode } : {}),
    ...(loaded.secondaryTabId !== null ? { secondaryFileId: loaded.secondaryTabId } : {}),
  };
}

export function computeRehydratedPagesPatch(
  current: Pick<WorkspaceTabCollectionSnapshot, 'tabsByProject' | 'activeByProject'>,
  hydratedPageScopes: Set<string>,
  pageId?: string,
): {
  tabsByProject: Record<string, readonly WorkspaceTab[]>;
  activeByProject: Record<string, string | null>;
} | null {
  const targetPages = pageId
    ? [pageId]
    : Object.keys(current.tabsByProject).filter(
        (id) => hydratedPageScopes.has(id) || current.tabsByProject[id] !== undefined,
      );

  if (targetPages.length === 0) return null;

  let mutated = false;
  const nextTabsByProject = { ...current.tabsByProject };
  const nextActiveByProject = { ...current.activeByProject };

  for (const pid of targetPages) {
    if (!hydratedPageScopes.has(pid) && current.tabsByProject[pid] === undefined) {
      continue;
    }
    const loaded = loadEditorTabsForPage(pid);
    if (loaded.tabs.length === 0 && current.tabsByProject[pid] === undefined) {
      continue;
    }

    const decorated = loaded.tabs.map((t) => decorateTabWithDirtyGetter(t, t.lastAccessedAt));
    const currentActive = current.activeByProject[pid];
    const keepCurrentActive =
      Boolean(currentActive) && decorated.some((t) => t.id === currentActive);

    nextTabsByProject[pid] = decorated;
    nextActiveByProject[pid] = keepCurrentActive
      ? currentActive!
      : (loaded.activeTabId ?? decorated[0]?.id ?? null);
    mutated = true;
  }

  return mutated
    ? { tabsByProject: nextTabsByProject, activeByProject: nextActiveByProject }
    : null;
}
