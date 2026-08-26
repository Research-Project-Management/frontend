import { create } from 'zustand';
import type {
  StorageTypeFilter,
  StorageSortBy,
  StorageProjectFilter,
  StorageFilterState,
} from '../types/filter.types';

export type {
  StorageTypeFilter,
  StorageSortBy,
  StorageProjectFilter,
  StorageFilterState,
};

export const useStorageFilterStore = create<StorageFilterState>((set, get) => ({
  typeFilter: 'all',
  selectedTypes: [],
  projectFilter: 'all',
  selectedProjects: [],
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

  setProjectFilter: (projectFilter) =>
    set({
      projectFilter,
      selectedProjects: projectFilter === 'all' ? [] : [projectFilter],
    }),

  toggleProject: (projectId) => {
    const { selectedProjects } = get();
    if (projectId === 'all') {
      set({ selectedProjects: [], projectFilter: 'all' });
      return;
    }
    const next = selectedProjects.includes(projectId)
      ? selectedProjects.filter((id) => id !== projectId)
      : [...selectedProjects, projectId];
    set({
      selectedProjects: next,
      projectFilter: next.length === 1 ? next[0] : next.length === 0 ? 'all' : next[0],
    });
  },

  setSelectedProjects: (selectedProjects) =>
    set({
      selectedProjects,
      projectFilter: selectedProjects.length === 1 ? selectedProjects[0] : selectedProjects.length === 0 ? 'all' : selectedProjects[0],
    }),

  setSortBy: (sortBy) => set({ sortBy }),

  resetFilters: () =>
    set({
      typeFilter: 'all',
      selectedTypes: [],
      projectFilter: 'all',
      selectedProjects: [],
      sortBy: 'date-desc',
    }),

  isFilterActive: () => {
    const { selectedTypes, selectedProjects, sortBy, typeFilter, projectFilter } = get();
    const hasTypes = selectedTypes.length > 0 || typeFilter !== 'all';
    const hasProjects = selectedProjects.length > 0 || projectFilter !== 'all';
    const hasSort = sortBy !== 'date-desc';
    return hasTypes || hasProjects || hasSort;
  },

  getActiveFilterCount: () => {
    const { selectedTypes, selectedProjects, sortBy, typeFilter, projectFilter } = get();
    let count = 0;
    if (selectedTypes.length > 0) {
      count += selectedTypes.length;
    } else if (typeFilter !== 'all') {
      count += 1;
    }

    if (selectedProjects.length > 0) {
      count += selectedProjects.length;
    } else if (projectFilter !== 'all') {
      count += 1;
    }

    if (sortBy !== 'date-desc') {
      count += 1;
    }
    return count;
  },
}));
