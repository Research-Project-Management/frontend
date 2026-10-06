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

function isMainDocTab(tab: { id?: string; title?: string }, projectId: string): boolean {
  if (!tab) return false;
  const lowerTitle = tab.title?.toLowerCase() ?? '';
  return (
    tab.id === projectId ||
    tab.id === `${projectId}-main` ||
    lowerTitle === 'main.tex'
  );
}

export const useDocumentTabsStore = create<DocumentTabsState>()((set, get) => ({
  tabsByProject: {},
  activeByProject: {},

  openTab(projectId, tab) {
    set((state) => {
      const existing = state.tabsByProject[projectId] ?? [];
      const isIncomingMain = isMainDocTab(tab, projectId);

      // Check if tab already exists: matching ID, or both represent root main.tex, or matching file title
      const existingIndex = existing.findIndex((t) => {
        if (t.id === tab.id) return true;
        if (isIncomingMain && isMainDocTab(t, projectId)) return true;
        if (t.title.toLowerCase() === tab.title.toLowerCase()) return true;
        return false;
      });

      let updatedTabs: EditorTab[];
      if (existingIndex !== -1) {
        // Tab exists: update in place, preserving existing id if incoming is an alias
        updatedTabs = existing.map((t, idx) =>
          idx === existingIndex
            ? { ...t, ...tab, id: isIncomingMain && t.id.endsWith('-main') ? t.id : tab.id }
            : t
        );
      } else {
        updatedTabs = [...existing, tab];
      }

      // Purge any duplicates that may exist in the project tab list
      const seen = new Set<string>();
      const dedupedTabs: EditorTab[] = [];
      for (const t of updatedTabs) {
        const key = isMainDocTab(t, projectId) ? '__main__' : (t.id || t.title.toLowerCase());
        if (!seen.has(key)) {
          seen.add(key);
          dedupedTabs.push(t);
        }
      }

      return {
        tabsByProject: {
          ...state.tabsByProject,
          [projectId]: dedupedTabs,
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
    const isClosingMain = isMainDocTab({ id: tabId }, projectId);

    const idx = currentTabs.findIndex(
      (t) => t.id === tabId || (isClosingMain && isMainDocTab(t, projectId)),
    );
    if (idx === -1) return;

    const remaining = currentTabs.filter(
      (t) => t.id !== tabId && (!isClosingMain || !isMainDocTab(t, projectId)),
    );
    let nextActive: string | null = null;

    const currentActive = state.activeByProject[projectId];
    const wasActive =
      currentActive === tabId ||
      (isClosingMain && currentActive && isMainDocTab({ id: currentActive }, projectId));

    if (wasActive) {
      if (remaining.length > 0) {
        const nextIdx = Math.min(idx, remaining.length - 1);
        nextActive = remaining[nextIdx].id;
      }
      router(nextActive);
    } else {
      nextActive = currentActive ?? null;
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
