import { create } from 'zustand';

interface LibrarySidebarStore {
  isOpen: boolean;
  width: number;
  inspectorWidth: number;
  setIsOpen: (isOpen: boolean) => void;
  toggle: () => void;
  setWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
}

export const useLibrarySidebarStore = create<LibrarySidebarStore>((set) => ({
  isOpen: true,
  width: 250,
  inspectorWidth: 380,
  setIsOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setWidth: (width) => set({ width: Math.min(Math.max(width, 210), 500) }),
  setInspectorWidth: (inspectorWidth) =>
    set({ inspectorWidth: Math.min(Math.max(inspectorWidth, 300), 650) }),
}));

