import type { StorageItem } from '@/features/workspaces/storage/types/storage-item.types';

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
