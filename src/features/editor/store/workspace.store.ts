/**
 * workspace.store.ts
 *
 * Consolidated Editor Workspace Store (State Management Layer).
 * Location: `frontend/src/features/editor/store/workspace.store.ts`
 *
 * Replaces fragmented tabs.store and layout.store with a single, unified,
 * high-performance Zustand store adhering strictly to Matt Pocock TypeScript standards.
 *
 * Features:
 * - Single source of truth for Tabs (multi-project aware), Split-Panes, and Side Panels.
 * - Atomic selector hooks to prevent unnecessary React re-renders.
 * - Discriminated unions and strict type safety (zero `any`).
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  WorkspaceTab,
  SplitMode,
  ActiveSidePanel,
} from '../domain/types/workspace.types';

// ── Store Interfaces ──────────────────────────────────────────────────────────

export interface WorkspaceStoreState {
  // Tabs State (Scoped per project for 0ms restoration)
  readonly tabsByProject: Record<string, readonly WorkspaceTab[]>;
  readonly activeByProject: Record<string, string | null>;
  readonly secondaryActiveByProject: Record<string, string | null>;

  // Layout & Panes
  readonly splitMode: SplitMode;
  readonly splitRatio: number;
  readonly activeEditorPane: 'primary' | 'secondary';
  readonly activeSidePanel: ActiveSidePanel;
  readonly isPdfVisible: boolean;
  readonly isBottomDockVisible: boolean;

  // Tab Actions
  openTab: (projectId: string, tab: Omit<WorkspaceTab, 'lastAccessedAt'>) => void;
  closeTab: (projectId: string, tabId: string, router?: (nextId: string | null) => void) => void;
  closeAllTabsForProject: (projectId: string) => void;
  setActiveTab: (projectId: string, tabId: string) => void;
  setSecondaryActiveTab: (projectId: string, tabId: string | null) => void;
  markTabDirty: (projectId: string, tabId: string, isDirty: boolean) => void;
  updateTabTitle: (projectId: string, tabId: string, title: string) => void;

  // Layout Actions
  setSplitMode: (mode: SplitMode) => void;
  setSplitRatio: (ratio: number) => void;
  setActiveEditorPane: (pane: 'primary' | 'secondary') => void;
  setActiveSidePanel: (panel: ActiveSidePanel) => void;
  toggleSidePanel: (panel: NonNullable<ActiveSidePanel>) => void;
  togglePdfVisible: () => void;
  setPdfVisible: (visible: boolean) => void;
  toggleBottomDockVisible: () => void;
  setBottomDockVisible: (visible: boolean) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMainDocTab(tab: { id?: string; title?: string }, projectId: string): boolean {
  if (!tab) return false;
  const lowerTitle = tab.title?.toLowerCase() ?? '';
  return (
    tab.id === projectId ||
    tab.id === `${projectId}-main` ||
    lowerTitle === 'main.tex'
  );
}

// ── Store Definition ──────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    tabsByProject: {},
    activeByProject: {},
    secondaryActiveByProject: {},
    splitMode: 'single',
    splitRatio: 0.5,
    activeEditorPane: 'primary',
    activeSidePanel: 'explorer',
    isPdfVisible: true,
    isBottomDockVisible: false,

    // Tab Actions
    openTab: (projectId, tab) => {
      set((state) => {
        const existing = state.tabsByProject[projectId] ?? [];
        const isIncomingMain = isMainDocTab(tab, projectId);
        const now = Date.now();

        const existingIndex = existing.findIndex((t) => {
          if (t.id === tab.id) return true;
          if (isIncomingMain && isMainDocTab(t, projectId)) return true;
          if (t.title.toLowerCase() === tab.title.toLowerCase()) return true;
          return false;
        });

        let updatedTabs: WorkspaceTab[];
        if (existingIndex !== -1) {
          updatedTabs = existing.map((t, idx) =>
            idx === existingIndex
              ? {
                  ...t,
                  ...tab,
                  id: isIncomingMain && t.id.endsWith('-main') ? t.id : tab.id,
                  lastAccessedAt: now,
                }
              : t
          );
        } else {
          updatedTabs = [...existing, { ...tab, lastAccessedAt: now }];
        }

        // Deduplicate
        const seen = new Set<string>();
        const deduped: WorkspaceTab[] = [];
        for (const t of updatedTabs) {
          const key = isMainDocTab(t, projectId) ? '__main__' : (t.id || t.title.toLowerCase());
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(t);
          }
        }

        return {
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: deduped,
          },
          activeByProject: {
            ...state.activeByProject,
            [projectId]: tab.id,
          },
        };
      });
    },

    closeTab: (projectId, tabId, router) => {
      set((state) => {
        const currentTabs = state.tabsByProject[projectId] ?? [];
        const isClosingMain = isMainDocTab({ id: tabId }, projectId);

        const idx = currentTabs.findIndex(
          (t) => t.id === tabId || (isClosingMain && isMainDocTab(t, projectId))
        );
        if (idx === -1) return state;

        const remaining = currentTabs.filter(
          (t) => t.id !== tabId && (!isClosingMain || !isMainDocTab(t, projectId))
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
          if (router) {
            router(nextActive);
          }
        } else {
          nextActive = currentActive ?? null;
        }

        let nextSecondary = state.secondaryActiveByProject[projectId];
        if (nextSecondary === tabId) {
          nextSecondary = null;
        }

        return {
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: remaining,
          },
          activeByProject: {
            ...state.activeByProject,
            [projectId]: nextActive,
          },
          secondaryActiveByProject: {
            ...state.secondaryActiveByProject,
            [projectId]: nextSecondary,
          },
        };
      });
    },

    closeAllTabsForProject: (projectId) => {
      set((state) => {
        const { [projectId]: _tabs, ...remainingTabs } = state.tabsByProject;
        const { [projectId]: _active, ...remainingActive } = state.activeByProject;
        const { [projectId]: _secActive, ...remainingSecActive } = state.secondaryActiveByProject;
        return {
          tabsByProject: remainingTabs,
          activeByProject: remainingActive,
          secondaryActiveByProject: remainingSecActive,
        };
      });
    },

    setActiveTab: (projectId, tabId) => {
      set((state) => {
        const now = Date.now();
        const current = state.tabsByProject[projectId] ?? [];
        const updated = current.map((t) =>
          t.id === tabId ? { ...t, lastAccessedAt: now } : t
        );
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
      set((state) => ({
        secondaryActiveByProject: {
          ...state.secondaryActiveByProject,
          [projectId]: tabId,
        },
      }));
    },

    markTabDirty: (projectId, tabId, isDirty) => {
      set((state) => {
        const current = state.tabsByProject[projectId] ?? [];
        return {
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: current.map((t) => (t.id === tabId ? { ...t, isDirty } : t)),
          },
        };
      });
    },

    updateTabTitle: (projectId, tabId, title) => {
      set((state) => {
        const current = state.tabsByProject[projectId] ?? [];
        return {
          tabsByProject: {
            ...state.tabsByProject,
            [projectId]: current.map((t) => (t.id === tabId ? { ...t, title } : t)),
          },
        };
      });
    },

    // Layout Actions
    setSplitMode: (splitMode) => set({ splitMode }),
    setSplitRatio: (splitRatio) => set({ splitRatio }),
    setActiveEditorPane: (activeEditorPane) => set({ activeEditorPane }),

    setActiveSidePanel: (activeSidePanel) => set({ activeSidePanel }),

    toggleSidePanel: (panel) => {
      set((state) => ({
        activeSidePanel: state.activeSidePanel === panel ? null : panel,
      }));
    },

    togglePdfVisible: () => {
      set((state) => ({ isPdfVisible: !state.isPdfVisible }));
    },

    setPdfVisible: (isPdfVisible) => {
      set({ isPdfVisible });
    },

    toggleBottomDockVisible: () => {
      set((state) => ({ isBottomDockVisible: !state.isBottomDockVisible }));
    },

    setBottomDockVisible: (isBottomDockVisible) => {
      set({ isBottomDockVisible });
    },
  }))
);

// ── Matt Pocock Atomic Selectors (0ms Re-render Optimization) ────────────────

const EMPTY_TABS: readonly WorkspaceTab[] = [];

export const useProjectTabs = (projectId: string): readonly WorkspaceTab[] =>
  useWorkspaceStore((s) => s.tabsByProject[projectId] ?? EMPTY_TABS);

export const useActiveProjectTabId = (projectId: string): string | null =>
  useWorkspaceStore((s) => s.activeByProject[projectId] ?? null);

export const useSecondaryActiveProjectTabId = (projectId: string): string | null =>
  useWorkspaceStore((s) => s.secondaryActiveByProject[projectId] ?? null);

export const useActiveProjectTab = (projectId: string): WorkspaceTab | undefined => {
  const activeId = useActiveProjectTabId(projectId);
  return useWorkspaceStore((s) => (s.tabsByProject[projectId] ?? []).find((t) => t.id === activeId));
};

export const useWorkspaceSplitMode = () => useWorkspaceStore((s) => s.splitMode);
export const useWorkspaceSplitRatio = () => useWorkspaceStore((s) => s.splitRatio);
export const useActiveEditorPane = () => useWorkspaceStore((s) => s.activeEditorPane);
export const useActiveSidePanel = () => useWorkspaceStore((s) => s.activeSidePanel);
export const useIsPdfVisible = () => useWorkspaceStore((s) => s.isPdfVisible);
export const useIsBottomDockVisible = () => useWorkspaceStore((s) => s.isBottomDockVisible);
