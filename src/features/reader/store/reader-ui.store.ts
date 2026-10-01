'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type InspectorSectionId =
  | 'info'
  | 'abstract'
  | 'notes'
  | 'attachments'
  | 'files'
  | 'tags'
  | 'collections'
  | 'cite'
  | 'relations';

export interface ReaderUIState {
  // Sidebar / Navigation state
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;

  // Inspector panel state
  isInspectorOpen: boolean;
  setIsInspectorOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  toggleInspector: () => void;
  inspectorWidth: number;
  setInspectorWidth: (width: number) => void;
  activeInspectorTab: InspectorSectionId;
  setActiveInspectorTab: (tab: InspectorSectionId) => void;

  // Active library / project scope
  activeScope: string;
  setActiveScope: (scope: string) => void;

  // Active selection & item navigation
  activeItemId: string | null;
  setActiveItemId: (id: string | null) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string> | string[]) => void;
  selectOnly: (id: string) => void;
  clearSelection: () => void;

  // Generic modal management
  activeModal: string | null;
  payload: unknown;
  modalProps: Record<string, unknown>;
  openModal: (modal: string, payloadOrProps?: unknown) => void;
  closeModal: () => void;
}

export const useReaderUIStore = create<ReaderUIState>()(
  persist(
    (set, get) => ({
      // Sidebar
      isOpen: true,
      setIsOpen: (isOpen: boolean) => set({ isOpen }),
      toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),

      // Inspector
      isInspectorOpen: true,
      setIsInspectorOpen: (open) =>
        set((state) => ({
          isInspectorOpen: typeof open === 'function' ? open(state.isInspectorOpen) : open,
        })),
      toggleInspector: () =>
        set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
      inspectorWidth: 340,
      setInspectorWidth: (inspectorWidth: number) => set({ inspectorWidth }),
      activeInspectorTab: 'info',
      setActiveInspectorTab: (activeInspectorTab: InspectorSectionId) =>
        set({ activeInspectorTab }),

      // Scope
      activeScope: 'user',
      setActiveScope: (activeScope: string) => set({ activeScope }),

      // Active item & selection
      activeItemId: null,
      setActiveItemId: (activeItemId: string | null) => set({ activeItemId }),
      selectedIds: new Set<string>(),
      setSelectedIds: (ids) =>
        set({ selectedIds: ids instanceof Set ? ids : new Set(ids) }),
      selectOnly: (id: string) =>
        set({
          activeItemId: id,
          selectedIds: new Set([id]),
        }),
      clearSelection: () =>
        set({
          activeItemId: null,
          selectedIds: new Set(),
        }),

      // Modals
      activeModal: null,
      payload: null,
      modalProps: {},
      openModal: (activeModal: string, payloadOrProps: unknown = null) =>
        set({
          activeModal,
          payload: payloadOrProps,
          modalProps:
            typeof payloadOrProps === 'object' && payloadOrProps !== null
              ? (payloadOrProps as Record<string, unknown>)
              : {},
        }),
      closeModal: () => set({ activeModal: null, payload: null, modalProps: {} }),
    }),
    {
      name: 'flux_reader_ui_v1',
      partialize: (state) => ({
        activeScope: state.activeScope,
        isInspectorOpen: state.isInspectorOpen,
        inspectorWidth: state.inspectorWidth,
        activeInspectorTab: state.activeInspectorTab,
      }),
    },
  ),
);

// Ergonomic / Inspector Parity Aliases
export const useReaderSidebarStore = useReaderUIStore;
export const useReaderViewStore = useReaderUIStore;
export const useReaderModalStore = useReaderUIStore;
export default useReaderUIStore;
