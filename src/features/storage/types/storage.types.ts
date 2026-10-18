import type React from 'react';

// ── Base Storage Entity Types ───────────────────────────────────────────────

export type FileType =
  | 'folder'
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'other';

export type StorageLevel = 'user' | 'project';

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
  metaData?: Record<string, unknown>;
  sharedWith?: Array<{
    id?: string;
    fileId?: string;
    userId?: string;
    permission: 'view' | 'edit';
    user?:
      | {
          id?: string;
          name?: string;
          email?: string;
          avatar?: string;
        }
      | string;
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
  projectId?: string;
  parentId?: string | null;
  pageId?: string | null;
  metaData?: Record<string, unknown>;
  onProgress?: (progress: number) => void;
};

export type CreateFileRecordParams = {
  projectId?: string;
  pageId?: string | null;
  filename: string;
  size: number;
  mimeType?: string;
  url: string;
  thumbnail?: string | null;
  metaData?: Record<string, unknown>;
  parentId?: string | null;
};

export type CreateFolderParams = {
  projectId?: string;
  parentId?: string | null;
  pageId?: string | null;
};

// ── Navigation & Breadcrumb Types ───────────────────────────────────────────
export interface BreadcrumbSegment {
  id: string | null;
  name: string;
}

// ── Filter & Sort Types ─────────────────────────────────────────────────────
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

// ── View Component Props ────────────────────────────────────────────────────
export type StorageViewProps = {
  items: StorageItem[];
  onToggleStar?: (fileId: string) => void | Promise<void>;
  onDelete: (fileId: string) => void | Promise<void>;
  onRestore?: (fileId: string) => void | Promise<void>;
  onDownload: (item: StorageItem) => void;
  onFolderClick?: (folder: StorageItem) => void;
  onFileClick?: (file: StorageItem) => void;
  isTrash?: boolean;
  selectedItemId?: string | null;
  highlightedItemId?: string | null;
  onDropOnFolder?: (folder: StorageItem, e: React.DragEvent) => void;
  onDragStartFile?: (item: StorageItem, e: React.DragEvent) => void;
  onMoveToParent?: (item: StorageItem) => void;
  onOpenLocation?: (item: StorageItem) => void;
  isReadOnly?: boolean;
};

