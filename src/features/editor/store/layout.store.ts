/**
 * layout.store.ts
 *
 * Workbench Layout State Store (State Layer).
 *
 * Manages Workbench Shell dimensions, slots, and tab visibility:
 * - Activity Bar & Primary Sidebar (Files, Search, Outline, Citations, Review, Chat, AI).
 * - Splitter ratio between Editor and Preview.
 * - Bottom Dock Panel (Problems, Output).
 * - Status Bar visibility.
 *
 * NOTE: AI Research Assistant is integrated into the Left Primary Sidebar.
 *
 * Persisted in localStorage for consistent developer workflow.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityBarTab = 'files' | 'search' | 'outline' | 'citations' | 'review' | 'ai';
export type BottomPanelTab = 'problems' | 'output';
export type EditorSplitMode = 'none' | 'vertical' | 'horizontal';
export type ActiveEditorPane = 'primary' | 'secondary';

export interface LayoutState {
  // Activity Bar & Primary Sidebar (Left)
  sidebarLeftOpen: boolean;
  sidebarLeftWidth: number;
  activeSidebarTab: ActivityBarTab;

  // Right Review Pane (Overleaf Parity: Review comments & Track Changes alongside CodeMirror)
  reviewPanelOpen: boolean;
  reviewPanelWidth: number;

  // Center Splitter (Editor vs Preview)
  splitRatio: number; // 0.0 - 1.0 (e.g. 0.5 = 50/50)

  // Editor Multi-Pane Split (Overleaf Parity: Side-by-side editing)
  editorSplitMode: EditorSplitMode;
  editorSplitRatio: number; // 0.2 - 0.8
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

  // Actions
  toggleSidebarLeft: () => void;
  setSidebarLeftOpen: (open: boolean) => void;
  setSidebarLeftWidth: (width: number) => void;
  setActiveSidebarTab: (tab: ActivityBarTab) => void;
  selectActivityTab: (tab: ActivityBarTab) => void; // Toggle if active, open if inactive

  toggleReviewPanel: () => void;
  setReviewPanelOpen: (open: boolean) => void;
  setReviewPanelWidth: (width: number) => void;

  setSplitRatio: (ratio: number) => void;

  // Editor Split & Detached PDF Actions
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

const DEFAULT_LAYOUT = {
  sidebarLeftOpen: true,
  sidebarLeftWidth: 260,
  activeSidebarTab: 'files' as ActivityBarTab,
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
  statusBarOpen: false, // Default false: Overleaf 1:1 clean full-height viewport
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      ...DEFAULT_LAYOUT,

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
          return { activeSidebarTab: tab, sidebarLeftOpen: true };
        }),

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
    }),
    {
      name: 'flux_editor_workbench_layout',
    }
  )
);
