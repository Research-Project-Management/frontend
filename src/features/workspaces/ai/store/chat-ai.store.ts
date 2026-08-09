import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiContext = {
  selectedText: string;
  startLine: number;
  endLine: number;
  filePath?: string;
};

type ChatAiActionsState = {
  /** Plain-text pre-fill for the AI input (legacy) */
  pendingAiText: string | null;
  setPendingAiText: (text: string | null) => void;

  /** Structured selection context from editor */
  pendingAiContext: AiContext | null;
  clearPendingAiContext: () => void;
  setPendingAiContext: (ctx: AiContext) => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChatAiActionsStore = create<ChatAiActionsState>((set) => ({
  pendingAiText: null,
  setPendingAiText: (text) => set({ pendingAiText: text }),

  pendingAiContext: null,
  setPendingAiContext: (ctx) => set({ pendingAiContext: ctx }),
  clearPendingAiContext: () => set({ pendingAiContext: null }),
}));
