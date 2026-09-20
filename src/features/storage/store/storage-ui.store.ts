import { create } from 'zustand';
import type { StorageItem } from '../types/storage-item.types';

interface StorageUIState {
  // Create Folder Modal
  isCreateFolderOpen: boolean;
  openCreateFolderModal: () => void;
  closeCreateFolderModal: () => void;

  // Rename Modal
  renamingItem: StorageItem | null;
  openRenameModal: (item: StorageItem) => void;
  closeRenameModal: () => void;

  // Move Modal
  movingItems: StorageItem[];
  openMoveModal: (target: StorageItem[] | StorageItem) => void;
  closeMoveModal: () => void;

  // Upload Trigger
  uploadTriggerCount: number;
  triggerUpload: () => void;

  // Restore item trigger
  restoringItemId: string | null;
  setRestoringItemId: (id: string | null) => void;
}

export const useStorageUIStore = create<StorageUIState>((set) => ({
  isCreateFolderOpen: false,
  openCreateFolderModal: () => set({ isCreateFolderOpen: true }),
  closeCreateFolderModal: () => set({ isCreateFolderOpen: false }),

  renamingItem: null,
  openRenameModal: (item) => set({ renamingItem: item }),
  closeRenameModal: () => set({ renamingItem: null }),

  movingItems: [],
  openMoveModal: (target) =>
    set({
      movingItems: Array.isArray(target) ? target : [target],
    }),
  closeMoveModal: () => set({ movingItems: [] }),

  uploadTriggerCount: 0,
  triggerUpload: () => set((s) => ({ uploadTriggerCount: s.uploadTriggerCount + 1 })),

  restoringItemId: null,
  setRestoringItemId: (id) => set({ restoringItemId: id }),
}));
