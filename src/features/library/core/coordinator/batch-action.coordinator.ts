'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { CollectionsService } from '@/features/library/sdk/library.client';
import { useBatchRestoreItemsMutation } from '@/features/library/sdk/queries/catalog.queries';
import { useBatchDetachItemsMutation } from '@/features/library/sdk/queries/collections.queries';
import { itemKeys } from '@/features/library/sdk/query-keys';
import { invalidateCollections } from '@/features/library/sdk/queries/collections.queries';
import { isItemRetracted } from '@/features/library/domain/retraction';
import type { Item, CslStyle } from '@/features/library/domain/types/library.types';
import {
  buildFallbackCitation,
  buildFallbackBibtex,
  copyWithToastHelper,
  warnIfRetractedHelper,
  triggerBrowserTextDownload,
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
  executeDownloadBibFile,
} from './citation-export.coordinator';

export {
  buildFallbackCitation,
  buildFallbackBibtex,
  copyWithToastHelper,
  warnIfRetractedHelper,
  triggerBrowserTextDownload,
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
  executeDownloadBibFile,
};

export interface UseLibraryBatchCoordinatorOptions {
  items?: Item[];
  scopeId?: string;
  collectionId?: string;
  view?: string;
  isTrash?: boolean;
  canEdit?: boolean;
}

const EMPTY_ITEMS: Item[] = [];

function isProvisionalOrProcessingItem(item: Item & { _isProcessing?: boolean }): boolean {
  return (
    Boolean(item._isProcessing) ||
    item.id.startsWith('temp-') ||
    item.id.startsWith('provisional-')
  );
}

/**
 * Headless Coordinator for Library Selection and Batch Operations
 *
 * Centralizes:
 * 1. Multi-selection state management (select, deselect, range-select, select-all).
 * 2. Processing item guards (prevents moving/deleting provisional or actively uploading files).
 * 3. Retraction warnings when formatting or exporting citations.
 * 4. High-level batch business actions: move, delete, restore, detach, merge, export, cite.
 * 5. Global Escape key handling for closing active selections.
 */
