import { create } from "zustand";

export interface PendingComment {
  startLine: number;
  endLine: number;
  selectedText: string;
}

/** Selection context passed from editor "Ask AI" action */
export interface PendingAiContext {
  /** The selected LaTeX text */
  selectedText: string;
  /** 1-based start line of the selection */
  startLine: number;
  /** 1-based end line of the selection */
  endLine: number;
  /** Optional user question to pre-fill (from context menu "Ask AI about this") */
  question?: string;
}

interface WorkspaceActionsState {
  pendingComment: PendingComment | null;
  /** Legacy: plain text to pre-fill in AI input */
  pendingAiText: string;
  /** Rich context: selected code + line info → triggers auto-send in ChatAiTab */
  pendingAiContext: PendingAiContext | null;
  setPendingComment: (data: PendingComment) => void;
  clearPendingComment: () => void;
  setPendingAiText: (text: string) => void;
  clearPendingAiText: () => void;
  setPendingAiContext: (ctx: PendingAiContext) => void;
  clearPendingAiContext: () => void;
}

export const useWorkspaceActionsStore = create<WorkspaceActionsState>((set) => ({
  pendingComment: null,
  pendingAiText: "",
  pendingAiContext: null,
  setPendingComment: (data) => set({ pendingComment: data }),
  clearPendingComment: () => set({ pendingComment: null }),
  setPendingAiText: (text) => set({ pendingAiText: text }),
  clearPendingAiText: () => set({ pendingAiText: "" }),
  setPendingAiContext: (ctx) => set({ pendingAiContext: ctx }),
  clearPendingAiContext: () => set({ pendingAiContext: null }),
}));
