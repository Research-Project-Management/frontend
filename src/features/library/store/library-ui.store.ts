import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LibraryScope } from '@/features/library/types/core.types';
import {
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  type LibraryDisplayOptions,
} from '@/features/library/types/display.types';

export type InspectorSectionId =
  | 'info'
  | 'abstract'
  | 'files'
  | 'notes'
  | 'ai'
  | 'collections'
  | 'tags'
  | 'relations'
  | 'cite';

export type ViewMode = 'table' | 'grid';

export type LibraryModalType =
  | 'CREATE_COLLECTION'
  | 'RENAME_COLLECTION'
  | 'DELETE_COLLECTION'
  | 'IMPORT_PAPER'
  | 'UPLOAD_FILES'
  | 'EDIT_METADATA'
  | 'DELETE_ITEMS'
  | 'MOVE_ITEMS'
  | 'MERGE_DUPLICATES'
  | 'EXPORT_BIBTEX'
  | 'SHARE_COLLECTION'
  | 'ADD_LINK'
  | 'IMPORT_FROM_USER'
  | 'TRASH_CONFIRM'
  | 'CREATE_SAVED_SEARCH'
  | (string & {});

export interface LibraryUIState {
  // ── Layout State ─────────────────────────────────────────────────────────────
  activeScope: LibraryScope;
  isSidebarOpen: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  isInspectorOpen: boolean;
  activeInspectorTab: InspectorSectionId;

  // ── Interaction & Selection State ────────────────────────────────────────────
  selectedIds: Set<string>;
  activeItemId: string | null;
  activeCollectionId: string | null;
  activeSavedSearchId: string | null;
  viewMode: ViewMode;
  displayOptions: LibraryDisplayOptions;

  // ── Centralized Modal Dialog Bus ─────────────────────────────────────────────
  activeModal: LibraryModalType | null;
  modalProps: Record<string, unknown>;

  // ── Actions: Scope & Layout ──────────────────────────────────────────────────
  setActiveScope: (scope: LibraryScope) => void;
  setActiveCollectionId: (collectionId: string | null) => void;
  setActiveSavedSearchId: (savedSearchId: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setIsInspectorOpen: (isOpen: boolean) => void;
  toggleInspector: () => void;
  setActiveInspectorTab: (tab: InspectorSectionId) => void;
  toggleInspectorTab: (tab: InspectorSectionId) => void;

  // ── Actions: Display Options ─────────────────────────────────────────────────
  setDisplayOptions: (
    options:
      | LibraryDisplayOptions
      | ((prev: LibraryDisplayOptions) => LibraryDisplayOptions),
  ) => void;

  // ── Actions: Selection ───────────────────────────────────────────────────────
  toggleSelect: (id: string) => void;
  selectOnly: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setActiveItem: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;

  // ── Actions: Modals ──────────────────────────────────────────────────────────
  openModal: (modal: LibraryModalType, props?: Record<string, unknown>) => void;
  closeModal: () => void;
}

export const useLibraryUIStore = create<LibraryUIState>()(
  persist(
    (set) => ({
      // Defaults
      activeScope: {
        type: 'user',
        id: 'user',
        name: 'Library',
      },
      isSidebarOpen: true,
      sidebarWidth: 240,
      inspectorWidth: 360,
      isInspectorOpen: false,
      activeInspectorTab: 'info',

      selectedIds: new Set<string>(),
      activeItemId: null,
      activeCollectionId: null,
      activeSavedSearchId: null,
      viewMode: 'table',
      displayOptions: DEFAULT_LIBRARY_DISPLAY_OPTIONS,

      activeModal: null,
      modalProps: {},

      // Display options handler
      setDisplayOptions: (options) =>
        set((state) => ({
          displayOptions:
            typeof options === 'function'
              ? options(state.displayOptions)
              : options,
        })),

      // Layout handlers
      setActiveScope: (activeScope) =>
        set((state) => {
          const prevKey = `${state.activeScope.type}:${state.activeScope.id || 'user'}`;
          const nextKey = `${activeScope.type}:${activeScope.id || 'user'}`;
          if (prevKey === nextKey) {
            return { activeScope };
          }
          return {
            activeScope,
            selectedIds: new Set<string>(),
            activeItemId: null,
            activeCollectionId: null,
            activeSavedSearchId: null,
          };
        }),

      setActiveCollectionId: (activeCollectionId) =>
        set({
          activeCollectionId,
          ...(activeCollectionId ? { activeSavedSearchId: null } : {}),
        }),

      setActiveSavedSearchId: (activeSavedSearchId) =>
        set({
          activeSavedSearchId,
          ...(activeSavedSearchId ? { activeCollectionId: null } : {}),
        }),

      setSidebarOpen: (isSidebarOpen: boolean) => set({ isSidebarOpen }),

      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

      setSidebarWidth: (width: number) => {
        const clamped = Math.min(Math.max(width, 200), 400);
        set({ sidebarWidth: clamped });
      },

      setInspectorWidth: (inspectorWidth: number) =>
        set({ inspectorWidth: Math.min(Math.max(inspectorWidth, 300), 640) }),

      setIsInspectorOpen: (isInspectorOpen: boolean) => set({ isInspectorOpen }),

      toggleInspector: () => set((s) => ({ isInspectorOpen: !s.isInspectorOpen })),

      setActiveInspectorTab: (activeInspectorTab: InspectorSectionId) =>
        set({ activeInspectorTab, isInspectorOpen: true }),

      toggleInspectorTab: (tab: InspectorSectionId) =>
        set((state) => {
          if (state.isInspectorOpen && state.activeInspectorTab === tab) {
            return { isInspectorOpen: false };
          }
          return { activeInspectorTab: tab, isInspectorOpen: true };
        }),

      // Selection handlers
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
        }),

      setViewMode: (viewMode: ViewMode) => set({ viewMode }),

      // Modal handlers
      openModal: (
        activeModal: LibraryModalType,
        props: Record<string, unknown> = {},
      ) =>
        set({
          activeModal,
          modalProps:
            typeof props === 'object' && props !== null ? props : {},
        }),

      closeModal: () => set({ activeModal: null, modalProps: {} }),
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

// ── Backward-Compatibility Aliases ───────────────────────────────────────────
export const useLibrarySidebarStore = useLibraryUIStore;
export const useLibraryViewStore = useLibraryUIStore;
export const useLibraryModalStore = useLibraryUIStore;
export type LibrarySidebarStore = LibraryUIState;
export type LibraryViewState = LibraryUIState;
export type LibraryModalState = LibraryUIState;
