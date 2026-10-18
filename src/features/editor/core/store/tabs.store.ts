/**
 * tabs.store.ts
 *
 * Store for multi-file tab navigation within projects.
 * Clean Facade over the consolidated useWorkspaceStore (State Layer).
 * Location: `frontend/src/features/editor/store/tabs.store.ts`
 *
 * Adheres strictly to Matt Pocock Deep Module standards:
 * - Single source of truth in workspace.store.ts
 * - Zero state duplication or string-inspection proxying
 */

import { useWorkspaceStore } from './workspace.store';
import { usePageStore } from './editor.store';
import type { EditorTab } from './workspace.store';

export type { EditorTab } from './workspace.store';

export interface DocumentTabsState {
  tabsByProject: Record<string, readonly EditorTab[]>;
  activeByProject: Record<string, string | null>;
  secondaryActiveByProject: Record<string, string | null>;

  openTab: (projectIdOrTab: string | EditorTab, maybeTab?: EditorTab) => void;
  closeTab: (
    projectIdOrTabId: string,
    maybeTabId?: string | ((pageId: string | null) => void),
    router?: (pageId: string | null) => void,
  ) => void;
  setActive: (projectId: string, tabId: string) => void;
  setSecondaryActive: (projectId: string, tabId: string | null) => void;
  getTabs: (projectId: string) => readonly EditorTab[];
  getActive: (projectId: string) => string | null;
  getSecondaryActive: (projectId: string) => string | null;
  closeAllForProject: (projectId: string) => void;
  updateTabTitle: (projectId: string, tabId: string, title: string) => void;
  clearAll: () => void;
}

function resolveProjectId(): string {
  return usePageStore.getState().projectId || usePageStore.getState().currentPage?.id || 'default';
}

export const tabsActions = {
  openTab: (projectIdOrTab: string | EditorTab, maybeTab?: EditorTab) => {
    let projectId: string;
    let tab: EditorTab;
    if (typeof projectIdOrTab === 'object' && projectIdOrTab !== null) {
      tab = projectIdOrTab;
      projectId = resolveProjectId();
    } else {
      projectId = projectIdOrTab;
      tab = maybeTab!;
    }
    if (!tab) return;
    useWorkspaceStore.getState().openTab(projectId, {
      id: tab.id,
      title: tab.title,
      path: tab.path ?? tab.id,
      isDirty: Boolean(tab.isDirty),
      isPinned: false,
    });
  },

  closeTab: (
    projectIdOrTabId: string,
    maybeTabId?: string | ((pageId: string | null) => void),
    maybeRouter?: (pageId: string | null) => void,
  ) => {
    let projectId: string;
    let tabId: string;
    let router: ((pageId: string | null) => void) | undefined;
    if (typeof maybeTabId === 'function' || maybeTabId === undefined) {
      tabId = projectIdOrTabId;
      projectId = resolveProjectId();
      router = typeof maybeTabId === 'function' ? maybeTabId : maybeRouter;
    } else {
      projectId = projectIdOrTabId;
      tabId = maybeTabId;
      router = maybeRouter;
    }
    useWorkspaceStore.getState().closeTab(projectId, tabId, router);
  },

  setActive: (projectId: string, tabId: string) =>
    useWorkspaceStore.getState().setActiveTab(projectId, tabId),

  setSecondaryActive: (projectId: string, tabId: string | null) =>
    useWorkspaceStore.getState().setSecondaryActiveTab(projectId, tabId),

  getTabs: (projectId: string): readonly EditorTab[] =>
    useWorkspaceStore.getState().tabsByProject[projectId] ?? [],

  getActive: (projectId: string): string | null =>
    useWorkspaceStore.getState().activeByProject[projectId] ?? null,

  getSecondaryActive: (projectId: string): string | null =>
    useWorkspaceStore.getState().secondaryActiveByProject[projectId] ?? null,

  closeAllForProject: (projectId: string) =>
    useWorkspaceStore.getState().closeAllTabsForProject(projectId),

  updateTabTitle: (projectId: string, tabId: string, title: string) =>
    useWorkspaceStore.getState().updateTabTitle(projectId, tabId, title),

  clearAll: () => {
    const ws = useWorkspaceStore.getState();
    for (const pid of Object.keys(ws.tabsByProject)) {
      ws.closeAllTabsForProject(pid);
    }
  },
};

let cachedTabsByProject: Record<string, readonly EditorTab[]> | null = null;
let cachedActiveByProject: Record<string, string | null> | null = null;
let cachedSecondaryActiveByProject: Record<string, string | null> | null = null;
let cachedTabsState: DocumentTabsState | null = null;

function getMappedTabsState(ws: ReturnType<typeof useWorkspaceStore.getState>): DocumentTabsState {
  if (
    cachedTabsState &&
    cachedTabsByProject === ws.tabsByProject &&
    cachedActiveByProject === ws.activeByProject &&
    cachedSecondaryActiveByProject === ws.secondaryActiveByProject
  ) {
    return cachedTabsState;
  }
  cachedTabsByProject = ws.tabsByProject;
  cachedActiveByProject = ws.activeByProject;
  cachedSecondaryActiveByProject = ws.secondaryActiveByProject;
  cachedTabsState = {
    tabsByProject: ws.tabsByProject,
    activeByProject: ws.activeByProject,
    secondaryActiveByProject: ws.secondaryActiveByProject,
    ...tabsActions,
  };
  return cachedTabsState;
}

export const useTabsStore = (<T,>(selector?: (state: DocumentTabsState) => T): T => {
  return useWorkspaceStore((ws) => {
    const state = getMappedTabsState(ws);
    return selector ? selector(state) : (state as unknown as T);
  });
}) as {
  <T>(selector?: (state: DocumentTabsState) => T): T;
  getState: () => DocumentTabsState;
};

useTabsStore.getState = () => getMappedTabsState(useWorkspaceStore.getState());

