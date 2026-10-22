import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import type { LibraryScope } from '@/features/library/domain/types/core.types';
import {
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  type LibraryDisplayOptions,
} from '@/features/library/domain/types/display.types';

export type InspectorSectionId =
  | 'info'
  | 'abstract'
  | 'files'
  | 'notes'
  | 'collections'
  | 'tags'
  | 'relations'
  | 'cite';

export type ViewMode = 'table' | 'grid';

export type LibraryModalType =
  | 'UPLOAD_PDF'
  | 'ADD_BY_IDENTIFIER'
  | 'CREATE_COLLECTION'
  | 'RENAME_COLLECTION'
  | 'SAVED_SEARCH'
  | 'DELETE_CONFIRM'
  | 'MERGE_DUPLICATES'
  | 'EXPORT_LIBRARY'
  | 'IMPORT_FROM_USER'
  | 'SHORTCUTS_HELP'
  | 'TYPE_CONVERSION'
  | 'CSL_STYLE_MANAGER'
  | 'FEEDS_MANAGER'
  | 'ADD_FEED';

// 1. Scope & Navigation Context Slice
export interface LibraryScopeSlice {
  activeScope: LibraryScope;
  activeCollectionId: string | null;
  activeSavedSearchId: string | null;
  setActiveScope: (scope: LibraryScope) => void;
  setActiveCollectionId: (collectionId: string | null) => void;
  setActiveSavedSearchId: (savedSearchId: string | null) => void;
}

// 2. Workbench Layout & Display Slice
export interface LibraryLayoutSlice {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  isInspectorOpen: boolean;
  activeInspectorTab: InspectorSectionId;
  viewMode: ViewMode;
  displayOptions: LibraryDisplayOptions;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setIsInspectorOpen: (isOpen: boolean) => void;
  toggleInspector: () => void;
  setActiveInspectorTab: (tab: InspectorSectionId) => void;
  toggleInspectorTab: (tab: InspectorSectionId) => void;
  setViewMode: (mode: ViewMode) => void;
  setDisplayOptions: (
    options:
      | LibraryDisplayOptions
      | ((prev: LibraryDisplayOptions) => LibraryDisplayOptions),
  ) => void;
}

// 3. Multi-Selection Engine Slice
export interface LibrarySelectionSlice {
  selectedIds: Set<string>;
  activeItemId: string | null;
  toggleSelect: (id: string) => void;
  selectOnly: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setActiveItem: (id: string | null) => void;
}

