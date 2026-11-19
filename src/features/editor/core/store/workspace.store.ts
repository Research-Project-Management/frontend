/**
 * workspace.store.ts
 *
 * Consolidated Editor Workspace & Workbench Store (State Management Layer).
 * Location: `frontend/src/features/editor/core/store/workspace.store.ts`
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type { WorkspaceTab, EditorTab } from '@/features/editor/domain/types/workspace.types';
import { EDITOR_STORAGE_KEYS } from '@/features/editor/domain/constants/editor.constants';
import { multiTabBus } from '@/shared/lib/multi-tab';
import {
  createLayoutSlice,
  type ActivityBarTab,
  type EditorSplitMode,
  type ActiveEditorPane,
  type LayoutState,
} from './workspace-layout.slice';
import {
  createTabsSlice,
  hydratedPageScopes,
  getCurrentWindowPageScope,
  type WorkspaceTabsSliceState,
  type HydratePageTabsOptions,
} from './workspace-tabs.slice';
import { computeRehydratedPagesPatch } from './workspace-tabs-bulk';

export type {
  ActivityBarTab,
  EditorSplitMode,
  ActiveEditorPane,
  WorkspaceTab,
  EditorTab,
  LayoutState,
  HydratePageTabsOptions,
};

export interface WorkspaceStoreState extends LayoutState, WorkspaceTabsSliceState {}

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get, store) => ({
        ...createTabsSlice<WorkspaceStoreState>()(set, get, store),
        ...createLayoutSlice<WorkspaceStoreState>(getCurrentWindowPageScope)(set, get, store),
      }),
      {
        name: EDITOR_STORAGE_KEYS.WORKBENCH_LAYOUT,
        partialize: (state) => ({
          sidebarLeftOpen: state.sidebarLeftOpen,
          sidebarLeftWidth: state.sidebarLeftWidth,
          activeSidebarTab: state.activeSidebarTab,
          fileOutlineOpen: state.fileOutlineOpen,
          splitRatio: state.splitRatio,
          editorSplitMode: state.editorSplitMode,
          editorSplitRatio: state.editorSplitRatio,
          activeEditorPane: state.activeEditorPane,
        }),
      },
    ),
  ),
);

/**
 * Rehydrates a Page's open tab list from `localStorage` when a sibling browser window
 * modifies tabs for that Page, strictly preserving THIS window's own `activeTabId`.
 */
export function rehydrateEditorPageFromStorage(pageId?: string): void {
  const current = useWorkspaceStore.getState();
  const patch = computeRehydratedPagesPatch(current, hydratedPageScopes, pageId);
  if (patch) {
    useWorkspaceStore.setState(patch);
  }
}

if (typeof window !== 'undefined') {
  multiTabBus.subscribe((event) => {
    if (event.type === 'EDITOR_TABS_SYNC') {
      rehydrateEditorPageFromStorage(event.pageId);
    }
  });

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === EDITOR_STORAGE_KEYS.EDITOR_TABS) {
      rehydrateEditorPageFromStorage();
    }
  });
}
