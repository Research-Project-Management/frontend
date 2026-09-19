import { create } from 'zustand';
import type { InspectorSectionId } from './sidebar.store';

export type ViewMode = 'table' | 'grid';

interface LibraryViewState {
  selectedIds: Set<string>;
  activeItemId: string | null;
  viewMode: ViewMode;
  isInspectorOpen: boolean;
  activeInspectorTab: InspectorSectionId;

  // Actions
  toggleSelect: (id: string) => void;
  selectOnly: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setActiveItem: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleInspector: () => void;
  setIsInspectorOpen: (isOpen: boolean) => void;
  setActiveInspectorTab: (tab: InspectorSectionId) => void;
}

export const useLibraryViewStore = create<LibraryViewState>((set) => ({
  selectedIds: new Set<string>(),
  activeItemId: null,
  viewMode: 'table',
  isInspectorOpen: false,
  activeInspectorTab: 'info',

  toggleSelect: (id: string) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectOnly: (id: string) =>
    set({
      selectedIds: new Set([id]),
      activeItemId: id,
      isInspectorOpen: true,
    }),

  selectAll: (ids: string[]) =>
    set({
      selectedIds: new Set(ids),
    }),

  clearSelection: () =>
    set({
      selectedIds: new Set(),
    }),

  setActiveItem: (id: string | null) =>
    set({
      activeItemId: id,
      isInspectorOpen: id !== null,
    }),

  setViewMode: (viewMode: ViewMode) => set({ viewMode }),

  toggleInspector: () =>
    set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),

  setIsInspectorOpen: (isInspectorOpen: boolean) => set({ isInspectorOpen }),

  setActiveInspectorTab: (activeInspectorTab: InspectorSectionId) =>
    set({ activeInspectorTab, isInspectorOpen: true }),
}));
