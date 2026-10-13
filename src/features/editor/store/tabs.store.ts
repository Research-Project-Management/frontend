/**
 * tabs.store.ts
 *
 * Store for multi-file tab navigation within projects.
 * Backwards-compatible facade over the consolidated useWorkspaceStore (State Layer).
 * Location: `frontend/src/features/editor/store/tabs.store.ts`
 */

import { useWorkspaceStore } from './workspace.store';
import { useDocumentEditorStore as usePageStore } from './editor.store';

export interface EditorTab {
  id: string;
  title: string;
  isDirty?: boolean;
  fileUrl?: string;
  path?: string;
  isRoot?: boolean;
}

export interface DocumentTabsState {
  tabsByProject: Record<string, EditorTab[]>;
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
  getTabs: (projectId: string) => EditorTab[];
  getActive: (projectId: string) => string | null;
  getSecondaryActive: (projectId: string) => string | null;
  closeAllForProject: (projectId: string) => void;
  updateTabTitle: (projectId: string, tabId: string, title: string) => void;
  clearAll: () => void;
}

const stableTabsActions = {
  openTab: (projectIdOrTab: string | EditorTab, maybeTab?: EditorTab) => {
    let projectId: string;
    let tab: EditorTab;
    if (typeof projectIdOrTab === 'object' && projectIdOrTab !== null) {
      tab = projectIdOrTab;
      projectId = usePageStore.getState().projectId || usePageStore.getState().currentPage?.id || 'default';
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
      projectId = usePageStore.getState().projectId || usePageStore.getState().currentPage?.id || 'default';
      router = typeof maybeTabId === 'function' ? maybeTabId : maybeRouter;
    } else {
      projectId = projectIdOrTabId;
      tabId = maybeTabId;
      router = maybeRouter;
    }
    useWorkspaceStore.getState().closeTab(projectId, tabId, router);
  },
  setActive: (projectId: string, tabId: string) => useWorkspaceStore.getState().setActiveTab(projectId, tabId),
  setSecondaryActive: (projectId: string, tabId: string | null) => useWorkspaceStore.getState().setSecondaryActiveTab(projectId, tabId),
  getTabs: (projectId: string) => (useWorkspaceStore.getState().tabsByProject[projectId] ?? []) as unknown as EditorTab[],
  getActive: (projectId: string) => useWorkspaceStore.getState().activeByProject[projectId] ?? null,
  getSecondaryActive: (projectId: string) => useWorkspaceStore.getState().secondaryActiveByProject[projectId] ?? null,
  closeAllForProject: (projectId: string) => useWorkspaceStore.getState().closeAllTabsForProject(projectId),
  updateTabTitle: (projectId: string, tabId: string, title: string) => useWorkspaceStore.getState().updateTabTitle(projectId, tabId, title),
  clearAll: () => {
    const ws = useWorkspaceStore.getState();
    for (const pid of Object.keys(ws.tabsByProject)) {
      ws.closeAllTabsForProject(pid);
    }
  },
};

export const useDocumentTabsStore = (<T,>(selector?: (state: DocumentTabsState) => T): T => {
  return useWorkspaceStore((ws) => {
    if (selector) {
      // If the selector requests one of the stable actions, return it directly to guarantee reference equality
      const actionKey = selector.toString();
      if (actionKey.includes('.closeTab')) return stableTabsActions.closeTab as unknown as T;
      if (actionKey.includes('.openTab')) return stableTabsActions.openTab as unknown as T;
      if (actionKey.includes('.setActive')) return stableTabsActions.setActive as unknown as T;
      if (actionKey.includes('.setSecondaryActive')) return stableTabsActions.setSecondaryActive as unknown as T;

      const proxyState: DocumentTabsState = {
        tabsByProject: ws.tabsByProject as unknown as Record<string, EditorTab[]>,
        activeByProject: ws.activeByProject,
        secondaryActiveByProject: ws.secondaryActiveByProject,
        ...stableTabsActions,
      };
      return selector(proxyState);
    }
    return {
      tabsByProject: ws.tabsByProject as unknown as Record<string, EditorTab[]>,
      activeByProject: ws.activeByProject,
      secondaryActiveByProject: ws.secondaryActiveByProject,
      ...stableTabsActions,
    } as unknown as T;
  });
}) as {
  <T>(selector?: (state: DocumentTabsState) => T): T;
  getState: () => DocumentTabsState;
};

useDocumentTabsStore.getState = () => {
  const ws = useWorkspaceStore.getState();
  return {
    tabsByProject: ws.tabsByProject as unknown as Record<string, EditorTab[]>,
    activeByProject: ws.activeByProject,
    secondaryActiveByProject: ws.secondaryActiveByProject,
    ...stableTabsActions,
  };
};

// Backward compatibility aliases
export const useTabsStore = useDocumentTabsStore;
export const useEditorTabsStore = useDocumentTabsStore;
export type TabsState = DocumentTabsState;
