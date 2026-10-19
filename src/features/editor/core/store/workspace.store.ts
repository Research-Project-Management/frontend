/**
 * workspace.store.ts
 *
 * Consolidated Editor Workspace & Workbench Store (State Management Layer).
 * Location: `frontend/src/features/editor/store/workspace.store.ts`
 *
 * Unified Deep Module (Matt Pocock Codebase Design):
 * - Merges multi-project tab navigation and complete workbench layout into a single, cohesive store.
 * - Single source of truth: Eliminates state desynchronization between tabs, panes, sidebars, and docks.
 * - Persistent preferences: Layout geometry is safely persisted to localStorage ('flux_editor_workbench_layout').
 * - 0ms reactive performance: Atomic selectors prevent unnecessary React re-renders.
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';

// ── Layout Enums & Types ──────────────────────────────────────────────────────

export type ActivityBarTab = 'files' | 'search' | 'citations' | 'review' | 'ai';
export type EditorSplitMode = 'none' | 'vertical' | 'horizontal';
export type ActiveEditorPane = 'primary' | 'secondary';

export interface EditorTab {
  id: string;
  title: string;
  isDirty?: boolean;
  fileUrl?: string;
  path?: string;
  isRoot?: boolean;
}

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

export interface WorkspaceStoreState extends LayoutState {
  // Multi-Project Tabs State (Scoped per project for 0ms restoration)
  readonly tabsByProject: Record<string, readonly WorkspaceTab[]>;
  readonly activeByProject: Record<string, string | null>;
  readonly secondaryActiveByProject: Record<string, string | null>;

  // Tab Actions
  openTab: (projectId: string, tab: Omit<WorkspaceTab, 'lastAccessedAt'>) => void;
  closeTab: (projectId: string, tabId: string, router?: (nextId: string | null) => void) => void;
  closeAllTabsForProject: (projectId: string) => void;
  setActiveTab: (projectId: string, tabId: string) => void;
  setSecondaryActiveTab: (projectId: string, tabId: string | null) => void;
  markTabDirty: (projectId: string, tabId: string, isDirty: boolean) => void;
  updateTabTitle: (projectId: string, tabId: string, title: string) => void;
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
      (set) => ({
        // ── Tabs Initial State ────────────────────────────────────────────────
        tabsByProject: {},
        activeByProject: {},
        secondaryActiveByProject: {},

        // ── Layout Initial State ──────────────────────────────────────────────
        ...DEFAULT_LAYOUT,

        // ── Tabs Actions ──────────────────────────────────────────────────────
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

        // ── Layout Actions ────────────────────────────────────────────────────
        toggleSidebarLeft: () =>
          set((state) => ({ sidebarLeftOpen: !state.sidebarLeftOpen })),

        setSidebarLeftOpen: (open) => set({ sidebarLeftOpen: open }),

        setSidebarLeftWidth: (width) =>
          set({ sidebarLeftWidth: Math.max(180, Math.min(width, 480)) }),

        setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

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

        setFileOutlineOpen: (open) => set({ fileOutlineOpen: open }),

        setSplitRatio: (ratio) =>
          set({ splitRatio: Math.max(0.15, Math.min(ratio, 0.85)) }),

        setEditorSplitMode: (mode) => set({ editorSplitMode: mode }),

        toggleEditorSplit: (direction = 'vertical') =>
          set((state) => ({
            editorSplitMode: state.editorSplitMode === 'none' ? direction : 'none',
          })),

        setEditorSplitRatio: (ratio) =>
          set({ editorSplitRatio: Math.max(0.2, Math.min(ratio, 0.8)) }),

        setActiveEditorPane: (pane) => set({ activeEditorPane: pane }),

        setSecondaryFileId: (fileId) => set({ secondaryFileId: fileId }),

        setPdfDetached: (detached) => set({ isPdfDetached: detached }),

        togglePdfDetached: () =>
          set((state) => ({ isPdfDetached: !state.isPdfDetached })),

        resetLayout: () => set(DEFAULT_LAYOUT),
      }),
      {
        name: 'flux_editor_workbench_layout',
        partialize: (state) => ({
          sidebarLeftOpen: state.sidebarLeftOpen,
          sidebarLeftWidth: state.sidebarLeftWidth,
          activeSidebarTab: state.activeSidebarTab,
          fileOutlineOpen: state.fileOutlineOpen,
          splitRatio: state.splitRatio,
          editorSplitMode: state.editorSplitMode,
          editorSplitRatio: state.editorSplitRatio,
          activeEditorPane: state.activeEditorPane,
          secondaryFileId: state.secondaryFileId,
          isPdfDetached: state.isPdfDetached,
        }),
      }
    )
  )
);
