import type React from 'react';

// ── Base Storage Entity Types ───────────────────────────────────────────────

export type FileType =
  | 'folder'
  | 'document'
  | 'spreadsheet'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'other';

export type StorageItem = {
  id: string;
  filename: string;
  isFolder: boolean;
  size?: number;
  mimeType?: string;
  url?: string;
  thumbnail?: string | null;
  starred: boolean;
  parentId?: string | null;
  projectId?: string | null;
  trashedAt?: string | null;
  metaData?: Record<string, unknown>;
  author: {
    id?: string;
    name: string;
    email: string;
    avatar: string;
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
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
};

export type UploadFileParams = {
  projectId?: string;
  parentId?: string | null;
  pageId?: string | null;
  metaData?: Record<string, unknown>;
  onProgress?: (progress: number) => void;
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

export interface StorageFilterState {
  selectedTypes: StorageTypeFilter[];
  sortBy: StorageSortBy;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
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
  onOpenLocation?: (item: StorageItem) => void;
  isReadOnly?: boolean;
  hasMore?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
};
