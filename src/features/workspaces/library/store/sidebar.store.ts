import { create } from 'zustand';

interface LibrarySidebarStore {
  isOpen: boolean;
  width: number;
  inspectorWidth: number;
  isInspectorOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  toggle: () => void;
  setWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
  setIsInspectorOpen: (isInspectorOpen: boolean) => void;
  toggleInspector: () => void;
}

export const useLibrarySidebarStore = create<LibrarySidebarStore>((set) => ({
  isOpen: true,
  width: 220,
  inspectorWidth: 300,
  isInspectorOpen: true,
  setIsOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setWidth: (width) => set({ width: Math.min(Math.max(width, 180), 400) }),
  setInspectorWidth: (inspectorWidth) =>
    set({ inspectorWidth: Math.min(Math.max(inspectorWidth, 260), 560) }),
  setIsInspectorOpen: (isInspectorOpen) => set({ isInspectorOpen }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
}));

