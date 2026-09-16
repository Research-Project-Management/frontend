/**
 * tabs.store.ts
 *
 * Store for multi-file tab navigation within projects.
 */

import { create } from 'zustand';

export interface EditorTab {
  id: string;
  title: string;
  isDirty?: boolean;
  fileUrl?: string;
}

export interface DocumentTabsState {
  tabsByProject: Record<string, EditorTab[]>;
  activeByProject: Record<string, string | null>;

  openTab: (projectId: string, tab: EditorTab) => void;
  closeTab: (
    projectId: string,
    tabId: string,
    router: (pageId: string | null) => void,
  ) => void;
  setActive: (projectId: string, tabId: string) => void;
  getTabs: (projectId: string) => EditorTab[];
  getActive: (projectId: string) => string | null;
  closeAllForProject: (projectId: string) => void;
  updateTabTitle: (projectId: string, tabId: string, title: string) => void;
  clearAll: () => void;
}

export const useDocumentTabsStore = create<DocumentTabsState>()((set, get) => ({
  tabsByProject: {},
  activeByProject: {},

  openTab(projectId, tab) {
    set((state) => {
      const existing = state.tabsByProject[projectId] ?? [];
      const alreadyOpen = existing.some((t) => t.id === tab.id);
      return {
        tabsByProject: {
          ...state.tabsByProject,
          [projectId]: alreadyOpen
            ? existing.map((t) => (t.id === tab.id ? { ...t, title: tab.title } : t))
            : [...existing, tab],
        },
        activeByProject: {
          ...state.activeByProject,
          [projectId]: tab.id,
        },
      };
    });
  },

  closeTab(projectId, tabId, router) {
    const state = get();
    const currentTabs = state.tabsByProject[projectId] ?? [];
    const idx = currentTabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const remaining = currentTabs.filter((t) => t.id !== tabId);
    let nextActive: string | null = null;

    if (state.activeByProject[projectId] === tabId) {
      if (remaining.length > 0) {
        const nextIdx = Math.min(idx, remaining.length - 1);
        nextActive = remaining[nextIdx].id;
      }
      router(nextActive);
    } else {
      nextActive = state.activeByProject[projectId] ?? null;
    }

    set({
      tabsByProject: {
        ...state.tabsByProject,
        [projectId]: remaining,
      },
      activeByProject: {
        ...state.activeByProject,
        [projectId]: nextActive,
      },
    });
  },

  setActive(projectId, tabId) {
    set((state) => ({
      activeByProject: {
        ...state.activeByProject,
        [projectId]: tabId,
      },
    }));
  },

  getTabs(projectId) {
    return get().tabsByProject[projectId] ?? [];
  },

  getActive(projectId) {
    return get().activeByProject[projectId] ?? null;
  },

  closeAllForProject(projectId) {
    set((state) => {
      const { [projectId]: _tabs, ...remainingTabs } = state.tabsByProject;
      const { [projectId]: _active, ...remainingActive } = state.activeByProject;
      return {
        tabsByProject: remainingTabs,
        activeByProject: remainingActive,
      };
    });
  },

  updateTabTitle(projectId, tabId, title) {
    set((state) => {
      const currentTabs = state.tabsByProject[projectId] ?? [];
      return {
        tabsByProject: {
          ...state.tabsByProject,
          [projectId]: currentTabs.map((t) =>
            t.id === tabId ? { ...t, title } : t,
          ),
        },
      };
    });
  },

  clearAll() {
    set({ tabsByProject: {}, activeByProject: {} });
  },
}));

// Aliases for seamless backward compatibility
export const useTabsStore = useDocumentTabsStore;
export const useEditorTabsStore = useDocumentTabsStore;
export type TabsState = DocumentTabsState;
