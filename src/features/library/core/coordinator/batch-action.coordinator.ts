'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import {
  useBatchRestoreItemsMutation,
  useDeleteLibraryItemsMutation,
  useToggleStarItemMutation,
  useSetMyPublicationMutation,
} from '@/features/library/sdk/queries/catalog.queries';
import {
  useBatchDetachItemsMutation,
  useMoveCollectionItemsMutation,
  useAssignCollectionItemsMutation,
} from '@/features/library/sdk/queries/collections.queries';
import { useRetraction } from '@/features/library/sdk/queries/ingestion.queries';
import {
  useLibraryCommandStore,
  createTrashCommand,
  createRestoreCommand,
  createMoveItemsCommand,
  createBatchDetachCommand,
} from '@/features/library/core/manager/library-command.manager';
import { isItemRetracted } from '@/features/library/domain/retraction';
import type { Item, CslStyle } from '@/features/library/domain/types/library.types';
import {
  copyWithToastHelper,
  warnIfRetractedHelper,
  triggerBrowserTextDownload,
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
  executeDownloadBibFile,
} from './citation-export.coordinator';

export {
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
  enableKeydownListener?: boolean;
}

const EMPTY_ITEMS: Item[] = [];

function isProvisionalOrProcessingItem(item: Item & { _isProcessing?: boolean }): boolean {
  return (
    Boolean(item._isProcessing) ||
    item.id.startsWith('temp-') ||
    item.id.startsWith('provisional-')
  );
}

export function hasItemPdfOrAttachment(item: Item): boolean {
  return Boolean(
    item.hasFile ||
      (typeof item.attachmentCount === 'number' && item.attachmentCount > 0) ||
      item.fileUrl ||
      (Array.isArray(item.attachments) && item.attachments.length > 0),
  );
}

/**
 * Headless Coordinator for Library Selection and Batch Operations
 *
 * Centralizes:
 * 1. Multi-selection state management (select, deselect, range-select, select-all).
 * 2. Processing item guards (prevents moving/deleting provisional or actively uploading files).
 * 3. Retraction warnings when formatting or exporting citations.
 * 4. High-level page/view-aware batch business actions: move, delete, restore, detach, merge,
 *    star/unstar, my-publications, retraction scan/unflag, export, cite.
 * 5. Global Escape key handling for closing active selections.
 */
