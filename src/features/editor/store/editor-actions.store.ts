import { create } from 'zustand';

export type PendingComment = {
  startLine: number;
  endLine: number;
  selectedText: string;
};

type EditorActionsState = {
  pendingComment: PendingComment | null;
  setPendingComment: (data: PendingComment) => void;
  clearPendingComment: () => void;
  
  pendingAiText: string | null;
  setPendingAiText: (text: string | null) => void;
  
  pendingAiContext: { selectedText: string; startLine: number; endLine: number; question?: string } | null;
  setPendingAiContext: (context: { selectedText: string; startLine: number; endLine: number; question?: string } | null) => void;
  clearPendingAiContext: () => void;
};

export const useEditorActionsStore = create<EditorActionsState>((set) => ({
  pendingComment: null,
  setPendingComment: (data) => set({ pendingComment: data }),
  clearPendingComment: () => set({ pendingComment: null }),
  
  pendingAiText: null,
  setPendingAiText: (text) => set({ pendingAiText: text }),
  
  pendingAiContext: null,
  setPendingAiContext: (context) => set({ pendingAiContext: context }),
  clearPendingAiContext: () => set({ pendingAiContext: null }),
}));
