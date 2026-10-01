import { create } from 'zustand';
import type { StorageItem } from '../types/storage-item.types';

export type StorageSection = 'home' | 'my-files' | 'shared' | 'starred' | 'trash';

export function buildStorageUrl(
  section: StorageSection,
  folderId?: string | null,
  highlightId?: string | null,
): string {
  const params = new URLSearchParams();
  if (section !== 'home') {
    params.set('view', section);
  }
  if (section === 'my-files' && folderId) {
    params.set('folder', folderId);
  }
  if (highlightId) {
    params.set('highlight', highlightId);
  }
  const qs = params.toString();
  return `/storage${qs ? `?${qs}` : ''}`;
}

export function syncUrl(url: string) {
  if (typeof window !== 'undefined') {
    const current = window.location.pathname + window.location.search;
    if (current !== url) {
      window.history.pushState(null, '', url);
    }
  }
}

interface StorageUIState {
  // Navigation & View State
  activeSection: StorageSection;
  setActiveSection: (section: StorageSection, sync?: boolean) => void;
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null, sync?: boolean) => void;
  highlightedItemId: string | null;
  setHighlightedItemId: (id: string | null, sync?: boolean) => void;
  navigateToSection: (section: StorageSection, folderId?: string | null, highlightId?: string | null) => void;
  navigateToFolder: (folderId: string | null, highlightId?: string | null) => void;

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

  // Version History Modal
  versionModalItem: StorageItem | null;
  openVersionModal: (item: StorageItem) => void;
  closeVersionModal: () => void;

  // Scientific Viewer Modal
  scientificViewerItem: StorageItem | null;
  openScientificViewer: (item: StorageItem) => void;
  closeScientificViewer: () => void;

  // Upload Trigger
  uploadTriggerCount: number;
  triggerUpload: () => void;

  // Restore item trigger
  restoringItemId: string | null;
  setRestoringItemId: (id: string | null) => void;
}

export const useStorageUIStore = create<StorageUIState>((set, get) => ({
  // Navigation & View State
  activeSection: 'home',
  setActiveSection: (section, shouldSync = true) => {
    set({ activeSection: section, currentFolderId: section === 'my-files' ? get().currentFolderId : null });
    if (shouldSync) {
      syncUrl(buildStorageUrl(section, section === 'my-files' ? get().currentFolderId : null, get().highlightedItemId));
    }
  },
  currentFolderId: null,
  setCurrentFolderId: (id, shouldSync = true) => {
    set({ currentFolderId: id });
    if (shouldSync) {
      syncUrl(buildStorageUrl(get().activeSection, id, get().highlightedItemId));
    }
  },
  highlightedItemId: null,
  setHighlightedItemId: (id, shouldSync = false) => {
    set({ highlightedItemId: id });
    if (shouldSync) {
      syncUrl(buildStorageUrl(get().activeSection, get().currentFolderId, id));
    }
  },
  navigateToSection: (section, folderId = null, highlightId = null) => {
    set({
      activeSection: section,
      currentFolderId: section === 'my-files' ? folderId : null,
      highlightedItemId: highlightId,
    });
    syncUrl(buildStorageUrl(section, section === 'my-files' ? folderId : null, highlightId));
  },
  navigateToFolder: (folderId, highlightId = null) => {
    set({
      activeSection: 'my-files',
      currentFolderId: folderId,
      highlightedItemId: highlightId,
    });
    syncUrl(buildStorageUrl('my-files', folderId, highlightId));
  },

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

  versionModalItem: null,
  openVersionModal: (item) => set({ versionModalItem: item }),
  closeVersionModal: () => set({ versionModalItem: null }),

  scientificViewerItem: null,
  openScientificViewer: (item) => set({ scientificViewerItem: item }),
  closeScientificViewer: () => set({ scientificViewerItem: null }),

  uploadTriggerCount: 0,
  triggerUpload: () => set((s) => ({ uploadTriggerCount: s.uploadTriggerCount + 1 })),

  restoringItemId: null,
  setRestoringItemId: (id) => set({ restoringItemId: id }),
}));

