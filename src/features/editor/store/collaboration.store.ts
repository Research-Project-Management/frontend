/**
 * collaboration.store.ts
 *
 * Store for editor-level collaboration UI interactions (e.g. pending inline comments, ephemeral selections).
 */

import { create } from 'zustand';

export interface PendingComment {
  startLine: number;
  endLine: number;
  selectedText: string;
}

export interface DocumentCollaborationState {
  pendingComment: PendingComment | null;
  setPendingComment: (data: PendingComment) => void;
  clearPendingComment: () => void;
}

export const useDocumentCollaborationStore = create<DocumentCollaborationState>((set) => ({
  pendingComment: null,
  setPendingComment: (data) => set({ pendingComment: data }),
  clearPendingComment: () => set({ pendingComment: null }),
}));

// Aliases for seamless backward compatibility
export const useActionsStore = useDocumentCollaborationStore;
export const useEditorActionsStore = useDocumentCollaborationStore;
export type ActionsState = DocumentCollaborationState;
