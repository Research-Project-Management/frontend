import { create } from 'zustand';
import type {
  StorageItem,
  StorageTypeFilter,
  StorageSortBy,
  StorageFilterState,
} from '../types/storage.types';

export type { StorageTypeFilter, StorageSortBy, StorageFilterState };

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

  // Duplicate Upload Prompt Modal
  duplicatePrompt: {
    file: File;
    resolve: (mode: 'replace' | 'keep-both' | 'cancel') => void;
  } | null;
  setDuplicatePrompt: (
    prompt: {
      file: File;
      resolve: (mode: 'replace' | 'keep-both' | 'cancel') => void;
    } | null,
  ) => void;
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
    useStorageSelectionStore.getState().clearSelection();
    set({
      activeSection: section,
      currentFolderId: section === 'my-files' ? folderId : null,
      highlightedItemId: highlightId,
    });
    syncUrl(buildStorageUrl(section, section === 'my-files' ? folderId : null, highlightId));
  },
  navigateToFolder: (folderId, highlightId = null) => {
    useStorageSelectionStore.getState().clearSelection();
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

  duplicatePrompt: null,
  setDuplicatePrompt: (prompt) => set({ duplicatePrompt: prompt }),
}));

// ============================================================================
// PREVIEW & VIEW STORES
// ============================================================================

interface PreviewStore {
  selectedItem: StorageItem | null;
  setSelectedItem: (item: StorageItem | null) => void;
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  selectedItem: null,
  setSelectedItem: (item) => set({ selectedItem: item }),
}));

interface ViewState {
  view: 'list' | 'grid';
  setView: (view: 'list' | 'grid') => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'list',
  setView: (view) => set({ view }),
}));

// ============================================================================
// FILTER & SELECTION STORES
// ============================================================================

export const useStorageFilterStore = create<StorageFilterState>((set, get) => ({
  selectedTypes: [],
  sortBy: 'date-desc',
  searchQuery: '',

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  toggleType: (type) => {
    const { selectedTypes } = get();
    if (type === 'all') {
      set({ selectedTypes: [] });
      return;
    }
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    set({ selectedTypes: next });
  },

  setSelectedTypes: (selectedTypes) => set({ selectedTypes }),

  setSortBy: (sortBy) => set({ sortBy }),

  resetFilters: () =>
    set({
      selectedTypes: [],
      sortBy: 'date-desc',
      searchQuery: '',
    }),

  isFilterActive: () => {
    const { selectedTypes, sortBy } = get();
    return selectedTypes.length > 0 || sortBy !== 'date-desc';
  },

  getActiveFilterCount: () => {
    const { selectedTypes, sortBy } = get();
    let count = selectedTypes.length;
    if (sortBy !== 'date-desc') {
      count += 1;
    }
    return count;
  },
}));

interface StorageSelectionState {
  selectedIds: string[];
  lastSelectedId: string | null;

  isSelected: (id: string) => boolean;
  isAllSelected: (allIds: string[]) => boolean;
  hasSelection: () => boolean;

  toggleSelect: (id: string) => void;
  selectOnly: (id: string) => void;
  selectRange: (allIds: string[], targetId: string) => void;
  selectAll: (allIds: string[]) => void;
  clearSelection: () => void;
  setSelectedIds: (ids: string[]) => void;
}

export const useStorageSelectionStore = create<StorageSelectionState>(
  (set, get) => ({
    selectedIds: [],
    lastSelectedId: null,

    isSelected: (id: string) => get().selectedIds.includes(id),

    isAllSelected: (allIds: string[]) => {
      if (allIds.length === 0) return false;
      const { selectedIds } = get();
      return allIds.every((id) => selectedIds.includes(id));
    },

    hasSelection: () => get().selectedIds.length > 0,

    toggleSelect: (id: string) => {
      const { selectedIds } = get();
      if (selectedIds.includes(id)) {
        set({
          selectedIds: selectedIds.filter((item) => item !== id),
          lastSelectedId: id,
        });
      } else {
        set({
          selectedIds: [...selectedIds, id],
          lastSelectedId: id,
        });
      }
    },

    selectOnly: (id: string) => {
      set({
        selectedIds: [id],
        lastSelectedId: id,
      });
    },

    selectRange: (allIds: string[], targetId: string) => {
      const { lastSelectedId, selectedIds } = get();
      if (
        !lastSelectedId ||
        !allIds.includes(lastSelectedId) ||
        !allIds.includes(targetId)
      ) {
        set({
          selectedIds: [targetId],
          lastSelectedId: targetId,
        });
        return;
      }

      const fromIndex = allIds.indexOf(lastSelectedId);
      const toIndex = allIds.indexOf(targetId);
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);

      const rangeIds = allIds.slice(start, end + 1);
      const merged = Array.from(new Set([...selectedIds, ...rangeIds]));

      set({
        selectedIds: merged,
        lastSelectedId: targetId,
      });
    },

    selectAll: (allIds: string[]) => {
      set({
        selectedIds: [...allIds],
        lastSelectedId: allIds[allIds.length - 1] || null,
      });
    },

    clearSelection: () => {
      set({
        selectedIds: [],
        lastSelectedId: null,
      });
    },

    setSelectedIds: (ids: string[]) => {
      set({
        selectedIds: ids,
        lastSelectedId: ids[ids.length - 1] || null,
      });
    },
  }),
);
