import type { StorageItem } from './storage.types';

export interface BreadcrumbSegment {
  _id: string | null;
  name: string;
}

export interface MyFilesState {
  currentFolder: string | null;
  breadcrumbs: BreadcrumbSegment[];
  draggingItem: StorageItem | null;
  selectedItemId: string | null;
  isLoading: boolean;
}

export interface FolderNavigationState {
  folderId: string | null;
  folderName: string;
  parentFolderId?: string | null;
}
