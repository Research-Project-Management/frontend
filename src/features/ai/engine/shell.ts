'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PendingPromptData {
  text: string;
  spaceId?: string | null;
  projectId?: string | null;
  documentIds?: string[] | null;
  attachedFiles?: Array<{
    id: string;
    name: string;
    size?: number;
    type?: string;
    sourceType?: 'library' | 'upload' | 'paper';
    hasPdf?: boolean;
    itemId?: string;
    fileId?: string;
  }>;
  webSearch?: boolean;
  webSearchSites?: string[] | null;
}

export interface QuotedPassageData {
  text: string;
  label?: string;
  pageNumber?: number;
  paperId?: string;
  paperTitle?: string;
}

export interface AiCompanionState {
  isOpen: boolean;
  width: number;
  activeChatId: string | null;
  isHistoryView: boolean;
  pendingPrompt: PendingPromptData | null;
  quotedPassage: QuotedPassageData | null;

  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setActiveChatId: (id: string | null) => void;
  toggleHistoryView: () => void;
  setHistoryView: (open: boolean) => void;
  setPendingPrompt: (prompt: PendingPromptData | null) => void;
  setQuotedPassage: (passage: QuotedPassageData | null) => void;
}

export const useAiCompanionStore = create<AiCompanionState>()(
  persist(
    (set) => ({
      isOpen: false,
      width: 380,
      activeChatId: null,
      isHistoryView: false,
      pendingPrompt: null,
      quotedPassage: null,

      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (open: boolean) => set({ isOpen: open }),
      setWidth: (width: number) =>
        set({ width: Math.min(Math.max(width, 280), 840) }),
      setActiveChatId: (id: string | null) =>
        set({ activeChatId: id, isHistoryView: false }),
      toggleHistoryView: () =>
        set((state) => ({ isHistoryView: !state.isHistoryView })),
      setHistoryView: (open: boolean) => set({ isHistoryView: open }),
      setPendingPrompt: (prompt: PendingPromptData | null) =>
        set((state) => ({
          pendingPrompt: prompt,
          isOpen: prompt ? true : state.isOpen,
          isHistoryView: prompt ? false : state.isHistoryView,
        })),
      setQuotedPassage: (passage: QuotedPassageData | null) =>
        set((state) => ({
          quotedPassage: passage,
          isOpen: passage ? true : state.isOpen,
          isHistoryView: passage ? false : state.isHistoryView,
        })),
    }),
    {
      name: 'flux-ai-companion-storage',
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const raw =
          persistedState && typeof persistedState === 'object'
            ? { ...(persistedState as Record<string, unknown>) }
            : {};
        if (version < 2 && (!raw.width || raw.width === 420)) {
          raw.width = 380;
        }
        // Drop obsolete ghost fields from earlier schema versions
        delete raw.selectedModel;
        delete raw.isDocumentsView;
        return raw as unknown as AiCompanionState;
      },
      partialize: (state) => ({
        isOpen: state.isOpen,
        width: state.width,
        activeChatId: state.activeChatId,
      }),
    },
  ),
);

export interface AiUIState {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  searchQuery: string;
  isSearchVisible: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleSearchVisible: () => void;
  setSearchVisible: (visible: boolean) => void;
}

export const useAiUIStore = create<AiUIState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      sidebarWidth: 260,
      searchQuery: '',
      isSearchVisible: false,

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),
      setSearchQuery: (query: string) => set({ searchQuery: query }),
      toggleSearchVisible: () =>
        set((state) => ({ isSearchVisible: !state.isSearchVisible })),
      setSearchVisible: (visible: boolean) =>
        set({ isSearchVisible: visible }),
    }),
    {
      name: 'ai-ui-storage',
      version: 2,
      migrate: (persistedState: unknown) => {
        const raw =
          persistedState && typeof persistedState === 'object'
            ? { ...(persistedState as Record<string, unknown>) }
            : {};
        delete raw.activeModal;
        delete raw.isSourcesOpen;
        return raw as unknown as AiUIState;
      },
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
      }),
    },
  ),
);
