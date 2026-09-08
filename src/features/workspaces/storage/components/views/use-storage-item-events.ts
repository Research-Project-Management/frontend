'use client';

import { useState, useMemo, useCallback } from 'react';
import type { StorageItem, StorageViewProps } from '@/features/workspaces/storage/types/storage.types';
import { useStorageSelectionStore } from '../../store/use-selection-store';

export function useStorageItemEvents(props: StorageViewProps) {
  const {
    items,
    selectedItemId,
    highlightedItemId,
    isReadOnly,
    onFolderClick,
    onFileClick,
    onDragStartFile,
    onDropOnFolder,
  } = props;

  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const {
    selectedIds,
    toggleSelect,
    selectRange,
    selectAll,
    clearSelection,
    isAllSelected,
  } = useStorageSelectionStore();

  const allItemIds = useMemo(() => items.map((i) => i.id), [items]);
  const allSelected = isAllSelected(allItemIds);
  const hasSomeSelected = selectedIds.length > 0 && !allSelected;

  const handleHeaderCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (allSelected) {
        clearSelection();
      } else {
        selectAll(allItemIds);
      }
    },
    [allSelected, clearSelection, selectAll, allItemIds],
  );

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      if (e.shiftKey) {
        selectRange(allItemIds, itemId);
      } else {
        toggleSelect(itemId);
      }
    },
    [allItemIds, selectRange, toggleSelect],
  );

  const handleItemClick = useCallback(
    (e: React.MouseEvent, item: StorageItem) => {
      if (!isReadOnly && (e.shiftKey || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          selectRange(allItemIds, item.id);
        } else {
          toggleSelect(item.id);
        }
        return;
      }

      if (item.isFolder) {
        onFolderClick?.(item);
      } else {
        onFileClick?.(item);
      }
    },
    [isReadOnly, allItemIds, selectRange, toggleSelect, onFolderClick, onFileClick],
  );

  const getItemSelectionState = useCallback(
    (item: StorageItem) => {
      const isMultiSelected = selectedIds.includes(item.id);
      const isSingleSelected =
        selectedItemId === item.id || highlightedItemId === item.id;
      const isSelected = isMultiSelected || isSingleSelected;
      const isDragOver = dragOverFolderId === item.id;
      return { isMultiSelected, isSingleSelected, isSelected, isDragOver };
    },
    [selectedIds, selectedItemId, highlightedItemId, dragOverFolderId],
  );

  const getItemDragProps = useCallback(
    (item: StorageItem) => ({
      draggable: !isReadOnly && !item.isFolder && !!onDragStartFile,
      onDragStart: (e: any) => {
        if (!isReadOnly && !item.isFolder && onDragStartFile) {
          onDragStartFile(item, e);
        }
      },
      onDragOver: (e: React.DragEvent) => {
        if (!isReadOnly && item.isFolder && onDropOnFolder) {
          e.preventDefault();
          e.stopPropagation();
          setDragOverFolderId(item.id);
        }
      },
      onDragLeave: (e: React.DragEvent) => {
        if (isReadOnly) return;
        e.stopPropagation();
        setDragOverFolderId(null);
      },
      onDrop: (e: React.DragEvent) => {
        if (!isReadOnly && item.isFolder && onDropOnFolder) {
          setDragOverFolderId(null);
          onDropOnFolder(item, e);
        }
      },
    }),
    [isReadOnly, onDragStartFile, onDropOnFolder],
  );

  return {
    dragOverFolderId,
    selectedIds,
    allItemIds,
    allSelected,
    hasSomeSelected,
    handleHeaderCheckboxClick,
    handleCheckboxClick,
    handleItemClick,
    getItemSelectionState,
    getItemDragProps,
  };
}
