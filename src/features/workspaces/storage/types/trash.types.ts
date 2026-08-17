import type { StorageItem } from './storage.types';

export interface TrashItemSummary {
  item: StorageItem;
  deletedAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

export interface TrashState {
  files: StorageItem[];
  selectedItemId: string | null;
  isLoading: boolean;
  isRestoring: boolean;
  isPurging: boolean;
}
