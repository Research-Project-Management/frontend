import type React from 'react';
import type { StorageItem } from './storage-item.types';

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
