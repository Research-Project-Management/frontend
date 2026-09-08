import type { StorageItem } from '@/features/workspaces/storage/types/storage-item.types';

export type SharedPermission = 'view' | 'edit';

export interface SharedUser {
  user: string;
  permission: SharedPermission;
}

export interface SharedState {
  files: StorageItem[];
  selectedItemId: string | null;
  isLoading: boolean;
}