export function useLibraryBatchCoordinator({
  items = EMPTY_ITEMS,
  scopeId,
  collectionId,
  isTrash = false,
  canEdit = true,
}: UseLibraryBatchCoordinatorOptions = {}) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  // Store Selection Actions
  const selectedIds = useLibraryUIStore((s) => s.selectedIds);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const selectAll = useLibraryUIStore((s) => s.selectAll);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const openModal = useLibraryUIStore((s) => s.openModal);

  // Batch Mutations
  const restoreMutation = useBatchRestoreItemsMutation(effectiveScope);
  const batchDetachMutation = useBatchDetachItemsMutation(effectiveScope);

  // Selected Items Resolution
  const selectedItems = useMemo(() => {
    if (selectedIds.size === 0) return EMPTY_ITEMS;
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  // Processing Guards
  const processingIds = useMemo(
    () =>
      new Set(
        selectedItems
          .filter(isProvisionalOrProcessingItem)
          .map((item) => item.id),
      ),
    [selectedItems],
  );

  const isAllProcessingSelected =
    selectedItems.length > 0 && selectedItems.every(isProvisionalOrProcessingItem);

  // Retraction Warning
  const retractedSelected = useMemo(
    () => selectedItems.filter((i) => isItemRetracted(i)),
    [selectedItems],
  );

  // Keyboard Shortcuts (Escape to clear)
  useEffect(() => {
    if (selectedCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCount, clearSelection]);

  // Range Select (Shift + Click support)
  const rangeSelect = useCallback(
    (fromId: string, toId: string, orderedIds: string[]) => {
      const fromIdx = orderedIds.indexOf(fromId);
      const toIdx = orderedIds.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return;

      const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      const slice = orderedIds.slice(start, end + 1);
      selectAll(slice);
    },
    [selectAll],
  );

  // Action: Batch Move to Collection
  const batchMove = useCallback(
    async (targetCollectionId: string | null) => {
      if (!canEdit || isTrash) return;
      const movableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
      if (processingIds.size > 0) {
        toast.warning('Cannot move files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      if (movableIds.length === 0) return;

      const toastId = toast.loading(`Moving ${movableIds.length} item(s)...`, { id: 'batch-move' });
      try {
        await CollectionsService.moveItems(
          effectiveScope,
          targetCollectionId || 'unfiled',
          movableIds,
        );
        queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
        if (targetCollectionId) {
          queryClient.invalidateQueries({
            queryKey: itemKeys.byCollection(effectiveScope, targetCollectionId),
          });
        }
        if (collectionId) {
          queryClient.invalidateQueries({
            queryKey: itemKeys.byCollection(effectiveScope, collectionId),
          });
        }
        invalidateCollections(queryClient, effectiveScope);
        toast.success(`Moved ${movableIds.length} item(s)`, { id: toastId });
        clearSelection();
      } catch (err: unknown) {
        toast.error('Failed to move items', {
          description:
            err instanceof Error ? err.message : 'Could not move documents to collection.',
          id: toastId,
        });
      }
    },
    [
      canEdit,
      isTrash,
      selectedIds,
      processingIds,
      effectiveScope,
      collectionId,
      queryClient,
      clearSelection,
    ],
  );

  // Action: Batch Delete Items
  const batchDelete = useCallback(() => {
    if (!canEdit) return;
    const deletableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (processingIds.size > 0) {
      toast.warning('Cannot delete files that are currently uploading or processing', {
        id: 'library-item-guard',
      });
    }
    if (deletableIds.length === 0) return;

    if (isTrash) {
      openModal('DELETE_ITEMS', { itemIds: deletableIds, permanent: true });
      return;
    }
    openModal('DELETE_ITEMS', { itemIds: deletableIds });
  }, [canEdit, selectedIds, processingIds, isTrash, openModal]);

  // Action: Batch Restore from Trash
  const batchRestore = useCallback(async () => {
    if (!canEdit || !isTrash) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await restoreMutation.mutateAsync(ids);
    clearSelection();
  }, [canEdit, isTrash, selectedIds, restoreMutation, clearSelection]);

  // Action: Batch Detach from Collection
  const batchDetach = useCallback(
    async (targetColId?: string) => {
      const activeColId = targetColId || collectionId;
      if (!canEdit || isTrash || !activeColId) return;

      const detachableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
      if (processingIds.size > 0) {
        toast.warning('Cannot remove files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      if (detachableIds.length === 0) return;

      await batchDetachMutation.mutateAsync({
        collectionId: activeColId,
        itemIds: detachableIds,
      });
      clearSelection();
    },
    [
      canEdit,
      isTrash,
      collectionId,
      selectedIds,
      processingIds,
      batchDetachMutation,
      clearSelection,
    ],
  );

  // Action: Batch Merge Duplicates
  const batchMerge = useCallback(() => {
    if (!canEdit || selectedItems.length < 2) return;
    openModal('MERGE_DUPLICATES', {
      itemIds: Array.from(selectedIds),
      items: selectedItems,
      duplicates: selectedItems,
    });
  }, [canEdit, selectedItems, openModal, selectedIds]);

  // Action: Copy Multi Citation
  const copyMultiCite = useCallback(
    (style: CslStyle | 'latex' = 'apa') =>
      executeCopyMultiCite(selectedItems, effectiveScope, style, retractedSelected.length),
    [selectedItems, effectiveScope, retractedSelected.length],
  );

  // Action: Copy In-Text Citation
  const copyInTextCite = useCallback(
    (style: CslStyle = 'apa') =>
      executeCopyInTextCite(selectedItems, effectiveScope, style, retractedSelected.length),
    [selectedItems, effectiveScope, retractedSelected.length],
  );

  // Action: Export BibTeX to Clipboard
  const exportAllBibtex = useCallback(
    () =>
      executeExportAllBibtex(
        selectedItems,
        effectiveScope,
        selectedCount,
        retractedSelected.length,
      ),
    [selectedItems, effectiveScope, selectedCount, retractedSelected.length],
  );

  // Action: Download BibTeX File
  const downloadBibFile = useCallback(
    () =>
      executeDownloadBibFile(
        selectedItems,
        effectiveScope,
        selectedCount,
        retractedSelected.length,
      ),
    [selectedItems, effectiveScope, selectedCount, retractedSelected.length],
  );

  return useMemo(
    () => ({
      // Selection state
      selectedIds,
      selectedItems,
      selectedCount,
      isAllSelected,
      processingIds,
      isAllProcessingSelected,
      retractedSelected,

      // Selection controls
      toggleSelect,
      selectOnly,
      selectAll,
      clearSelection,
      rangeSelect,

      // Batch operations
      batchMove,
      batchDelete,
      batchRestore,
      batchDetach,
      batchMerge,
      copyMultiCite,
      copyInTextCite,
      exportAllBibtex,
      downloadBibFile,
    }),
    [
      selectedIds,
      selectedItems,
      selectedCount,
      isAllSelected,
      processingIds,
      isAllProcessingSelected,
      retractedSelected,
      toggleSelect,
      selectOnly,
      selectAll,
      clearSelection,
      rangeSelect,
      batchMove,
      batchDelete,
      batchRestore,
      batchDetach,
      batchMerge,
      copyMultiCite,
      copyInTextCite,
      exportAllBibtex,
      downloadBibFile,
    ],
  );
}
