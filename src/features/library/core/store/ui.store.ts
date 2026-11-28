import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StateCreator } from 'zustand';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import type { LibraryScope } from '@/features/library/types/core.types';
import {
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  type LibraryDisplayOptions,
  type LibraryOrderBy,
} from '@/features/library/types/ingestion.types';
import { useLibraryCommandStore } from '../manager/command.manager';

export type QuickSearchMode = 'title_creator_year' | 'fields_tags' | 'everything';

export interface LibraryEphemeralFilters {
  q?: string;
  searchMode?: QuickSearchMode;
  fileStatus?: string;
  hasFile?: string;
  hasNotes?: string;
  readStatus?: string | string[];
  type?: string | string[];
  itemType?: string | string[];
  fromYear?: string;
  toYear?: string;
  startDate?: string;
  endDate?: string;
  tag?: string | string[];
  orderBy?: LibraryOrderBy;
  orderDirection?: 'asc' | 'desc';
  page?: number;
}

export type InspectorSectionId =
  | 'info'
  | 'abstract'
  | 'files'
  | 'notes'
  | 'collections'
  | 'tags'
  | 'relations'
  | 'cite';

export type LibraryModalType =
  | 'UPLOAD_PDF'
  | 'ADD_BY_IDENTIFIER'
  | 'CREATE_COLLECTION'
  | 'SAVED_SEARCH'
  | 'DELETE_CONFIRM'
  | 'EMPTY_TRASH'
  | 'MERGE_DUPLICATES'
  | 'EXPORT_LIBRARY'
  | 'IMPORT_FROM_USER'
  | 'TYPE_CONVERSION'
  | 'CSL_STYLE_MANAGER'
  | 'FEEDS_MANAGER'
  | 'ADD_FEED'
  | 'EDIT_FEED'
  | 'MY_PUBLICATION_CONFIRM';

// 1. Scope & Navigation Context Slice
interface LibraryScopeSlice {
  activeScope: LibraryScope;
  activeCollectionId: string | null;
  ephemeralFilters: LibraryEphemeralFilters;
  setActiveScope: (scope: LibraryScope) => void;
  setActiveCollectionId: (collectionId: string | null) => void;
  setEphemeralFilters: (
    updater:
      | LibraryEphemeralFilters
      | ((prev: LibraryEphemeralFilters) => LibraryEphemeralFilters),
  ) => void;
}

// 2. Workbench Layout & Display Slice
interface LibraryLayoutSlice {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  isInspectorOpen: boolean;
  activeInspectorTab: InspectorSectionId;
  displayOptions: LibraryDisplayOptions;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setIsInspectorOpen: (isOpen: boolean) => void;
  toggleInspector: () => void;
  setActiveInspectorTab: (tab: InspectorSectionId) => void;
  toggleInspectorTab: (tab: InspectorSectionId) => void;
  setDisplayOptions: (
    options:
      | LibraryDisplayOptions
      | ((prev: LibraryDisplayOptions) => LibraryDisplayOptions),
  ) => void;
}

// 3. Multi-Selection Engine Slice
interface LibrarySelectionSlice {
  selectedIds: Set<string>;
  activeItemId: string | null;
  toggleSelect: (id: string) => void;
  selectRange: (ids: string[]) => void;
  resolveDragItemIds: (itemId: string) => string[];
  selectOnly: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setActiveItem: (id: string | null) => void;
  toggleActiveItem: (id: string) => boolean;
  evictItems: (ids: Iterable<string>) => void;
}

