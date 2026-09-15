import React from 'react';
import type { StorageItem } from '../types/storage.types';

export function createFolderDropHandlers(
  folder: StorageItem,
  isReadOnly?: boolean,
  onDropOnFolder?: (folder: StorageItem, e: React.DragEvent) => void,
  setDragOverFolderId?: (id: string | null) => void,
) {
  return {
    onDragOver: (e: React.DragEvent) => {
      if (!isReadOnly && folder.isFolder && onDropOnFolder) {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId?.(folder.id);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      if (isReadOnly) return;
      e.stopPropagation();
      setDragOverFolderId?.(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!isReadOnly && folder.isFolder && onDropOnFolder) {
        setDragOverFolderId?.(null);
        onDropOnFolder(folder, e);
      }
    },
  };
}
