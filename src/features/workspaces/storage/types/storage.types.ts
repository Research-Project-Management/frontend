export type FileType = "folder" | "document" | "image" | "video" | "audio" | "archive" | "other";

export type StorageLevel = "workspace" | "project";

export type StorageItem = {
    _id: string;
    filename: string;
    isFolder: boolean;
    size?: number;
    mimeType?: string;
    url?: string;
    thumbnail?: string;
    starred: boolean;
    metaData?: Record<string, any>;
    sharedWith?: Array<{
        user: string;
        permission: 'view' | 'edit';
    }>;
    author: {
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
        _id: string;
        name: string;
    };
    createdAt: string;
    updatedAt: string;
};

export type StorageResponse = {
    files?: StorageItem[];
    project?: { _id: string; name: string };
    yourRole?: string;
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