// 4. Centralized Modal Dialog Bus Slice
interface LibraryModalSlice {
  activeModal: LibraryModalType | null;
  modalProps: Record<string, unknown>;
  openModal: (modal: LibraryModalType, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

type LibraryUIState = LibraryScopeSlice &
  LibraryLayoutSlice &
  LibrarySelectionSlice &
  LibraryModalSlice;

const EMPTY_SELECTED_IDS = new Set<string>();
const EMPTY_MODAL_PROPS: Record<string, unknown> = {};
const EMPTY_EPHEMERAL_FILTERS: LibraryEphemeralFilters = {};
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
export const MIN_INSPECTOR_WIDTH = 260;
export const MAX_INSPECTOR_WIDTH = 640;

function getInitialScopeFromWorkspace(): LibraryScope {
  return { type: 'user', id: 'user', name: 'My Library', role: 'owner' };
}

const createScopeSlice: StateCreator<
  LibraryUIState,
  [],
  [],
  LibraryScopeSlice
> = (set) => ({
  activeScope: getInitialScopeFromWorkspace(),
  activeCollectionId: null,
  ephemeralFilters: EMPTY_EPHEMERAL_FILTERS,

  setActiveScope: (activeScope) =>
    set((state) => {
      const resolveScopeKey = (s: LibraryScope) => {
        const rawId = s.type === 'project' ? (s.projectId || s.id) : s.id;
        return `${s.type}:${!rawId || rawId === 'me' || rawId === 'personal' ? 'user' : rawId}`;
      };
      const prevKey = resolveScopeKey(state.activeScope);
      const nextKey = resolveScopeKey(activeScope);
      if (prevKey === nextKey) {
        if (
          state.activeScope.name === activeScope.name &&
          state.activeScope.role === activeScope.role
        ) {
          return state;
        }
        return { activeScope };
      }
      useLibraryCommandStore.getState().clearHistory();
      return {
        activeScope,
        selectedIds: state.selectedIds.size === 0 ? state.selectedIds : new Set<string>(),
        activeItemId: null,
        isInspectorOpen: false,
        activeCollectionId: null,
        ephemeralFilters: EMPTY_EPHEMERAL_FILTERS,
        activeModal: null,
        modalProps: EMPTY_MODAL_PROPS,
      };
    }),

  setActiveCollectionId: (activeCollectionId) =>
    set((state) => {
      if (state.activeCollectionId === activeCollectionId) {
        return state;
      }
      return {
        activeCollectionId,
        selectedIds: state.selectedIds.size === 0 ? state.selectedIds : new Set<string>(),
        activeItemId: null,
      };
    }),

  setEphemeralFilters: (updater) =>
    set((state) => {
      const next =
        typeof updater === 'function'
          ? updater(state.ephemeralFilters)
          : updater;
      return next === state.ephemeralFilters
        ? state
        : { ephemeralFilters: next };
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
  inspectorWidth: 320,
  isInspectorOpen: false,
  activeInspectorTab: 'info',
  displayOptions: DEFAULT_LIBRARY_DISPLAY_OPTIONS,

  setSidebarOpen: (isSidebarOpen) =>
    set((s) => (s.isSidebarOpen === isSidebarOpen ? s : { isSidebarOpen })),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  setSidebarWidth: (width) => {
    const clamped = Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);
    set((s) => (s.sidebarWidth === clamped ? s : { sidebarWidth: clamped }));
  },

  setInspectorWidth: (inspectorWidth) => {
    const clamped = Math.min(Math.max(inspectorWidth, MIN_INSPECTOR_WIDTH), MAX_INSPECTOR_WIDTH);
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
    set((state) =>
      state.isInspectorOpen && state.activeInspectorTab === tab
        ? { isInspectorOpen: false }
        : { activeInspectorTab: tab, isInspectorOpen: true },
    ),

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
> = (set, get) => ({
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

  selectRange: (ids) =>
    set((state) => {
      if (ids.length === 0) return state;
      const next = new Set(state.selectedIds);
      for (const id of ids) {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  resolveDragItemIds: (itemId) => {
    const current = get().selectedIds;
    return current.has(itemId) ? Array.from(current) : [itemId];
  },

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

  toggleActiveItem: (id) => {
    const isCurrentlyActive = get().activeItemId === id;
    if (isCurrentlyActive) {
      set({ activeItemId: null });
      return false;
    }
    set({ activeItemId: id, isInspectorOpen: true });
    return true;
  },

  evictItems: (ids) =>
    set((state) => {
      const idSet = ids instanceof Set ? ids : new Set(ids);
      if (idSet.size === 0) return state;

      let selectedChanged = false;
      const nextSelected = new Set(state.selectedIds);
      for (const id of idSet) {
        if (nextSelected.delete(id)) {
          selectedChanged = true;
        }
      }

      const activeCleared =
        state.activeItemId !== null && idSet.has(state.activeItemId);

      if (!selectedChanged && !activeCleared) {
        return state;
      }

      return {
        ...(selectedChanged ? { selectedIds: nextSelected } : {}),
        ...(activeCleared ? { activeItemId: null } : {}),
      };
    }),
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
        sidebarWidth: state.sidebarWidth,
        inspectorWidth: state.inspectorWidth,
        displayOptions: state.displayOptions,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<LibraryUIState>) || {};
        const clamp = (val: unknown, min: number, max: number, fallback: number): number => {
          if (typeof val !== 'number' || Number.isNaN(val)) return fallback;
          return Math.min(Math.max(val, min), max);
        };

        const sidebarWidth = clamp(persisted.sidebarWidth, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, currentState.sidebarWidth);
        const inspectorWidth = clamp(persisted.inspectorWidth, MIN_INSPECTOR_WIDTH, MAX_INSPECTOR_WIDTH, currentState.inspectorWidth);

        const rawDisplay = persisted.displayOptions;
        const displayOptions: LibraryDisplayOptions = {
          ...DEFAULT_LIBRARY_DISPLAY_OPTIONS,
          ...(rawDisplay || {}),
          columns: {
            ...DEFAULT_LIBRARY_DISPLAY_OPTIONS.columns,
            ...(rawDisplay?.columns || {}),
          },
        };

        return {
          ...currentState,
          sidebarWidth,
          inspectorWidth,
          displayOptions,
        };
      },
    },
  ),
);

// Granular Row & Performance Selectors
export const useIsItemSelected = (id: string): boolean =>
  useLibraryUIStore((state) => state.selectedIds.has(id));

export const useIsActiveItem = (id: string): boolean =>
  useLibraryUIStore((state) => state.activeItemId === id);

// Synchronize LibraryUIStore activeScope with WorkspaceContextStore canonical activeSpace
if (typeof window !== 'undefined') {
  const syncWithWorkspace = (state: { activeSpace: { type: string; projectId: string | null; projectName?: string } }) => {
    const isProj = state.activeSpace.type === 'project' && Boolean(state.activeSpace.projectId);
    const targetScope: LibraryScope = isProj
      ? {
          type: 'project',
          id: state.activeSpace.projectId!,
          projectId: state.activeSpace.projectId!,
          name: state.activeSpace.projectName || 'Project Library',
        }
      : {
          type: 'user',
          id: 'user',
          name: 'My Library',
          role: 'owner',
        };
    useLibraryUIStore.getState().setActiveScope(targetScope);
  };

  useWorkspaceContextStore.subscribe(syncWithWorkspace);
  syncWithWorkspace(useWorkspaceContextStore.getState());
}

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__LIBRARY_UI_STORE__ = useLibraryUIStore;
}
