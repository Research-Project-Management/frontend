import { create } from 'zustand';

interface LibrarySidebarStore {
  isOpen: boolean;
  width: number;
  setIsOpen: (isOpen: boolean) => void;
  toggle: () => void;
  setWidth: (width: number) => void;
}

export const useLibrarySidebarStore = create<LibrarySidebarStore>((set) => ({
  isOpen: true,
  width: 240,
  setIsOpen: (isOpen) => set({ isOpen }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setWidth: (width) => set({ width: Math.min(Math.max(width, 240), 700) }),
}));
