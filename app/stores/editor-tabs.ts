import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface EditorTab {
  id: string;    // pageId
  title: string; // filename
}

interface EditorTabsState {
  /** Tabs grouped by projectId */
  tabsByProject: Record<string, EditorTab[]>;
  /** Currently active pageId per projectId */
  activeByProject: Record<string, string>;

  /** Open a tab (noop if already open). Always sets it as active. */
  openTab: (projectId: string, tab: EditorTab) => void;
  /**
   * Close a tab.
   * @param navigate - called with the next pageId to activate, or null when no tabs remain.
   */
  closeTab: (
    projectId: string,
    tabId: string,
    navigate: (pageId: string | null) => void,
  ) => void;
  /** Set active tab without adding/removing. */
  setActive: (projectId: string, tabId: string) => void;
  /** Get tab list for a project (empty array if none). */
  getTabs: (projectId: string) => EditorTab[];
  /** Get currently active pageId for a project. */
  getActive: (projectId: string) => string | null;
  /** Remove all tabs for a project (e.g. on unmount). */
  closeAllForProject: (projectId: string) => void;
  /** Update the title of an existing tab (e.g. after rename). */
  updateTabTitle: (projectId: string, tabId: string, title: string) => void;
}

export const useEditorTabsStore = create<EditorTabsState>()(
  persist(
    (set, get) => ({
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

      closeTab(projectId, tabId, navigate) {
        const state = get();
        const tabs = state.tabsByProject[projectId] ?? [];
        const activeId = state.activeByProject[projectId] ?? null;
        const idx = tabs.findIndex((t) => t.id === tabId);
        if (idx === -1) return;

        const newTabs = tabs.filter((t) => t.id !== tabId);

        // Determine next active tab
        let nextActive: string | null = null;
        if (activeId === tabId) {
          if (newTabs.length > 0) {
            // Prefer left neighbour, fall back to new last
            nextActive = newTabs[Math.max(0, idx - 1)].id;
          }
          // else null → navigate away
        } else {
          nextActive = activeId;
        }

        set((s) => ({
          tabsByProject: { ...s.tabsByProject, [projectId]: newTabs },
          activeByProject: {
            ...s.activeByProject,
            [projectId]: nextActive ?? s.activeByProject[projectId],
          },
        }));

        if (activeId === tabId) {
          navigate(nextActive);
        }
      },

      setActive(projectId, tabId) {
        set((s) => ({
          activeByProject: { ...s.activeByProject, [projectId]: tabId },
        }));
      },

      getTabs(projectId) {
        return get().tabsByProject[projectId] ?? [];
      },

      getActive(projectId) {
        return get().activeByProject[projectId] ?? null;
      },

      closeAllForProject(projectId) {
        set((s) => {
          const tabs = { ...s.tabsByProject };
          const active = { ...s.activeByProject };
          delete tabs[projectId];
          delete active[projectId];
          return { tabsByProject: tabs, activeByProject: active };
        });
      },

      updateTabTitle(projectId, tabId, title) {
        set((s) => ({
          tabsByProject: {
            ...s.tabsByProject,
            [projectId]: (s.tabsByProject[projectId] ?? []).map((t) =>
              t.id === tabId ? { ...t, title } : t,
            ),
          },
        }));
      },
    }),
    {
      name: "flux-editor-tabs",
      // Only persist tabs and active state (not functions)
      partialize: (s) => ({
        tabsByProject: s.tabsByProject,
        activeByProject: s.activeByProject,
      }),
    },
  ),
);
