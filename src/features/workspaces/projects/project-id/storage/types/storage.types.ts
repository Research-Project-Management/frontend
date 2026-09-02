export type {
  FileType,
  StorageLevel,
  StorageItem,
  StorageResponse,
  StorageUsageResponse,
} from '@/features/workspaces/storage/types/storage.types';

export type UploadFileParams = {
    projectId: string;
    parentId?: string | null;
    pageId?: string | null;
    metaData?: Record<string, any>;
    onProgress?: (progress: number) => void;
};

export type CreateFileRecordParams = {
    projectId: string;
    filename: string;
    size: number;
    mimeType: string;
    url: string;
    thumbnail?: string;
    metaData?: Record<string, any>;
    parentId?: string | null;
};

export type CreateFolderParams = {
    projectId: string;
    parentId?: string | null;
    pageId?: string | null;
};

// ── Re-export Page Sub-State Types ──────────────────────────────────────────
export * from './home.types';
export * from './my-files.types';
export * from './shared.types';
export * from './starred.types';
export * from './trash.types';
export * from './preview.types';
