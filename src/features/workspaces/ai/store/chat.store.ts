import { create } from 'zustand';

export type AiContext = {
  selectedText: string;
  startLine: number;
  endLine: number;
  filePath?: string;
};

type ChatActionsState = {
  /** Plain-text pre-fill for the AI input */
  pendingAiText: string | null;
  setPendingAiText: (text: string | null) => void;

  /** Structured selection context from editor */
  pendingAiContext: AiContext | null;
  clearPendingAiContext: () => void;
  setPendingAiContext: (ctx: AiContext) => void;
};

export const useChatActionsStore = create<ChatActionsState>((set) => ({
  pendingAiText: null,
  setPendingAiText: (text) => set({ pendingAiText: text }),

  pendingAiContext: null,
  setPendingAiContext: (ctx) => set({ pendingAiContext: ctx }),
  clearPendingAiContext: () => set({ pendingAiContext: null }),
}));

// Backward compatibility alias
export const useChatAiActionsStore = useChatActionsStore;