// 4. Centralized Modal Dialog Bus Slice
export interface LibraryModalSlice {
  activeModal: LibraryModalType | null;
  modalProps: Record<string, unknown>;
  openModal: (modal: LibraryModalType, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export type LibraryUIState = LibraryScopeSlice &
  LibraryLayoutSlice &
  LibrarySelectionSlice &
  LibraryModalSlice;

const EMPTY_SELECTED_IDS = new Set<string>();
const EMPTY_MODAL_PROPS: Record<string, unknown> = {};

const createScopeSlice: StateCreator<
  LibraryUIState,
  [],
  [],
  LibraryScopeSlice
> = (set) => ({
  activeScope: {
    type: 'user',
    id: 'user',
    name: 'Library',
  },
  activeCollectionId: null,
  activeSavedSearchId: null,

  setActiveScope: (activeScope) =>
    set((state) => {
      const prevKey = `${state.activeScope.type}:${state.activeScope.id || 'user'}`;
      const nextKey = `${activeScope.type}:${activeScope.id || 'user'}`;
      if (prevKey === nextKey) {
        if (state.activeScope.name === activeScope.name) {
          return state;
        }
        return { activeScope };
      }
      return {
        activeScope,
        selectedIds: state.selectedIds.size === 0 ? state.selectedIds : new Set<string>(),
        activeItemId: null,
        activeCollectionId: null,
        activeSavedSearchId: null,
      };
    }),

  setActiveCollectionId: (activeCollectionId) =>
    set((state) => {
      const nextSavedSearchId = activeCollectionId ? null : state.activeSavedSearchId;
      if (
        state.activeCollectionId === activeCollectionId &&
        state.activeSavedSearchId === nextSavedSearchId
      ) {
        return state;
      }
      return {
        activeCollectionId,
        activeSavedSearchId: nextSavedSearchId,
        selectedIds: state.selectedIds.size === 0 ? state.selectedIds : new Set<string>(),
        activeItemId: null,
      };
    }),

  setActiveSavedSearchId: (activeSavedSearchId) =>
    set((state) => {
      const nextCollectionId = activeSavedSearchId ? null : state.activeCollectionId;
      if (
        state.activeSavedSearchId === activeSavedSearchId &&
        state.activeCollectionId === nextCollectionId
      ) {
        return state;
      }
      return {
        activeSavedSearchId,
        activeCollectionId: nextCollectionId,
        selectedIds: state.selectedIds.size === 0 ? state.selectedIds : new Set<string>(),
        activeItemId: null,
      };
    }),
});

const createLayoutSlice: StateCreator<
  LibraryUIState,
  [],
  [],
  LibraryLayoutSlice
> = (set) => ({
  isSidebarOpen: true,
  sidebarWidth: 260,
  inspectorWidth: 360,
  isInspectorOpen: false,
  activeInspectorTab: 'info',
  viewMode: 'table',
  displayOptions: DEFAULT_LIBRARY_DISPLAY_OPTIONS,

  setSidebarOpen: (isSidebarOpen) =>
    set((s) => (s.isSidebarOpen === isSidebarOpen ? s : { isSidebarOpen })),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  setSidebarWidth: (width) => {
    const clamped = Math.min(Math.max(width, 200), 400);
    set((s) => (s.sidebarWidth === clamped ? s : { sidebarWidth: clamped }));
  },

  setInspectorWidth: (inspectorWidth) => {
    const clamped = Math.min(Math.max(inspectorWidth, 300), 640);
    set((s) => (s.inspectorWidth === clamped ? s : { inspectorWidth: clamped }));
  },

  setIsInspectorOpen: (isInspectorOpen) =>
    set((s) => (s.isInspectorOpen === isInspectorOpen ? s : { isInspectorOpen })),

  toggleInspector: () => set((s) => ({ isInspectorOpen: !s.isInspectorOpen })),

  setActiveInspectorTab: (activeInspectorTab) =>
    set((s) =>
      s.activeInspectorTab === activeInspectorTab && s.isInspectorOpen
        ? s
        : { activeInspectorTab, isInspectorOpen: true },
    ),

  toggleInspectorTab: (tab) =>
    set((state) => {
      if (state.isInspectorOpen && state.activeInspectorTab === tab) {
        return { isInspectorOpen: false };
      }
      return { activeInspectorTab: tab, isInspectorOpen: true };
    }),

  setViewMode: (viewMode) =>
    set((s) => (s.viewMode === viewMode ? s : { viewMode })),

  setDisplayOptions: (options) =>
    set((state) => {
      const next =
        typeof options === 'function' ? options(state.displayOptions) : options;
      return next === state.displayOptions ? state : { displayOptions: next };
    }),
});

const createSelectionSlice: StateCreator<
  LibraryUIState,
  [],
  [],
  LibrarySelectionSlice
> = (set) => ({
  selectedIds: EMPTY_SELECTED_IDS,
  activeItemId: null,

  toggleSelect: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectOnly: (id) =>
    set((state) => {
      if (
        state.activeItemId === id &&
        state.selectedIds.size === 1 &&
        state.selectedIds.has(id)
      ) {
        return state;
      }
      return {
        selectedIds: new Set([id]),
        activeItemId: id,
      };
    }),

  selectAll: (ids) =>
    set((state) => {
      if (
        ids.length === state.selectedIds.size &&
        ids.every((id) => state.selectedIds.has(id))
      ) {
        return state;
      }
      return {
        selectedIds: new Set(ids),
      };
    }),

  clearSelection: () =>
    set((state) => {
      if (state.selectedIds.size === 0) {
        return state;
      }
      return {
        selectedIds: new Set(),
      };
    }),

  setActiveItem: (id) =>
    set((state) => (state.activeItemId === id ? state : { activeItemId: id })),
});

const createModalSlice: StateCreator<
  LibraryUIState,
  [],
  [],
  LibraryModalSlice
> = (set) => ({
  activeModal: null,
  modalProps: EMPTY_MODAL_PROPS,

  openModal: (activeModal, props = EMPTY_MODAL_PROPS) =>
    set({
      activeModal,
      modalProps:
        typeof props === 'object' && props !== null ? props : EMPTY_MODAL_PROPS,
    }),

  closeModal: () =>
    set((state) =>
      state.activeModal === null && state.modalProps === EMPTY_MODAL_PROPS
        ? state
        : { activeModal: null, modalProps: EMPTY_MODAL_PROPS },
    ),
});

export const useLibraryUIStore = create<LibraryUIState>()(
  persist(
    (...a) => ({
      ...createScopeSlice(...a),
      ...createLayoutSlice(...a),
      ...createSelectionSlice(...a),
      ...createModalSlice(...a),
    }),
    {
      name: 'flux_library_sidebar_v1',
      partialize: (state) => ({
        activeScope: {
          type: state.activeScope.type,
          id: state.activeScope.id,
          name: state.activeScope.name,
          ...(state.activeScope.type === 'project' && state.activeScope.projectId
            ? { projectId: state.activeScope.projectId }
            : {}),
        } as LibraryScope,
        sidebarWidth: state.sidebarWidth,
        inspectorWidth: state.inspectorWidth,
        displayOptions: state.displayOptions,
      }),
    },
  ),
);

// Granular Row & Performance Selectors
export const useIsItemSelected = (id: string): boolean =>
  useLibraryUIStore((state) => state.selectedIds.has(id));

export const useIsActiveItem = (id: string): boolean =>
  useLibraryUIStore((state) => state.activeItemId === id);

export const useSelectionCount = (): number =>
  useLibraryUIStore((state) => state.selectedIds.size);

export const useHasSelection = (): boolean =>
  useLibraryUIStore((state) => state.selectedIds.size > 0);

