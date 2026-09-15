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

export interface StorageFilterOptions {
  typeFilter?: StorageTypeFilter;
  selectedTypes?: StorageTypeFilter[];
  sortBy?: StorageSortBy;
  searchQuery?: string;
}

export interface StorageFilterState {
  typeFilter: StorageTypeFilter;
  selectedTypes: StorageTypeFilter[];
  sortBy: StorageSortBy;
  setTypeFilter: (type: StorageTypeFilter) => void;
  toggleType: (type: StorageTypeFilter) => void;
  setSelectedTypes: (types: StorageTypeFilter[]) => void;
  setSortBy: (sort: StorageSortBy) => void;
  resetFilters: () => void;
  isFilterActive: () => boolean;
  getActiveFilterCount: () => number;
}
