import type { StorageItem } from './storage.types';

export type StarredSortBy = 'name' | 'date' | 'size' | 'type';

export interface StarredFilterOptions {
  searchQuery?: string;
  sortBy?: StarredSortBy;
}

export interface StarredState {
  files: StorageItem[];
  selectedItemId: string | null;
  isLoading: boolean;
}
