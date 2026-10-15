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
import type {
  WorkspaceTab,
  SplitMode,
  ActiveSidePanel,
} from '@/features/editor/domain/types/workspace.types';

// ── Layout Enums & Types ──────────────────────────────────────────────────────

export type ActivityBarTab = 'files' | 'search' | 'citations' | 'review' | 'ai';
export type BottomPanelTab = 'problems' | 'output';
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

  // Right Review Pane (Overleaf Parity: Review comments & Track Changes alongside CodeMirror)
  reviewPanelOpen: boolean;
  reviewPanelWidth: number;

  // Center Splitter (Editor vs Preview)
  splitRatio: number;

  // Editor Multi-Pane Split (Overleaf Parity: Side-by-side editing)
  editorSplitMode: EditorSplitMode;
  editorSplitRatio: number;
  activeEditorPane: ActiveEditorPane;
  secondaryFileId: string | null;

  // Detached PDF Window (Overleaf Parity: Separate screen preview)
  isPdfDetached: boolean;

  // Bottom Dock Panel (Problems / Diagnostics / Output)
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
  activeBottomTab: BottomPanelTab;

  // Status Bar
  statusBarOpen: boolean;

  // Layout Actions
  toggleSidebarLeft: () => void;
  setSidebarLeftOpen: (open: boolean) => void;
  setSidebarLeftWidth: (width: number) => void;
  setActiveSidebarTab: (tab: ActivityBarTab | 'outline') => void;
  selectActivityTab: (tab: ActivityBarTab | 'outline') => void;

  toggleFileOutline: () => void;
  setFileOutlineOpen: (open: boolean) => void;

  toggleReviewPanel: () => void;
  setReviewPanelOpen: (open: boolean) => void;
  setReviewPanelWidth: (width: number) => void;

  setSplitRatio: (ratio: number) => void;

  setEditorSplitMode: (mode: EditorSplitMode) => void;
  toggleEditorSplit: (direction?: 'vertical' | 'horizontal') => void;
  setEditorSplitRatio: (ratio: number) => void;
  setActiveEditorPane: (pane: ActiveEditorPane) => void;
  setSecondaryFileId: (fileId: string | null) => void;
  setPdfDetached: (detached: boolean) => void;
  togglePdfDetached: () => void;

  toggleBottomPanel: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelHeight: (height: number) => void;
  setActiveBottomTab: (tab: BottomPanelTab) => void;
  openBottomTab: (tab: BottomPanelTab) => void;
  openBottomPanelWithTab: (tab: BottomPanelTab) => void;

  toggleStatusBar: () => void;
  setStatusBarOpen: (open: boolean) => void;

  resetLayout: () => void;
}

export interface WorkspaceStoreState extends LayoutState {
  // Multi-Project Tabs State (Scoped per project for 0ms restoration)
  readonly tabsByProject: Record<string, readonly WorkspaceTab[]>;
  readonly activeByProject: Record<string, string | null>;
  readonly secondaryActiveByProject: Record<string, string | null>;

  // Legacy & Bridge Properties
  readonly splitMode: SplitMode;
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

  // Bridge Layout Actions
  setSplitMode: (mode: SplitMode) => void;
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

const DEFAULT_LAYOUT = {
  sidebarLeftOpen: true,
  sidebarLeftWidth: 260,
  activeSidebarTab: 'files' as ActivityBarTab,
  fileOutlineOpen: true,
  reviewPanelOpen: false,
  reviewPanelWidth: 340,
  splitRatio: 0.5,
  editorSplitMode: 'none' as EditorSplitMode,
  editorSplitRatio: 0.5,
  activeEditorPane: 'primary' as ActiveEditorPane,
  secondaryFileId: null as string | null,
  isPdfDetached: false,
  bottomPanelOpen: false,
  bottomPanelHeight: 220,
  activeBottomTab: 'problems' as BottomPanelTab,
  statusBarOpen: false,
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

        // ── Computed Bridge Properties ────────────────────────────────────────
        get splitMode(): SplitMode {
          const mode = get().editorSplitMode;
          if (mode === 'vertical') return 'vertical';
          if (mode === 'horizontal') return 'horizontal';
          return 'single';
        },
        get activeSidePanel(): ActiveSidePanel {
          const s = get();
          if (!s.sidebarLeftOpen) return null;
          const tab = s.activeSidebarTab;
          if (tab === 'files') return 'explorer';
          return tab;
        },
        get isPdfVisible(): boolean {
          return !get().isPdfDetached;
        },
        get isBottomDockVisible(): boolean {
          return get().bottomPanelOpen;
        },

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

        setActiveSidebarTab: (tab) => {
          if ((tab as string) === 'outline') {
            set({ activeSidebarTab: 'files', fileOutlineOpen: true });
          } else {
            set({ activeSidebarTab: tab as ActivityBarTab });
          }
        },

        selectActivityTab: (tab) =>
          set((state) => {
            const targetTab = (tab as string) === 'outline' ? 'files' : (tab as ActivityBarTab);
            const shouldEnsureOutlineOpen = (tab as string) === 'outline';
            if (state.activeSidebarTab === targetTab && state.sidebarLeftOpen) {
              if (shouldEnsureOutlineOpen && !state.fileOutlineOpen) {
                return { fileOutlineOpen: true };
              }
              return { sidebarLeftOpen: false };
            }
            return {
              activeSidebarTab: targetTab,
              sidebarLeftOpen: true,
              ...(shouldEnsureOutlineOpen ? { fileOutlineOpen: true } : {}),
            };
          }),

        toggleFileOutline: () =>
          set((state) => ({ fileOutlineOpen: !state.fileOutlineOpen })),

        setFileOutlineOpen: (open) => set({ fileOutlineOpen: open }),

        toggleReviewPanel: () =>
          set((state) => ({ reviewPanelOpen: !state.reviewPanelOpen })),

        setReviewPanelOpen: (open) => set({ reviewPanelOpen: open }),

        setReviewPanelWidth: (width) =>
          set({ reviewPanelWidth: Math.max(260, Math.min(width, 520)) }),

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

        toggleBottomPanel: () =>
          set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),

        setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),

        setBottomPanelHeight: (height) =>
          set({ bottomPanelHeight: Math.max(120, Math.min(height, 500)) }),

        setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),

        openBottomTab: (tab) =>
          set({ activeBottomTab: tab, bottomPanelOpen: true }),

        openBottomPanelWithTab: (tab) =>
          set({ activeBottomTab: tab, bottomPanelOpen: true }),

        toggleStatusBar: () =>
          set((state) => ({ statusBarOpen: !state.statusBarOpen })),

        setStatusBarOpen: (open) => set({ statusBarOpen: open }),

        resetLayout: () => set(DEFAULT_LAYOUT),

        // ── Bridge Layout Actions ─────────────────────────────────────────────
        setSplitMode: (splitMode) => {
          if (splitMode === 'single') {
            set({ editorSplitMode: 'none' });
          } else {
            set({ editorSplitMode: splitMode });
          }
        },

        setActiveSidePanel: (panel) => {
          if (!panel) {
            set({ sidebarLeftOpen: false });
          } else if (panel === 'explorer') {
            set({ sidebarLeftOpen: true, activeSidebarTab: 'files' });
          } else if (panel === 'outline') {
            set({ sidebarLeftOpen: true, activeSidebarTab: 'files', fileOutlineOpen: true });
          } else {
            set({ sidebarLeftOpen: true, activeSidebarTab: panel });
          }
        },

        toggleSidePanel: (panel) => {
          const s = get();
          if (panel === 'outline') {
            if (s.sidebarLeftOpen && s.activeSidebarTab === 'files' && s.fileOutlineOpen) {
              set({ sidebarLeftOpen: false });
            } else {
              set({ sidebarLeftOpen: true, activeSidebarTab: 'files', fileOutlineOpen: true });
            }
            return;
          }
          const targetTab: ActivityBarTab = panel === 'explorer' ? 'files' : panel;
          if (s.sidebarLeftOpen && s.activeSidebarTab === targetTab) {
            set({ sidebarLeftOpen: false });
          } else {
            set({ sidebarLeftOpen: true, activeSidebarTab: targetTab });
          }
        },

        togglePdfVisible: () => {
          set((state) => ({ isPdfDetached: !state.isPdfDetached }));
        },

        setPdfVisible: (visible) => {
          set({ isPdfDetached: !visible });
        },

        toggleBottomDockVisible: () => {
          set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen }));
        },

        setBottomDockVisible: (visible) => {
          set({ bottomPanelOpen: visible });
        },
      }),
      {
        name: 'flux_editor_workbench_layout',
        partialize: (state) => ({
          sidebarLeftOpen: state.sidebarLeftOpen,
          sidebarLeftWidth: state.sidebarLeftWidth,
          activeSidebarTab: state.activeSidebarTab,
          fileOutlineOpen: state.fileOutlineOpen,
          reviewPanelOpen: state.reviewPanelOpen,
          reviewPanelWidth: state.reviewPanelWidth,
          splitRatio: state.splitRatio,
          editorSplitMode: state.editorSplitMode,
          editorSplitRatio: state.editorSplitRatio,
          activeEditorPane: state.activeEditorPane,
          secondaryFileId: state.secondaryFileId,
          isPdfDetached: state.isPdfDetached,
          bottomPanelOpen: state.bottomPanelOpen,
          bottomPanelHeight: state.bottomPanelHeight,
          activeBottomTab: state.activeBottomTab,
          statusBarOpen: state.statusBarOpen,
        }),
      }
    )
  )
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
