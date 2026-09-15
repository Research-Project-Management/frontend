import { create } from 'zustand';

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

export const useStorageSelectionStore = create<StorageSelectionState>((set, get) => ({
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
    if (!lastSelectedId || !allIds.includes(lastSelectedId) || !allIds.includes(targetId)) {
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
}));
