'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AiModalType = 'skills' | 'usage' | 'analytics' | 'memory' | null;

export interface AiUIState {
  // ── Layout State ─────────────────────────────────────────────────────────────
  isSidebarOpen: boolean;
  isSourcesOpen: boolean;
  sidebarWidth: number;

  // ── Modals State ─────────────────────────────────────────────────────────────
  activeModal: AiModalType;

  // ── Search & Filter State ───────────────────────────────────────────────────
  searchQuery: string;
  isSearchVisible: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────────
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleSources: () => void;
  setSourcesOpen: (isOpen: boolean) => void;
  openModal: (modal: AiModalType) => void;
  closeModal: () => void;
  setSearchQuery: (query: string) => void;
  toggleSearchVisible: () => void;
  setSearchVisible: (visible: boolean) => void;
}

export const useAiUIStore = create<AiUIState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      isSourcesOpen: false,
      sidebarWidth: 260,
      activeModal: null,
      searchQuery: '',
      isSearchVisible: false,

      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),

      toggleSources: () => set((state) => ({ isSourcesOpen: !state.isSourcesOpen })),
      setSourcesOpen: (isOpen: boolean) => set({ isSourcesOpen: isOpen }),

      openModal: (modal: AiModalType) => set({ activeModal: modal }),
      closeModal: () => set({ activeModal: null }),

      setSearchQuery: (query: string) => set({ searchQuery: query }),
      toggleSearchVisible: () => set((state) => ({ isSearchVisible: !state.isSearchVisible })),
      setSearchVisible: (visible: boolean) => set({ isSearchVisible: visible }),
    }),
    {
      name: 'ai-ui-storage',
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
      }),
    }
  )
);
