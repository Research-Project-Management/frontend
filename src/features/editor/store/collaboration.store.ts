/**
 * collaboration.store.ts
 *
 * Store for editor-level collaboration UI interactions (pending inline comments,
 * active collaborator presence list, cursor broadcasts, and unread chats).
 */

import { create } from 'zustand';

export interface PendingComment {
  startLine: number;
  endLine: number;
  selectedText: string;
}

export interface CollaboratorPresenceInfo {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  color: string;
  isOnline: boolean;
  activeFile?: string;
  activeFileId?: string;
  cursor?: {
    line: number;
    column: number;
    selection?: {
      startLineNumber: number;
      startColumn?: number;
      endLineNumber: number;
      endColumn?: number;
    };
  };
  lastActiveAt?: number;
}

export interface DocumentCollaborationState {
  pendingComment: PendingComment | null;
  setPendingComment: (data: PendingComment) => void;
  clearPendingComment: () => void;
  unreadChatCount: number;
  incrementUnreadChatCount: () => void;
  resetUnreadChatCount: () => void;

  // Collaborator Presence
  collaborators: CollaboratorPresenceInfo[];
  setCollaborators: (collaborators: CollaboratorPresenceInfo[]) => void;
  updateCollaborator: (collaborator: Partial<CollaboratorPresenceInfo> & { id: string }) => void;
  removeCollaborator: (id: string) => void;
  clearCollaborators: () => void;
}

export const useDocumentCollaborationStore = create<DocumentCollaborationState>((set) => ({
  pendingComment: null,
  setPendingComment: (data) => set({ pendingComment: data }),
  clearPendingComment: () => set({ pendingComment: null }),
  unreadChatCount: 0,
  incrementUnreadChatCount: () => set((state) => ({ unreadChatCount: state.unreadChatCount + 1 })),
  resetUnreadChatCount: () => set({ unreadChatCount: 0 }),

  collaborators: [],
  setCollaborators: (collaborators) => set({ collaborators }),
  updateCollaborator: (collaborator) =>
    set((state) => {
      const idx = state.collaborators.findIndex((c) => c.id === collaborator.id);
      if (idx >= 0) {
        const next = [...state.collaborators];
        next[idx] = { ...next[idx], ...collaborator };
        return { collaborators: next };
      }
      return {
        collaborators: [
          ...state.collaborators,
          {
            name: 'Collaborator',
            color: '#3b82f6',
            isOnline: true,
            ...collaborator,
          } as CollaboratorPresenceInfo,
        ],
      };
    }),
  removeCollaborator: (id) =>
    set((state) => ({
      collaborators: state.collaborators.filter((c) => c.id !== id),
    })),
  clearCollaborators: () => set({ collaborators: [] }),
}));

// Aliases for seamless backward compatibility
export const useActionsStore = useDocumentCollaborationStore;
export const useEditorActionsStore = useDocumentCollaborationStore;
export const useCollaborationStore = useDocumentCollaborationStore;
export const useCollaborationPresenceStore = useDocumentCollaborationStore;
export type ActionsState = DocumentCollaborationState;
