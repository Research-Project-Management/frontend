import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PendingComment = {
  startLine: number;
  endLine: number;
  selectedText: string;
};

type WorkspaceActionsState = {
  pendingComment: PendingComment | null;
  setPendingComment: (data: PendingComment) => void;
  clearPendingComment: () => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────
// Note: AI context state (pendingAiContext, pendingAiText) has been moved
// to features/chat-ai — it does not belong to the workspace domain.

export const useWorkspaceActionsStore = create<WorkspaceActionsState>(
  (set) => ({
    pendingComment: null,
    setPendingComment: (data) => set({ pendingComment: data }),
    clearPendingComment: () => set({ pendingComment: null }),
  }),
);
