/**
 * workspace.store.ts
 *
 * Consolidated Editor Workspace & Workbench Store (State Management Layer).
 * Location: `frontend/src/features/editor/core/store/workspace.store.ts`
 *
 * Unified Deep Module (Matt Pocock Codebase Design + Reader Multi-Tab Architecture Parity):
 * - Merges multi-page tab navigation, Tri-State Tab Pool governance, and workbench layout.
 * - Multi-window safe: `localStorage` Read-Modify-Write for open tab lists (`flux_editor_tabs_v1`)
 *   + `sessionStorage` isolation for each window's `activeTabId` & split state (`flux_editor_window_state_v1`)
 *   + cross-tab sync via `multiTabBus` (`BroadcastChannel`) and `StorageEvent`.
 * - Single source of truth: dynamic `isDirty` getter backed directly by `lruDocumentCache`.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { WorkspaceTab, EditorTab } from '@/features/editor/domain/types/workspace.types';
import {
  EDITOR_STORAGE_KEYS,
  isMainTexTabOrFile,
} from '@/features/editor/domain/constants/editor.constants';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  isProtectedRootTab,
  resolveNextActiveEditorTabOnClose,
} from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import {
  loadEditorTabsForPage,
  saveEditorTabsForPage,
  saveEditorWindowSplitState,
  scheduleSaveActiveEditorTab,
  removeEditorTabsForPage,
} from './editor-tabs-storage.adapter';
import { multiTabBus } from '@/shared/lib/multi-tab';

// ── Layout Enums & Types ──────────────────────────────────────────────────────

export type ActivityBarTab = 'files' | 'search' | 'citations' | 'review' | 'chat' | 'ai';
export type EditorSplitMode = 'none' | 'vertical' | 'horizontal';
export type ActiveEditorPane = 'primary' | 'secondary';

export type { WorkspaceTab, EditorTab };

// ── Consolidated Workspace & Layout State Interface ──────────────────────────

export interface LayoutState {
  // Activity Bar & Primary Sidebar (Left)
  sidebarLeftOpen: boolean;
  sidebarLeftWidth: number;
  activeSidebarTab: ActivityBarTab;

  // File Outline (Overleaf Parity: Integrated accordion inside Files tab)
  fileOutlineOpen: boolean;

  // Center Splitter (Editor vs Preview)
  splitRatio: number;

  // Editor Multi-Pane Split (Overleaf Parity: Side-by-side editing)
  editorSplitMode: EditorSplitMode;
  editorSplitRatio: number;
  activeEditorPane: ActiveEditorPane;
  secondaryFileId: string | null;

  // Detached PDF Window (Overleaf Parity: Separate screen preview)
  isPdfDetached: boolean;

  // Layout Actions
  toggleSidebarLeft: () => void;
  setSidebarLeftOpen: (open: boolean) => void;
  setSidebarLeftWidth: (width: number) => void;
  setActiveSidebarTab: (tab: ActivityBarTab) => void;
  selectActivityTab: (tab: ActivityBarTab) => void;

  toggleFileOutline: () => void;
  setFileOutlineOpen: (open: boolean) => void;

  setSplitRatio: (ratio: number) => void;

  setEditorSplitMode: (mode: EditorSplitMode) => void;
  toggleEditorSplit: (direction?: 'vertical' | 'horizontal') => void;
  setEditorSplitRatio: (ratio: number) => void;
  setActiveEditorPane: (pane: ActiveEditorPane) => void;
  setSecondaryFileId: (fileId: string | null) => void;
  setPdfDetached: (detached: boolean) => void;
  togglePdfDetached: () => void;

  resetLayout: () => void;
}

export interface HydratePageTabsOptions {
  rootDocId?: string | null;
  rootTitle?: string;
  urlFileId?: string | null;
}

export interface WorkspaceStoreState extends LayoutState {
  // Multi-Page Tabs State (Canonical scope keyed by pageId)
  readonly tabsByProject: Record<string, readonly WorkspaceTab[]>;
  readonly activeByProject: Record<string, string | null>;
  readonly secondaryActiveByProject: Record<string, string | null>;

  // Tab Actions
  openTab: (projectId: string, tab: Omit<WorkspaceTab, 'lastAccessedAt'>) => void;
  closeTab: (projectId: string, tabId: string, router?: (nextId: string | null) => void) => void;
  closeOtherTabs: (projectId: string, keepTabId: string) => string[];
  closeTabsToRight: (projectId: string, fromTabId: string) => string[];
  closeSavedTabs: (projectId: string) => string[];
  closeAllTabsForProject: (projectId: string) => void;
  setActiveTab: (projectId: string, tabId: string) => void;
  setSecondaryActiveTab: (projectId: string, tabId: string | null) => void;
  pinTab: (projectId: string, tabId: string) => void;
  pinTabForFile: (tabId: string) => void;
  reorderTabs: (projectId: string, orderedTabIds: string[]) => void;
  hydratePageTabs: (pageId: string, options?: HydratePageTabsOptions) => void;
  markTabDirty: (projectId: string, tabId: string, isDirty: boolean) => void;
  updateTabTitle: (projectId: string, tabId: string, title: string) => void;

  // ── Clean Hierarchy: spaceId -> pageId (rootPageId) -> activeDocId ──────
  getActiveDocId: (projectId: string, rootPageId?: string | null) => string | null;
  setActiveDocId: (projectId: string, activeDocId: string, rootPageId?: string | null) => void;
  getTabsForHierarchy: (projectId: string, rootPageId?: string | null) => readonly WorkspaceTab[];
}

// ── Helpers & Multi-Tab Tracking ──────────────────────────────────────────────

const hydratedPageScopes = new Set<string>();
let currentWindowPageScope: string | null = null;

function isMainDocTab(tab: { id?: string; title?: string }, projectId: string): boolean {
  return isMainTexTabOrFile(tab, projectId);
}

function decorateTabWithDirtyGetter(
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

const DEFAULT_LAYOUT = {
  sidebarLeftOpen: true,
  sidebarLeftWidth: 260,
  activeSidebarTab: 'files' as ActivityBarTab,
  fileOutlineOpen: true,
  splitRatio: 0.5,
  editorSplitMode: 'none' as EditorSplitMode,
  editorSplitRatio: 0.5,
  activeEditorPane: 'primary' as ActiveEditorPane,
  secondaryFileId: null as string | null,
  isPdfDetached: false,
};

// ── Store Definition ──────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ── Tabs Initial State ────────────────────────────────────────────────
        tabsByProject: {},
        activeByProject: {},
        secondaryActiveByProject: {},

        // ── Layout Initial State ──────────────────────────────────────────────
        ...DEFAULT_LAYOUT,

        // ── Tabs Actions ──────────────────────────────────────────────────────
        openTab: (projectId, tab) => {
          currentWindowPageScope = projectId;
          hydratedPageScopes.add(projectId);
          let didMutateTabs = false;

          set((state) => {
            const wasInitialized = state.tabsByProject[projectId] !== undefined;
            const existing = state.tabsByProject[projectId] ?? [];
            const isIncomingMain = isMainDocTab(tab, projectId) || Boolean(tab.isRoot);
            const now = Date.now();

            // Match strictly by canonical doc ID (or root equivalence) so files with identical
            // names in different directories (e.g. chapters/setup.tex vs appendix/setup.tex) stay distinct tabs.
            const existingIndex = existing.findIndex((t) => {
              if (t.id === tab.id) return true;
              if (isIncomingMain && isMainDocTab(t, projectId)) return true;
              return false;
            });

            if (existingIndex !== -1) {
              const currentTab = existing[existingIndex];
              const resolvedId =
                isIncomingMain && currentTab.id.endsWith('-main') ? currentTab.id : tab.id;
              const nextIsRoot = isIncomingMain || Boolean(currentTab.isRoot);
              const nextIsPinned =
                nextIsRoot ||
                Boolean(currentTab.isPinned) ||
                Boolean(tab.isPinned ?? !tab.isPreview);
              const nextIsPreview = !nextIsPinned && Boolean(tab.isPreview ?? currentTab.isPreview);

              const isUnchanged =
                currentTab.id === resolvedId &&
                currentTab.title === tab.title &&
                (currentTab.path ?? undefined) === (tab.path ?? undefined) &&
                Boolean(currentTab.isDirty) === Boolean(tab.isDirty ?? currentTab.isDirty) &&
                Boolean(currentTab.isPinned) === nextIsPinned &&
                Boolean(currentTab.isPreview) === nextIsPreview;

              if (isUnchanged && state.activeByProject[projectId] === resolvedId) {
                return state;
              }
            }

            if (tab.isDirty) {
              lruDocumentCache.markDirty(tab.id);
            }

            const removedIds = new Set<string>();
            let updatedTabs: WorkspaceTab[];
            let activeResolvedId = tab.id;

            if (existingIndex !== -1) {
              const currentTab = existing[existingIndex];
              const resolvedId =
                isIncomingMain && currentTab.id.endsWith('-main') ? currentTab.id : tab.id;
              activeResolvedId = resolvedId;
              const nextIsRoot = isIncomingMain || Boolean(currentTab.isRoot);
              const nextIsPinned =
                nextIsRoot ||
                Boolean(currentTab.isPinned) ||
                Boolean(tab.isPinned ?? !tab.isPreview);
              const nextIsPreview = !nextIsPinned && Boolean(tab.isPreview ?? currentTab.isPreview);

              updatedTabs = existing.map((t, idx) =>
                idx === existingIndex
                  ? decorateTabWithDirtyGetter(
                      {
                        ...t,
                        ...tab,
                        id: resolvedId,
                        isRoot: nextIsRoot,
                        isPinned: nextIsPinned,
                        isPreview: nextIsPreview,
                      },
                      now,
                    )
                  : t,
              );
            } else {
              const incomingWantsPreview =
                !isIncomingMain && Boolean(tab.isPreview) && !tab.isPinned;
              const activeSecId =
                state.secondaryActiveByProject[projectId] ?? state.secondaryFileId;

              if (incomingWantsPreview) {
                const previewIdx = existing.findIndex(
                  (t) =>
                    Boolean(t.isPreview && !t.isPinned) &&
                    !isProtectedRootTab(t, projectId) &&
                    t.id !== activeSecId &&
                    !lruDocumentCache.isDirty(t.id),
                );
                if (previewIdx !== -1) {
                  removedIds.add(existing[previewIdx].id);
                  const replacement = decorateTabWithDirtyGetter(
                    {
                      ...tab,
                      isRoot: false,
                      isPreview: true,
                      isPinned: false,
                    },
                    now,
                  );
                  updatedTabs = existing.map((t, idx) =>
                    idx === previewIdx ? replacement : t,
                  );
                } else {
                  updatedTabs = [
                    ...existing,
                    decorateTabWithDirtyGetter(
                      {
                        ...tab,
                        isRoot: false,
                        isPreview: true,
                        isPinned: false,
                      },
                      now,
                    ),
                  ];
                }
              } else {
                const newTab = decorateTabWithDirtyGetter(
                  {
                    ...tab,
                    isRoot: isIncomingMain,
                    isPinned: isIncomingMain ? true : (tab.isPinned ?? true),
                    isPreview: false,
                  },
                  now,
                );
                updatedTabs = [...existing, newTab];
              }
            }

            // Deduplicate strictly by canonical id (and single root key)
            const seen = new Set<string>();
            const deduped: WorkspaceTab[] = [];
            for (const t of updatedTabs) {
              const key = isMainDocTab(t, projectId) || t.isRoot ? '__main__' : t.id;
              if (!seen.has(key)) {
                seen.add(key);
                deduped.push(t);
              }
            }

            const activeSecId =
              state.secondaryActiveByProject[projectId] ?? state.secondaryFileId;

            const persistedTabs = saveEditorTabsForPage(
              projectId,
              deduped,
              activeResolvedId,
              {
                removedIds,
                replaceOrder: !wasInitialized,
                splitMode: state.editorSplitMode,
                secondaryTabId: activeSecId,
                rootPageId: projectId,
                isDirtyFn: (id) => lruDocumentCache.isDirty(id),
              },
            ).map((t) => decorateTabWithDirtyGetter(t, t.lastAccessedAt ?? now));

            didMutateTabs = true;

            return {
              tabsByProject: {
                ...state.tabsByProject,
                [projectId]: persistedTabs,
              },
              activeByProject: {
                ...state.activeByProject,
                [projectId]: activeResolvedId,
              },
            };
          });

          if (didMutateTabs) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }
        },

        closeTab: (projectId, tabId, router) => {
          currentWindowPageScope = projectId;
          let didMutateTabs = false;
          let shouldRoute = false;
          let routedNextActive: string | null = null;

          set((state) => {
            const currentTabs = state.tabsByProject[projectId] ?? [];
            const isClosingMain = isMainDocTab({ id: tabId }, projectId);

            const idx = currentTabs.findIndex(
              (t) => t.id === tabId || (isClosingMain && isMainDocTab(t, projectId)),
            );
            if (idx === -1) {
              if (
                state.secondaryFileId === tabId ||
                state.secondaryActiveByProject[projectId] === tabId
              ) {
                const nextSecProj =
                  state.secondaryActiveByProject[projectId] === tabId
                    ? null
                    : state.secondaryActiveByProject[projectId];
                const nextSecGlobal =
                  state.secondaryFileId === tabId ? null : state.secondaryFileId;
                saveEditorWindowSplitState(projectId, { secondaryTabId: nextSecProj ?? null });
                return {
                  secondaryFileId: nextSecGlobal,
                  secondaryActiveByProject: {
                    ...state.secondaryActiveByProject,
                    [projectId]: nextSecProj,
                  },
                };
              }
              return state;
            }

            const removedIds: string[] = [];
            const remaining = currentTabs.filter((t) => {
              const matches = t.id === tabId || (isClosingMain && isMainDocTab(t, projectId));
              if (matches) removedIds.push(t.id);
              return !matches;
            });

            const currentActive = state.activeByProject[projectId];
            const wasActive =
              currentActive === tabId ||
              (isClosingMain &&
                Boolean(currentActive) &&
                isMainDocTab({ id: currentActive! }, projectId));

            const nextActive = resolveNextActiveEditorTabOnClose(
              currentTabs,
              currentTabs[idx].id,
              wasActive ? currentTabs[idx].id : currentActive,
              remaining.length > 0 ? remaining[0].id : null,
            );

            if (wasActive && router) {
              shouldRoute = true;
              routedNextActive = nextActive;
            }

            let nextSecondary = state.secondaryActiveByProject[projectId];
            if (nextSecondary === tabId || (nextSecondary && removedIds.includes(nextSecondary))) {
              nextSecondary = null;
            }
            let nextSecondaryFileId = state.secondaryFileId;
            if (
              nextSecondaryFileId === tabId ||
              (nextSecondaryFileId && removedIds.includes(nextSecondaryFileId))
            ) {
              nextSecondaryFileId = null;
            }

            const persistedRemaining = saveEditorTabsForPage(
              projectId,
              remaining,
              nextActive,
              {
                removedIds,
                replaceOrder: false,
                splitMode: state.editorSplitMode,
                secondaryTabId: nextSecondary ?? null,
                rootPageId: projectId,
                isDirtyFn: (id) => lruDocumentCache.isDirty(id),
              },
            ).map((t) => decorateTabWithDirtyGetter(t, t.lastAccessedAt));

            didMutateTabs = true;

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
                [projectId]: nextSecondary,
              },
              secondaryFileId: nextSecondaryFileId,
            };
          });

          if (shouldRoute && router) {
            router(routedNextActive);
          }

          if (didMutateTabs) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }
        },

        closeOtherTabs: (projectId, keepTabId) => {
          currentWindowPageScope = projectId;
          const evictedIds: string[] = [];

          set((state) => {
            const currentTabs = state.tabsByProject[projectId] ?? [];
            if (currentTabs.length === 0) return state;

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

            if (evictedIds.length === 0) return state;

            const currentActive = state.activeByProject[projectId];
            const nextActive =
              currentActive && remaining.some((t) => t.id === currentActive)
                ? currentActive
                : remaining.some((t) => t.id === keepTabId)
                  ? keepTabId
                  : (remaining[0]?.id ?? null);

            let nextSec = state.secondaryActiveByProject[projectId] ?? null;
            if (nextSec && evictedIds.includes(nextSec)) nextSec = null;
            let nextSecGlobal = state.secondaryFileId;
            if (nextSecGlobal && evictedIds.includes(nextSecGlobal)) nextSecGlobal = null;

            const persistedRemaining = saveEditorTabsForPage(
              projectId,
              remaining,
              nextActive,
              {
                removedIds: evictedIds,
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
          });

          if (evictedIds.length > 0) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }

          return evictedIds;
        },

        closeTabsToRight: (projectId, fromTabId) => {
          currentWindowPageScope = projectId;
          const closedIds: string[] = [];

          set((state) => {
            const currentTabs = state.tabsByProject[projectId] ?? [];
            const pivotIdx = currentTabs.findIndex((t) => t.id === fromTabId);
            if (pivotIdx === -1 || pivotIdx >= currentTabs.length - 1) {
              return state;
            }

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

            if (closedIds.length === 0) return state;

            const currentActive = state.activeByProject[projectId];
            const nextActive =
              currentActive && remaining.some((t) => t.id === currentActive)
                ? currentActive
                : remaining.some((t) => t.id === fromTabId)
                  ? fromTabId
                  : (remaining[remaining.length - 1]?.id ?? null);

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
          });

          if (closedIds.length > 0) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }

          return closedIds;
        },

        closeSavedTabs: (projectId) => {
          currentWindowPageScope = projectId;
          const closedIds: string[] = [];

          set((state) => {
            const currentTabs = state.tabsByProject[projectId] ?? [];
            if (currentTabs.length === 0) return state;

            const remaining: WorkspaceTab[] = [];
            for (const tab of currentTabs) {
              const keep = isProtectedRootTab(tab, projectId) || lruDocumentCache.isDirty(tab.id);
              if (keep) {
                remaining.push(tab);
              } else {
                closedIds.push(tab.id);
              }
            }

            if (closedIds.length === 0) return state;

            const currentActive = state.activeByProject[projectId];
            const nextActive =
              currentActive && remaining.some((t) => t.id === currentActive)
                ? currentActive
                : (remaining[0]?.id ?? projectId ?? null);

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
          });

          if (closedIds.length > 0) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }

          return closedIds;
        },

        closeAllTabsForProject: (projectId) => {
          hydratedPageScopes.delete(projectId);
          removeEditorTabsForPage(projectId);
          set((state) => {
            const { [projectId]: _tabs, ...remainingTabs } = state.tabsByProject;
            const { [projectId]: _active, ...remainingActive } = state.activeByProject;
            const { [projectId]: _secActive, ...remainingSecActive } =
              state.secondaryActiveByProject;
            return {
              tabsByProject: remainingTabs,
              activeByProject: remainingActive,
              secondaryActiveByProject: remainingSecActive,
            };
          });
        },

        setActiveTab: (projectId, tabId) => {
          currentWindowPageScope = projectId;
          hydratedPageScopes.add(projectId);
          set((state) => {
            if (state.activeByProject[projectId] === tabId) {
              return state;
            }
            const now = Date.now();
            const current = state.tabsByProject[projectId] ?? [];
            const updated = current.map((t) =>
              t.id === tabId ? decorateTabWithDirtyGetter(t, now) : t,
            );
            if (current.length > 0) {
              scheduleSaveActiveEditorTab(projectId, updated, tabId, {
                replaceOrder: false,
                rootPageId: projectId,
                isDirtyFn: (id) => lruDocumentCache.isDirty(id),
              });
            } else {
              saveEditorWindowSplitState(projectId, { activeTabId: tabId });
            }
            return {
              tabsByProject: {
                ...state.tabsByProject,
                [projectId]: updated,
              },
              activeByProject: {
                ...state.activeByProject,
                [projectId]: tabId,
              },
            };
          });
        },

        setSecondaryActiveTab: (projectId, tabId) => {
          currentWindowPageScope = projectId;
          set((state) => {
            if (state.secondaryActiveByProject[projectId] === tabId) {
              return state;
            }
            saveEditorWindowSplitState(projectId, { secondaryTabId: tabId });
            return {
              secondaryActiveByProject: {
                ...state.secondaryActiveByProject,
                [projectId]: tabId,
              },
            };
          });
        },

        pinTab: (projectId, tabId) => {
          currentWindowPageScope = projectId;
          let didPin = false;

          set((state) => {
            const current = state.tabsByProject[projectId] ?? [];
            const target = current.find((t) => t.id === tabId);
            if (!target || (target.isPinned && !target.isPreview)) {
              return state;
            }
            const updated = current.map((t) =>
              t.id === tabId
                ? decorateTabWithDirtyGetter(
                    { ...t, isPinned: true, isPreview: false },
                    t.lastAccessedAt,
                  )
                : t,
            );
            saveEditorTabsForPage(
              projectId,
              updated,
              state.activeByProject[projectId] ?? tabId,
              {
                replaceOrder: false,
                rootPageId: projectId,
                isDirtyFn: (id) => lruDocumentCache.isDirty(id),
              },
            );
            didPin = true;
            return {
              tabsByProject: {
                ...state.tabsByProject,
                [projectId]: updated,
              },
            };
          });

          if (didPin) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }
        },

        pinTabForFile: (tabId) => {
          if (!tabId) return;
          const state = get();
          for (const [scopeId, tabs] of Object.entries(state.tabsByProject)) {
            const match = tabs.find((t) => t.id === tabId && t.isPreview && !t.isPinned);
            if (match) {
              state.pinTab(scopeId, tabId);
            }
          }
        },

        reorderTabs: (projectId, orderedTabIds) => {
          currentWindowPageScope = projectId;
          let didReorder = false;

          set((state) => {
            const current = state.tabsByProject[projectId] ?? [];
            if (current.length <= 1) return state;

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

            didReorder = true;
            return {
              tabsByProject: {
                ...state.tabsByProject,
                [projectId]: nextTabs,
              },
            };
          });

          if (didReorder) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }
        },

        hydratePageTabs: (pageId, options) => {
          if (!pageId) return;
          currentWindowPageScope = pageId;
          hydratedPageScopes.add(pageId);

          set((state) => {
            const loaded = loadEditorTabsForPage(pageId);
            const existingMemory = state.tabsByProject[pageId] ?? [];

            const baseTabs =
              loaded.tabs.length > 0
                ? loaded.tabs
                : existingMemory;

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

            // Seed root doc tab if provided and not yet present
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

            // URL ?file= explicit parameter takes highest priority, then window-isolated activeTabId
            const resolvedActive =
              (options?.urlFileId && decorated.some((t) => t.id === options.urlFileId)
                ? options.urlFileId
                : null) ??
              (state.activeByProject[pageId] &&
              decorated.some((t) => t.id === state.activeByProject[pageId])
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
              ...(loaded.secondaryTabId !== null
                ? { secondaryFileId: loaded.secondaryTabId }
                : {}),
            };
          });
        },

        markTabDirty: (projectId, tabId, isDirty) => {
          if (isDirty) {
            lruDocumentCache.markDirty(tabId);
          } else {
            lruDocumentCache.markClean(tabId);
          }
          set((state) => {
            const current = state.tabsByProject[projectId] ?? [];
            const target = current.find((t) => t.id === tabId);
            if (!target) {
              return state;
            }
            return {
              tabsByProject: {
                ...state.tabsByProject,
                [projectId]: current.map((t) =>
                  t.id === tabId ? decorateTabWithDirtyGetter(t, t.lastAccessedAt) : t,
                ),
              },
            };
          });
        },

        updateTabTitle: (projectId, tabId, title) => {
          let didUpdate = false;
          set((state) => {
            const current = state.tabsByProject[projectId] ?? [];
            const target = current.find((t) => t.id === tabId);
            if (
              !target ||
              (target.title === title && (target.path === undefined || target.path === title))
            ) {
              return state;
            }
            const updated = current.map((t) =>
              t.id === tabId
                ? decorateTabWithDirtyGetter(
                    { ...t, title, ...(t.path !== undefined ? { path: title } : {}) },
                    t.lastAccessedAt,
                  )
                : t,
            );
            saveEditorTabsForPage(
              projectId,
              updated,
              state.activeByProject[projectId] ?? null,
              {
                replaceOrder: false,
                rootPageId: projectId,
                isDirtyFn: (id) => lruDocumentCache.isDirty(id),
              },
            );
            didUpdate = true;
            return {
              tabsByProject: {
                ...state.tabsByProject,
                [projectId]: updated,
              },
            };
          });
          if (didUpdate) {
            multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
          }
        },

        // ── Clean Hierarchy Accessors ─────────────────────────────────────────
        getActiveDocId: (projectId, rootPageId) => {
          const s = get();
          return (
            (rootPageId ? s.activeByProject[rootPageId] : null) ??
            s.activeByProject[projectId] ??
            null
          );
        },

        setActiveDocId: (projectId, activeDocId, rootPageId) => {
          set((state) => {
            const nextActive: Record<string, string | null> = {
              ...state.activeByProject,
              [projectId]: activeDocId,
            };
            if (rootPageId && rootPageId !== projectId) {
              nextActive[rootPageId] = activeDocId;
            }
            return { activeByProject: nextActive };
          });
        },

        getTabsForHierarchy: (projectId, rootPageId) => {
          const s = get();
          return (
            (rootPageId ? s.tabsByProject[rootPageId] : undefined) ??
            s.tabsByProject[projectId] ??
            []
          );
        },

        // ── Layout Actions ────────────────────────────────────────────────────
        toggleSidebarLeft: () =>
          set((state) => ({ sidebarLeftOpen: !state.sidebarLeftOpen })),

        setSidebarLeftOpen: (open) =>
          set((state) => (state.sidebarLeftOpen === open ? state : { sidebarLeftOpen: open })),

        setSidebarLeftWidth: (width) =>
          set((state) => {
            const clamped = Math.max(180, Math.min(width, 480));
            return state.sidebarLeftWidth === clamped ? state : { sidebarLeftWidth: clamped };
          }),

        setActiveSidebarTab: (tab) =>
          set((state) => (state.activeSidebarTab === tab ? state : { activeSidebarTab: tab })),

        selectActivityTab: (tab) =>
          set((state) => {
            if (state.activeSidebarTab === tab && state.sidebarLeftOpen) {
              return { sidebarLeftOpen: false };
            }
            return {
              activeSidebarTab: tab,
              sidebarLeftOpen: true,
            };
          }),

        toggleFileOutline: () =>
          set((state) => ({ fileOutlineOpen: !state.fileOutlineOpen })),

        setFileOutlineOpen: (open) =>
          set((state) => (state.fileOutlineOpen === open ? state : { fileOutlineOpen: open })),

        setSplitRatio: (ratio) =>
          set((state) => {
            const clamped = Math.max(0.15, Math.min(ratio, 0.85));
            return state.splitRatio === clamped ? state : { splitRatio: clamped };
          }),

        setEditorSplitMode: (mode) =>
          set((state) => {
            if (state.editorSplitMode === mode) return state;
            if (currentWindowPageScope) {
              saveEditorWindowSplitState(currentWindowPageScope, { splitMode: mode });
            }
            return { editorSplitMode: mode };
          }),

        toggleEditorSplit: (direction = 'vertical') =>
          set((state) => {
            const nextMode: EditorSplitMode =
              state.editorSplitMode === 'none' ? direction : 'none';
            if (currentWindowPageScope) {
              saveEditorWindowSplitState(currentWindowPageScope, { splitMode: nextMode });
            }
            return { editorSplitMode: nextMode };
          }),

        setEditorSplitRatio: (ratio) =>
          set((state) => {
            const clamped = Math.max(0.2, Math.min(ratio, 0.8));
            return state.editorSplitRatio === clamped ? state : { editorSplitRatio: clamped };
          }),

        setActiveEditorPane: (pane) =>
          set((state) => (state.activeEditorPane === pane ? state : { activeEditorPane: pane })),

        setSecondaryFileId: (fileId) =>
          set((state) => {
            const scope = currentWindowPageScope;
            if (
              state.secondaryFileId === fileId &&
              (!scope || state.secondaryActiveByProject[scope] === fileId)
            ) {
              return state;
            }
            if (scope) {
              saveEditorWindowSplitState(scope, { secondaryTabId: fileId });
            }
            return {
              secondaryFileId: fileId,
              ...(scope
                ? {
                    secondaryActiveByProject: {
                      ...state.secondaryActiveByProject,
                      [scope]: fileId,
                    },
                  }
                : {}),
            };
          }),

        setPdfDetached: (detached) =>
          set((state) => (state.isPdfDetached === detached ? state : { isPdfDetached: detached })),

        togglePdfDetached: () =>
          set((state) => ({ isPdfDetached: !state.isPdfDetached })),

        resetLayout: () => set(DEFAULT_LAYOUT),
      }),
      {
        name: EDITOR_STORAGE_KEYS.WORKBENCH_LAYOUT,
        partialize: (state) => ({
          sidebarLeftOpen: state.sidebarLeftOpen,
          sidebarLeftWidth: state.sidebarLeftWidth,
          activeSidebarTab: state.activeSidebarTab,
          fileOutlineOpen: state.fileOutlineOpen,
          splitRatio: state.splitRatio,
          editorSplitMode: state.editorSplitMode,
          editorSplitRatio: state.editorSplitRatio,
          activeEditorPane: state.activeEditorPane,
        }),
      },
    ),
  ),
);

// ── Cross-Tab Store Synchronization (BroadcastChannel + StorageEvent) ────────

/**
 * Rehydrates a Page's open tab list from `localStorage` when a sibling browser window
 * modifies tabs for that Page, strictly preserving THIS window's own `activeTabId`
 * (matching `rehydrateReaderStoreFromStorage` in `reader.store.ts`).
 */
export function rehydrateEditorPageFromStorage(pageId?: string): void {
  const current = useWorkspaceStore.getState();
  const targetPages = pageId
    ? [pageId]
    : Object.keys(current.tabsByProject).filter(
        (id) => hydratedPageScopes.has(id) || current.tabsByProject[id] !== undefined,
      );

  if (targetPages.length === 0) return;

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

  if (mutated) {
    useWorkspaceStore.setState({
      tabsByProject: nextTabsByProject,
      activeByProject: nextActiveByProject,
    });
  }
}

if (typeof window !== 'undefined') {
  multiTabBus.subscribe((event) => {
    if (event.type === 'EDITOR_TABS_SYNC') {
      rehydrateEditorPageFromStorage(event.pageId);
    }
  });

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === EDITOR_STORAGE_KEYS.EDITOR_TABS) {
      rehydrateEditorPageFromStorage();
    }
  });
}
