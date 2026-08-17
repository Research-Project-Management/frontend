import type { StorageItem } from './storage.types';

export type HomeFilterSortBy = 'recent' | 'name' | 'size' | 'type';

export interface HomeFilterOptions {
  searchQuery?: string;
  sortBy?: HomeFilterSortBy;
  fileType?: string;
}

export interface HomeState {
  files: StorageItem[];
  isLoading: boolean;
  searchQuery: string;
}
