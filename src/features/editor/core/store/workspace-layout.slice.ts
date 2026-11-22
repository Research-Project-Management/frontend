/**
 * workspace-layout.slice.ts
 *
 * Workbench Layout State Slice (Sidebar, Split Modes, Active Pane, Detached Preview).
 */

import type { StateCreator } from 'zustand';
import { saveEditorWindowSplitState } from './editor-tabs-storage.adapter';

export type ActivityBarTab = 'files' | 'search' | 'citations' | 'review' | 'ai';
export type EditorSplitMode = 'none' | 'vertical' | 'horizontal';
export type ActiveEditorPane = 'primary' | 'secondary';

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

export interface SecondaryActiveLookup {
  readonly secondaryActiveByProject: Record<string, string | null>;
}

export function createLayoutSlice<TState extends LayoutState & SecondaryActiveLookup>(
  getScope: () => string | null,
): StateCreator<TState, [], [], LayoutState> {
  return (set) => ({
    ...DEFAULT_LAYOUT,

    toggleSidebarLeft: () =>
      set((state) => ({ sidebarLeftOpen: !state.sidebarLeftOpen }) as Partial<TState>),

    setSidebarLeftOpen: (open) =>
      set((state) =>
        (state.sidebarLeftOpen === open ? state : { sidebarLeftOpen: open }) as Partial<TState>,
      ),

    setSidebarLeftWidth: (width) =>
      set((state) => {
        const clamped = Math.max(180, Math.min(width, 480));
        return (state.sidebarLeftWidth === clamped
          ? state
          : { sidebarLeftWidth: clamped }) as Partial<TState>;
      }),

    setActiveSidebarTab: (tab) =>
      set((state) =>
        (state.activeSidebarTab === tab ? state : { activeSidebarTab: tab }) as Partial<TState>,
      ),

    selectActivityTab: (tab) =>
      set((state) => {
        if (state.activeSidebarTab === tab && state.sidebarLeftOpen) {
          return { sidebarLeftOpen: false } as Partial<TState>;
        }
        return {
          activeSidebarTab: tab,
          sidebarLeftOpen: true,
        } as Partial<TState>;
      }),

    toggleFileOutline: () =>
      set((state) => ({ fileOutlineOpen: !state.fileOutlineOpen }) as Partial<TState>),

    setFileOutlineOpen: (open) =>
      set((state) =>
        (state.fileOutlineOpen === open ? state : { fileOutlineOpen: open }) as Partial<TState>,
      ),

    setSplitRatio: (ratio) =>
      set((state) => {
        const clamped = Math.max(0.15, Math.min(ratio, 0.85));
        return (state.splitRatio === clamped ? state : { splitRatio: clamped }) as Partial<TState>;
      }),

    setEditorSplitMode: (mode) =>
      set((state) => {
        if (state.editorSplitMode === mode) return state;
        const scope = getScope();
        if (scope) {
          saveEditorWindowSplitState(scope, { splitMode: mode });
        }
        return { editorSplitMode: mode } as Partial<TState>;
      }),

    toggleEditorSplit: (direction = 'vertical') =>
      set((state) => {
        const nextMode: EditorSplitMode = state.editorSplitMode === 'none' ? direction : 'none';
        const scope = getScope();
        if (scope) {
          saveEditorWindowSplitState(scope, { splitMode: nextMode });
        }
        return { editorSplitMode: nextMode } as Partial<TState>;
      }),

    setEditorSplitRatio: (ratio) =>
      set((state) => {
        const clamped = Math.max(0.2, Math.min(ratio, 0.8));
        return (state.editorSplitRatio === clamped
          ? state
          : { editorSplitRatio: clamped }) as Partial<TState>;
      }),

    setActiveEditorPane: (pane) =>
      set((state) =>
        (state.activeEditorPane === pane ? state : { activeEditorPane: pane }) as Partial<TState>,
      ),

    setSecondaryFileId: (fileId) =>
      set((state) => {
        const scope = getScope();
        if (
          state.secondaryFileId === fileId &&
          (!scope || state.secondaryActiveByProject[scope] === fileId)
        ) {
          return state;
        }
        if (scope) {
          saveEditorWindowSplitState(scope, { secondaryTabId: fileId });
        }
        return {
          secondaryFileId: fileId,
          ...(scope
            ? {
                secondaryActiveByProject: {
                  ...state.secondaryActiveByProject,
                  [scope]: fileId,
                },
              }
            : {}),
        } as Partial<TState>;
      }),

    setPdfDetached: (detached) =>
      set((state) =>
        (state.isPdfDetached === detached ? state : { isPdfDetached: detached }) as Partial<TState>,
      ),

    togglePdfDetached: () =>
      set((state) => ({ isPdfDetached: !state.isPdfDetached }) as Partial<TState>),

    resetLayout: () => set(DEFAULT_LAYOUT as Partial<TState>),
  });
}
