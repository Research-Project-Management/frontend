import { create } from 'zustand';

export type StorageTypeFilter =
  | 'all'
  | 'folder'
  | 'document'
  | 'spreadsheet'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive';

export type StorageSortBy =
  | 'date-desc'
  | 'date-asc'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc';

export type StorageProjectFilter = 'all' | 'workspace-only' | string;

interface StorageFilterState {
  typeFilter: StorageTypeFilter;
  projectFilter: StorageProjectFilter;
  sortBy: StorageSortBy;
  setTypeFilter: (type: StorageTypeFilter) => void;
  setProjectFilter: (project: StorageProjectFilter) => void;
  setSortBy: (sort: StorageSortBy) => void;
  resetFilters: () => void;
  isFilterActive: () => boolean;
}

export const useStorageFilterStore = create<StorageFilterState>((set, get) => ({
  typeFilter: 'all',
  projectFilter: 'all',
  sortBy: 'date-desc',
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setProjectFilter: (projectFilter) => set({ projectFilter }),
  setSortBy: (sortBy) => set({ sortBy }),
  resetFilters: () => set({ typeFilter: 'all', projectFilter: 'all', sortBy: 'date-desc' }),
  isFilterActive: () => {
    const { typeFilter, projectFilter, sortBy } = get();
    return typeFilter !== 'all' || projectFilter !== 'all' || sortBy !== 'date-desc';
  },
}));
