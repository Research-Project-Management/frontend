export type FileType = "folder" | "document" | "image" | "video" | "audio" | "archive" | "other";

export type StorageLevel = "workspace" | "project";

export type StorageItem = {
    id: string;
    filename: string;
    /** Alias for filename compatibility */
    name?: string;
    isFolder: boolean;
    size?: number;
    mimeType?: string;
    url?: string;
    thumbnail?: string;
    starred: boolean;
    /** Alias for starred compatibility */
    isStarred?: boolean;
    parentId?: string | null;
    parent?: string | null;
    trashedAt?: string | null;
    metaData?: Record<string, any>;
    sharedWith?: Array<{
        id?: string;
        fileId?: string;
        userId?: string;
        permission: 'view' | 'edit';
        user?: {
            id?: string;
            name?: string;
            email?: string;
            avatar?: string;
        } | string;
    }>;
    author: {
        id?: string;
        name: string;
        email: string;
        avatar: string;
    };
    /** Present when the file belongs to a project (linkedTo.entityType = 'Project') */
    linkedTo?: {
        entityType: 'Project' | 'Page' | null;
        entityId: string | null;
    };
    project?: {
        id: string;
        name: string;
    };
    createdAt: string;
    updatedAt: string;
};

export type StorageResponse = {
    files?: StorageItem[];
    project?: { id: string; name: string };
    yourRole?: string;
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
};

export type StorageUsageResponse = {
    totalBytes: number;
};

export type UploadFileParams = {
    workspaceId: string;
    parentId?: string | null;
    pageId?: string | null;
    metaData?: Record<string, any>;
    onProgress?: (progress: number) => void;
};

export type CreateFileRecordParams = {
    workspaceId: string;
    filename: string;
    size: number;
    mimeType: string;
    url: string;
    thumbnail?: string;
    metaData?: Record<string, any>;
    parentId?: string | null;
};

export type CreateFolderParams = {
    workspaceId: string;
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
