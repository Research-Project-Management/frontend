import { create } from 'zustand';

export type InspectorSectionId =
  | 'info'
  | 'abstract'
  | 'files'
  | 'notes'
  | 'collections'
  | 'tags'
  | 'relations'
  | 'cite';

interface LibrarySidebarStore {
  isOpen: boolean;
  width: number;
  inspectorWidth: number;
  isInspectorOpen: boolean;
  activeInspectorTab: InspectorSectionId;
  setIsOpen: (isOpen: boolean) => void;
  toggle: () => void;
  setWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setIsInspectorOpen: (isInspectorOpen: boolean) => void;
  toggleInspector: () => void;
  setActiveInspectorTab: (tab: InspectorSectionId) => void;
  toggleInspectorTab: (tab: InspectorSectionId) => void;
}

export const useLibrarySidebarStore = create<LibrarySidebarStore>((set) => ({
  isOpen: true,
  width: 220,
  inspectorWidth: 360,
  isInspectorOpen: false,
  activeInspectorTab: 'info',
  setIsOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setWidth: (width) => set({ width: Math.min(Math.max(width, 180), 400) }),
  setInspectorWidth: (inspectorWidth) =>
    set({ inspectorWidth: Math.min(Math.max(inspectorWidth, 300), 640) }),
  setIsInspectorOpen: (isInspectorOpen) => set({ isInspectorOpen }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
  setActiveInspectorTab: (activeInspectorTab) => set({ activeInspectorTab, isInspectorOpen: true }),
  toggleInspectorTab: (tab) =>
    set((state) => {
      if (state.isInspectorOpen && state.activeInspectorTab === tab) {
        return { isInspectorOpen: false };
      }
      return { activeInspectorTab: tab, isInspectorOpen: true };
    }),
}));


