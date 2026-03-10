import { create } from "zustand";

export interface PendingComment {
  startLine: number;
  endLine: number;
  selectedText: string;
}

interface WorkspaceActionsState {
  pendingComment: PendingComment | null;
  pendingAiText: string;
  setPendingComment: (data: PendingComment) => void;
  clearPendingComment: () => void;
  setPendingAiText: (text: string) => void;
  clearPendingAiText: () => void;
}

export const useWorkspaceActionsStore = create<WorkspaceActionsState>((set) => ({
  pendingComment: null,
  pendingAiText: "",
  setPendingComment: (data) => set({ pendingComment: data }),
  clearPendingComment: () => set({ pendingComment: null }),
  setPendingAiText: (text) => set({ pendingAiText: text }),
  clearPendingAiText: () => set({ pendingAiText: "" }),
}));
