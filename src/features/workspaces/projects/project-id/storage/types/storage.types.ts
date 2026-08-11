import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';

export interface StorageResponse {
    files?: StorageItem[];
    project?: { _id: string; name: string };
    yourRole?: string;
    [key: string]: any;
}

export type { StorageItem };
