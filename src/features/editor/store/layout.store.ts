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

export type ActivityBarTab = 'files' | 'search' | 'outline' | 'citations' | 'review' | 'chat' | 'ai';
export type BottomPanelTab = 'problems' | 'output';

export interface LayoutState {
  // Activity Bar & Primary Sidebar (Left)
  sidebarLeftOpen: boolean;
  sidebarLeftWidth: number;
  activeSidebarTab: ActivityBarTab;

  // Center Splitter (Editor vs Preview)
  splitRatio: number; // 0.0 - 1.0 (e.g. 0.5 = 50/50)

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

  setSplitRatio: (ratio: number) => void;

  toggleBottomPanel: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelHeight: (height: number) => void;
  setActiveBottomTab: (tab: BottomPanelTab) => void;
  openBottomTab: (tab: BottomPanelTab) => void;

  toggleStatusBar: () => void;
  setStatusBarOpen: (open: boolean) => void;

  resetLayout: () => void;
}

const DEFAULT_LAYOUT = {
  sidebarLeftOpen: true,
  sidebarLeftWidth: 260,
  activeSidebarTab: 'files' as ActivityBarTab,
  splitRatio: 0.5,
  bottomPanelOpen: false,
  bottomPanelHeight: 220,
  activeBottomTab: 'problems' as BottomPanelTab,
  statusBarOpen: true,
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

      setSplitRatio: (ratio) =>
        set({ splitRatio: Math.max(0.15, Math.min(ratio, 0.85)) }),

      toggleBottomPanel: () =>
        set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),
      setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
      setBottomPanelHeight: (height) =>
        set({ bottomPanelHeight: Math.max(120, Math.min(height, 500)) }),
      setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),
      openBottomTab: (tab) =>
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
