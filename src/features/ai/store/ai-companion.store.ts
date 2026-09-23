'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PendingPromptData {
  text: string;
  projectId?: string | null;
  attachedFiles?: Array<{ id: string; name: string; size?: number }>;
  webSearch?: boolean;
  webSearchSites?: string[] | null;
}

export interface AiCompanionState {
  isOpen: boolean;
  width: number;
  activeChatId: string | null;
  isHistoryView: boolean;
  selectedModel: string;
  pendingPrompt: PendingPromptData | null;

  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setWidth: (width: number) => void;
  setActiveChatId: (id: string | null) => void;
  toggleHistoryView: () => void;
  setHistoryView: (open: boolean) => void;
  setSelectedModel: (model: string) => void;
  setPendingPrompt: (prompt: PendingPromptData | null) => void;
}

export const useAiCompanionStore = create<AiCompanionState>()(
  persist(
    (set) => ({
      isOpen: false,
      width: 420,
      activeChatId: null,
      isHistoryView: false,
      selectedModel: 'Claude Sonnet 3.7',
      pendingPrompt: null,

      toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (open: boolean) => set({ isOpen: open }),
      setWidth: (width: number) =>
        set({ width: Math.min(Math.max(width, 320), 720) }),
      setActiveChatId: (id: string | null) =>
        set({ activeChatId: id, isHistoryView: false }),
      toggleHistoryView: () =>
        set((state) => ({ isHistoryView: !state.isHistoryView })),
      setHistoryView: (open: boolean) => set({ isHistoryView: open }),
      setSelectedModel: (model: string) => set({ selectedModel: model }),
      setPendingPrompt: (prompt: PendingPromptData | null) =>
        set((state) => ({
          pendingPrompt: prompt,
          isOpen: prompt ? true : state.isOpen,
        })),
    }),
    {
      name: 'flux-ai-companion-storage',
      partialize: (state) => ({
        isOpen: state.isOpen,
        width: state.width,
        activeChatId: state.activeChatId,
        selectedModel: state.selectedModel,
      }),
    }
  )
);
