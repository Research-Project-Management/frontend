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

export interface StorageFilterOptions {
  typeFilter?: StorageTypeFilter;
  selectedTypes?: StorageTypeFilter[];
  projectFilter?: StorageProjectFilter;
  selectedProjects?: string[];
  sortBy?: StorageSortBy;
  searchQuery?: string;
}

export interface StorageFilterState {
  typeFilter: StorageTypeFilter;
  selectedTypes: StorageTypeFilter[];
  projectFilter: StorageProjectFilter;
  selectedProjects: string[];
  sortBy: StorageSortBy;
  setTypeFilter: (type: StorageTypeFilter) => void;
  toggleType: (type: StorageTypeFilter) => void;
  setSelectedTypes: (types: StorageTypeFilter[]) => void;
  setProjectFilter: (project: StorageProjectFilter) => void;
  toggleProject: (project: string) => void;
  setSelectedProjects: (projects: string[]) => void;
  setSortBy: (sort: StorageSortBy) => void;
  resetFilters: () => void;
  isFilterActive: () => boolean;
  getActiveFilterCount: () => number;
}