export function useLibraryBatchCoordinator({
  items = EMPTY_ITEMS,
  scopeId,
  collectionId,
  view,
  isTrash = false,
  canEdit = true,
  enableKeydownListener = true,
}: UseLibraryBatchCoordinatorOptions = {}) {
  const effectiveScope = scopeId || 'user';
  const effectiveIsTrash = isTrash || view === 'trash';
  const isDuplicatesView = view === 'duplicates';
  const isUnfiledView = view === 'unfiled';
  const isStarredView = view === 'starred';
  const isMyPublicationsView = view === 'my-publications' || view === 'publications';
  const isRetractedView = view === 'retracted';

  // Store Selection Actions
  const selectedIds = useLibraryUIStore((s) => s.selectedIds);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const selectAll = useLibraryUIStore((s) => s.selectAll);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const openModal = useLibraryUIStore((s) => s.openModal);

  // Batch Mutations
  const deleteMutation = useDeleteLibraryItemsMutation(effectiveScope);
  const restoreMutation = useBatchRestoreItemsMutation(effectiveScope);
  const batchDetachMutation = useBatchDetachItemsMutation(effectiveScope);
  const moveMutation = useMoveCollectionItemsMutation(effectiveScope);
  const assignMutation = useAssignCollectionItemsMutation(effectiveScope);
  const toggleStarMutation = useToggleStarItemMutation(effectiveScope);
  const setMyPublicationMutation = useSetMyPublicationMutation(effectiveScope);
  const {
    checkLibrary: checkRetractionLibrary,
    unflagItem: unflagRetractionItem,
    isCheckingLibrary: isCheckingRetraction,
    isUnflagging: isUnflaggingRetraction,
  } = useRetraction(effectiveScope, { includeItems: false });

  // Selected Items Resolution
  const selectedItems = useMemo(() => {
    if (selectedIds.size === 0) return EMPTY_ITEMS;
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  // Processing Guards
  const processingIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of selectedItems) {
      if (isProvisionalOrProcessingItem(item)) {
        set.add(item.id);
      }
    }
    for (const id of selectedIds) {
      if (id.startsWith('temp-') || id.startsWith('provisional-')) {
        set.add(id);
      }
    }
    return set;
  }, [selectedItems, selectedIds]);

  const isAllProcessingSelected =
    selectedCount > 0 && processingIds.size === selectedCount;

  // Retraction Warning
  const retractedSelected = useMemo(
    () => selectedItems.filter((i) => isItemRetracted(i)),
    [selectedItems],
  );

  // Selected Items with PDFs / Attachments
  const selectedWithAttachmentsCount = useMemo(
    () => selectedItems.filter((i) => !processingIds.has(i.id) && hasItemPdfOrAttachment(i)).length,
    [selectedItems, processingIds],
  );

  // Keyboard Shortcuts (Escape to clear)
  useEffect(() => {
    if (!enableKeydownListener || selectedCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (useLibraryUIStore.getState().activeModal !== null) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]') !== null)
      ) {
        return;
      }

      clearSelection();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeydownListener, selectedCount, clearSelection]);

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
      if (!canEdit || effectiveIsTrash || isDuplicatesView) return;
      if (isUnfiledView && targetCollectionId === null) return;

      const movableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
      if (processingIds.size > 0) {
        toast.warning('Cannot move files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      if (movableIds.length === 0) return;

      const previousCollectionsByItem = new Map<string, string[]>();
      for (const item of selectedItems) {
        if (movableIds.includes(item.id) && Array.isArray(item.collectionIds)) {
          previousCollectionsByItem.set(item.id, [...item.collectionIds]);
        }
      }

      try {
        await useLibraryCommandStore.getState().executeCommand(
          createMoveItemsCommand({
            itemIds: movableIds,
            sourceCollectionId: collectionId || null,
            targetCollectionId,
            previousCollectionsByItem,
            moveMutation,
            detachMutation: batchDetachMutation,
            assignMutation,
            scopeId: effectiveScope,
            onExecuted: () => {
              clearSelection();
            },
          }),
        );
      } catch {
        // Error toast handled by useLibraryCommandStore
      }
    },
    [
      canEdit,
      effectiveIsTrash,
      isDuplicatesView,
      isUnfiledView,
      selectedIds,
      selectedItems,
      processingIds,
      collectionId,
      moveMutation,
      batchDetachMutation,
      assignMutation,
      effectiveScope,
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

    if (effectiveIsTrash) {
      openModal('DELETE_CONFIRM', { itemIds: deletableIds, permanent: true });
      return;
    }
    openModal('DELETE_CONFIRM', { itemIds: deletableIds });
  }, [canEdit, selectedIds, processingIds, effectiveIsTrash, openModal]);

  // Action: Batch Restore from Trash
  const batchRestore = useCallback(async () => {
    if (!canEdit || !effectiveIsTrash) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await useLibraryCommandStore.getState().executeCommand(
      createRestoreCommand({
        itemIds: ids,
        restoreMutation: { mutateAsync: restoreMutation.mutateAsync },
        deleteMutation: { mutateAsync: deleteMutation.mutateAsync },
        onExecuted: () => {
          clearSelection();
        },
      }),
    );
  }, [canEdit, effectiveIsTrash, selectedIds, restoreMutation, deleteMutation, clearSelection]);

  // Action: Batch Detach from Collection
  const batchDetach = useCallback(
    async (targetColId?: string) => {
      const activeColId = targetColId || collectionId;
      if (!canEdit || effectiveIsTrash || !activeColId) return;

      const detachableIds = Array.from(selectedIds).filter((id) => !processingIds.has(id));
      if (processingIds.size > 0) {
        toast.warning('Cannot remove files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      if (detachableIds.length === 0) return;

      try {
        await useLibraryCommandStore.getState().executeCommand(
          createBatchDetachCommand({
            collectionId: activeColId,
            itemIds: detachableIds,
            detachMutation: batchDetachMutation,
            assignMutation,
            onExecuted: () => {
              clearSelection();
            },
          }),
        );
      } catch {
        // Error toast handled by useLibraryCommandStore
      }
    },
    [
      canEdit,
      effectiveIsTrash,
      collectionId,
      selectedIds,
      processingIds,
      batchDetachMutation,
      assignMutation,
      clearSelection,
    ],
  );

  // Action: Batch Merge Duplicates (Strictly available ONLY in Duplicates view)
  const batchMerge = useCallback(() => {
    if (!canEdit || !isDuplicatesView || selectedItems.length < 2) return;
    openModal('MERGE_DUPLICATES', {
      itemIds: Array.from(selectedIds),
      items: selectedItems,
      duplicates: selectedItems,
    });
  }, [canEdit, isDuplicatesView, selectedItems, openModal, selectedIds]);

  // Action: Batch Unstar Items (Contextual for Starred Items view)
  const batchUnstar = useCallback(async () => {
    if (!canEdit || effectiveIsTrash || !isStarredView) return;
    const ids = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) => toggleStarMutation.mutateAsync({ id, isStarred: false })),
      );
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [canEdit, effectiveIsTrash, isStarredView, selectedIds, processingIds, toggleStarMutation, clearSelection]);

  // Action: Batch Remove from My Publications (Contextual for My Publications view)
  const batchRemoveFromMyPublications = useCallback(async () => {
    if (!canEdit || effectiveIsTrash || !isMyPublicationsView) return;
    const ids = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((itemId) =>
          setMyPublicationMutation.mutateAsync({ itemId, isMyPublication: false }),
        ),
      );
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [
    canEdit,
    effectiveIsTrash,
    isMyPublicationsView,
    selectedIds,
    processingIds,
    setMyPublicationMutation,
    clearSelection,
  ]);

  // Action: Batch Re-check Retraction Status (Contextual for Retracted Items view)
  const batchRecheckRetraction = useCallback(async () => {
    if (!canEdit || effectiveIsTrash || !isRetractedView) return;
    const ids = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (ids.length === 0) return;
    try {
      await checkRetractionLibrary(ids);
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [canEdit, effectiveIsTrash, isRetractedView, selectedIds, processingIds, checkRetractionLibrary, clearSelection]);

  // Action: Batch Clear Retraction Flags (Contextual for Retracted Items view)
  const batchClearRetractionFlags = useCallback(async () => {
    if (!canEdit || effectiveIsTrash || !isRetractedView) return;
    const ids = Array.from(selectedIds).filter((id) => !processingIds.has(id));
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => unflagRetractionItem(id)));
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [canEdit, effectiveIsTrash, isRetractedView, selectedIds, processingIds, unflagRetractionItem, clearSelection]);

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
      selectedWithAttachmentsCount,

      // View / Page Context Flags
      view,
      isTrash: effectiveIsTrash,
      isDuplicatesView,
      isUnfiledView,
      isStarredView,
      isMyPublicationsView,
      isRetractedView,

      // Selection controls
      toggleSelect,
      selectOnly,
      selectAll,
      clearSelection,
      rangeSelect,

      // Page-Aware Batch Operations
      batchMove: canEdit && !effectiveIsTrash && !isDuplicatesView ? batchMove : undefined,
      batchDelete: canEdit ? batchDelete : undefined,
      batchRestore: canEdit && effectiveIsTrash ? batchRestore : undefined,
      batchDetach: canEdit && !effectiveIsTrash && Boolean(collectionId) ? batchDetach : undefined,
      batchMerge: canEdit && !effectiveIsTrash && isDuplicatesView ? batchMerge : undefined,
      batchUnstar: canEdit && !effectiveIsTrash && isStarredView ? batchUnstar : undefined,
      batchRemoveFromMyPublications:
        canEdit && !effectiveIsTrash && isMyPublicationsView
          ? batchRemoveFromMyPublications
          : undefined,
      batchRecheckRetraction:
        canEdit && !effectiveIsTrash && isRetractedView ? batchRecheckRetraction : undefined,
      batchClearRetractionFlags:
        canEdit && !effectiveIsTrash && isRetractedView ? batchClearRetractionFlags : undefined,
      isCheckingRetraction,
      isUnflaggingRetraction,
      copyMultiCite: !effectiveIsTrash ? copyMultiCite : undefined,
      copyInTextCite: !effectiveIsTrash ? copyInTextCite : undefined,
      exportAllBibtex: !effectiveIsTrash ? exportAllBibtex : undefined,
      downloadBibFile: !effectiveIsTrash ? downloadBibFile : undefined,
    }),
    [
      selectedIds,
      selectedItems,
      selectedCount,
      isAllSelected,
      processingIds,
      isAllProcessingSelected,
      retractedSelected,
      selectedWithAttachmentsCount,
      view,
      effectiveIsTrash,
      isDuplicatesView,
      isUnfiledView,
      isStarredView,
      isMyPublicationsView,
      isRetractedView,
      toggleSelect,
      selectOnly,
      selectAll,
      clearSelection,
      rangeSelect,
      canEdit,
      collectionId,
      batchMove,
      batchDelete,
      batchRestore,
      batchDetach,
      batchMerge,
      batchUnstar,
      batchRemoveFromMyPublications,
      batchRecheckRetraction,
      batchClearRetractionFlags,
      isCheckingRetraction,
      isUnflaggingRetraction,
      copyMultiCite,
      copyInTextCite,
      exportAllBibtex,
      downloadBibFile,
    ],
  );
}
