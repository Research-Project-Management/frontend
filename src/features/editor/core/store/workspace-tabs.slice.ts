/**
 * workspace-tabs.slice.ts
 *
 * Multi-Page Tabs State & Actions Slice for useWorkspaceStore.
 */

import type { StateCreator } from 'zustand';
import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  isProtectedRootTab,
  resolveNextActiveEditorTabOnClose,
} from '@/features/editor/domain/workspace/editor-tab-pool.domain';
import {
  saveEditorTabsForPage,
  saveEditorWindowSplitState,
  scheduleSaveActiveEditorTab,
  removeEditorTabsForPage,
} from './editor-tabs-storage.adapter';
import { multiTabBus } from '@/shared/lib/multi-tab';
import type { LayoutState } from './workspace-layout.slice';
import {
  isMainDocTab,
  decorateTabWithDirtyGetter,
  computeCloseOtherTabsState,
  computeCloseTabsToRightState,
  computeCloseSavedTabsState,
  computeReorderTabsState,
  computeHydratePageTabsState,
  type HydratePageTabsOptions,
} from './workspace-tabs-bulk';

export type { HydratePageTabsOptions };

export interface WorkspaceTabsSliceState {
  readonly tabsByProject: Record<string, readonly WorkspaceTab[]>;
  readonly activeByProject: Record<string, string | null>;
  readonly secondaryActiveByProject: Record<string, string | null>;

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

  getActiveDocId: (projectId: string, rootPageId?: string | null) => string | null;
  setActiveDocId: (projectId: string, activeDocId: string, rootPageId?: string | null) => void;
  getTabsForHierarchy: (projectId: string, rootPageId?: string | null) => readonly WorkspaceTab[];
}

export const hydratedPageScopes = new Set<string>();
let currentWindowPageScope: string | null = null;

export function getCurrentWindowPageScope(): string | null {
  return currentWindowPageScope;
}

export function createTabsSlice<
  TState extends WorkspaceTabsSliceState &
    Pick<LayoutState, 'editorSplitMode' | 'secondaryFileId'>,
>(): StateCreator<TState, [], [], WorkspaceTabsSliceState> {
  return (set, get) => ({
    tabsByProject: {},
    activeByProject: {},
    secondaryActiveByProject: {},

    openTab: (projectId, tab) => {
      currentWindowPageScope = projectId;
      hydratedPageScopes.add(projectId);
      let didMutateTabs = false;

      set((state) => {
        const wasInitialized = state.tabsByProject[projectId] !== undefined;
        const existing = state.tabsByProject[projectId] ?? [];
        const isIncomingMain = isMainDocTab(tab, projectId) || Boolean(tab.isRoot);
        const now = Date.now();

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
              updatedTabs = existing.map((t, idx) => (idx === previewIdx ? replacement : t));
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

        const seen = new Set<string>();
        const deduped: WorkspaceTab[] = [];
        for (const t of updatedTabs) {
          const key = isMainDocTab(t, projectId) || t.isRoot ? '__main__' : t.id;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(t);
          }
        }

        const activeSecId = state.secondaryActiveByProject[projectId] ?? state.secondaryFileId;

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
        } as Partial<TState>;
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
            } as Partial<TState>;
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
        } as Partial<TState>;
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
      let evictedIds: string[] = [];

      set((state) => {
        const res = computeCloseOtherTabsState(state, projectId, keepTabId);
        evictedIds = res.evictedIds;
        return (res.patch ?? state) as Partial<TState>;
      });

      if (evictedIds.length > 0) {
        multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
      }

      return evictedIds;
    },

    closeTabsToRight: (projectId, fromTabId) => {
      currentWindowPageScope = projectId;
      let closedIds: string[] = [];

      set((state) => {
        const res = computeCloseTabsToRightState(state, projectId, fromTabId);
        closedIds = res.closedIds;
        return (res.patch ?? state) as Partial<TState>;
      });

      if (closedIds.length > 0) {
        multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
      }

      return closedIds;
    },

    closeSavedTabs: (projectId) => {
      currentWindowPageScope = projectId;
      let closedIds: string[] = [];

      set((state) => {
        const res = computeCloseSavedTabsState(state, projectId);
        closedIds = res.closedIds;
        return (res.patch ?? state) as Partial<TState>;
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
        } as Partial<TState>;
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
        } as Partial<TState>;
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
        } as Partial<TState>;
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
        } as Partial<TState>;
      });

      if (didPin) {
        multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
      }
    },

    pinTabForFile: (tabId) => {
      if (!tabId) return;
      const state = get();
      for (const [groupKey, tabs] of Object.entries(state.tabsByProject)) {
        const match = tabs.find((t) => t.id === tabId && t.isPreview && !t.isPinned);
        if (match) {
          state.pinTab(groupKey, tabId);
        }
      }
    },

    reorderTabs: (projectId, orderedTabIds) => {
      currentWindowPageScope = projectId;
      let didReorder = false;

      set((state) => {
        const patch = computeReorderTabsState(state, projectId, orderedTabIds);
        if (!patch) return state;
        didReorder = true;
        return patch as Partial<TState>;
      });

      if (didReorder) {
        multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
      }
    },

    hydratePageTabs: (pageId, options) => {
      if (!pageId) return;
      currentWindowPageScope = pageId;
      hydratedPageScopes.add(pageId);

      set((state) => computeHydratePageTabsState(state, pageId, options) as Partial<TState>);
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
        } as Partial<TState>;
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
        } as Partial<TState>;
      });
      if (didUpdate) {
        multiTabBus.publish({ type: 'EDITOR_TABS_SYNC', pageId: projectId });
      }
    },

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
        return { activeByProject: nextActive } as Partial<TState>;
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
  });
}
