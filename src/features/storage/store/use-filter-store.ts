import { create } from 'zustand';
import type {
  StorageTypeFilter,
  StorageSortBy,
  StorageFilterState,
} from '../types/filter.types';

export type {
  StorageTypeFilter,
  StorageSortBy,
  StorageFilterState,
};

export const useStorageFilterStore = create<StorageFilterState>((set, get) => ({
  typeFilter: 'all',
  selectedTypes: [],
  sortBy: 'date-desc',

  setTypeFilter: (typeFilter) =>
    set({
      typeFilter,
      selectedTypes: typeFilter === 'all' ? [] : [typeFilter],
    }),

  toggleType: (type) => {
    const { selectedTypes } = get();
    if (type === 'all') {
      set({ selectedTypes: [], typeFilter: 'all' });
      return;
    }
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
    set({
      selectedTypes: next,
      typeFilter: next.length === 1 ? next[0] : next.length === 0 ? 'all' : next[0],
    });
  },

  setSelectedTypes: (selectedTypes) =>
    set({
      selectedTypes,
      typeFilter: selectedTypes.length === 1 ? selectedTypes[0] : selectedTypes.length === 0 ? 'all' : selectedTypes[0],
    }),

  setSortBy: (sortBy) => set({ sortBy }),

  resetFilters: () =>
    set({
      typeFilter: 'all',
      selectedTypes: [],
      sortBy: 'date-desc',
    }),

  isFilterActive: () => {
    const { selectedTypes, sortBy, typeFilter } = get();
    const hasTypes = selectedTypes.length > 0 || typeFilter !== 'all';
    const hasSort = sortBy !== 'date-desc';
    return hasTypes || hasSort;
  },

  getActiveFilterCount: () => {
    const { selectedTypes, sortBy, typeFilter } = get();
    let count = 0;
    if (selectedTypes.length > 0) {
      count += selectedTypes.length;
    } else if (typeFilter !== 'all') {
      count += 1;
    }

    if (sortBy !== 'date-desc') {
      count += 1;
    }
    return count;
  },
}));
