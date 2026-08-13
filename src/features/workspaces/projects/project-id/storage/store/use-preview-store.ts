import { create } from 'zustand';
import type { StorageItem } from '@/features/workspaces/projects/project-id/storage/types/storage.types';

interface PreviewStore {
  selectedItem: StorageItem | null;
  setSelectedItem: (item: StorageItem | null) => void;
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  selectedItem: null,
  setSelectedItem: (item) => set({ selectedItem: item }),
}));
