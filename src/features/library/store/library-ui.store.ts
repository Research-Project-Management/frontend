import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LibraryScope } from '../types/core.types';
import {
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  type LibraryDisplayOptions,
} from '../types/display.types';

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
  | (string & {});

export interface LibraryUIState {
  // ── Layout State ─────────────────────────────────────────────────────────────
  activeScope: LibraryScope;
  isOpen: boolean; // Sidebar open (legacy name)
  isSidebarOpen: boolean; // Sidebar open (canonical name)
  width: number; // Sidebar width (legacy name)
  sidebarWidth: number; // Sidebar width (canonical name)
  inspectorWidth: number;
  isInspectorOpen: boolean;
  activeInspectorTab: InspectorSectionId;

  // ── Interaction & Selection State ────────────────────────────────────────────
  selectedIds: Set<string>;
  activeItemId: string | null;
  viewMode: ViewMode;
  displayOptions: LibraryDisplayOptions;

  // ── Centralized Modal Dialog Bus ─────────────────────────────────────────────
  activeModal: LibraryModalType | null;
  payload: any;
  modalProps: Record<string, any>;

  // ── Actions: Scope & Layout ──────────────────────────────────────────────────
  setActiveScope: (scope: LibraryScope) => void;
  setIsOpen: (isOpen: boolean) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggle: () => void;
  toggleSidebar: () => void;
  setWidth: (width: number) => void;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setIsInspectorOpen: (isOpen: boolean) => void;
  setInspectorOpen: (isOpen: boolean) => void;
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
  openModal: (modal: string, props?: Record<string, any>) => void;
  closeModal: () => void;
}

export const useLibraryUIStore = create<LibraryUIState>()(
  persist(
    (set) => ({
      // Defaults
      activeScope: {
        type: 'personal',
        id: 'user',
        name: 'My Library',
        role: 'owner',
      },
      isOpen: true,
      isSidebarOpen: true,
      width: 240,
      sidebarWidth: 240,
      inspectorWidth: 360,
      isInspectorOpen: false,
      activeInspectorTab: 'info',

      selectedIds: new Set<string>(),
      activeItemId: null,
      viewMode: 'table',
      displayOptions: DEFAULT_LIBRARY_DISPLAY_OPTIONS,

      activeModal: null,
      payload: null,
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
      setActiveScope: (activeScope) => set({ activeScope }),

      setIsOpen: (isOpen: boolean) => set({ isOpen, isSidebarOpen: isOpen }),
      setSidebarOpen: (isOpen: boolean) => set({ isOpen, isSidebarOpen: isOpen }),

      toggle: () => set((s) => ({ isOpen: !s.isOpen, isSidebarOpen: !s.isOpen })),
      toggleSidebar: () => set((s) => ({ isOpen: !s.isOpen, isSidebarOpen: !s.isOpen })),

      setWidth: (width: number) => {
        const clamped = Math.min(Math.max(width, 200), 400);
        set({ width: clamped, sidebarWidth: clamped });
      },
      setSidebarWidth: (width: number) => {
        const clamped = Math.min(Math.max(width, 200), 400);
        set({ width: clamped, sidebarWidth: clamped });
      },

      setInspectorWidth: (inspectorWidth: number) =>
        set({ inspectorWidth: Math.min(Math.max(inspectorWidth, 300), 640) }),

      setIsInspectorOpen: (isInspectorOpen: boolean) => set({ isInspectorOpen }),
      setInspectorOpen: (isInspectorOpen: boolean) => set({ isInspectorOpen }),

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
      openModal: (activeModal: any, payloadOrProps: any = null) =>
        set({
          activeModal,
          payload: payloadOrProps,
          modalProps:
            typeof payloadOrProps === 'object' && payloadOrProps !== null
              ? payloadOrProps
              : {},
        }),

      closeModal: () => set({ activeModal: null, payload: null, modalProps: {} }),
    }),
    {
      name: 'flux_library_sidebar_v1',
      partialize: (state) => ({
        activeScope: state.activeScope,
        width: state.width,
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
