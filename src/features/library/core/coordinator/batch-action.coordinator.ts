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
  createBatchAssignCommand,
} from '@/features/library/core/manager/library-command.manager';
import { isItemRetracted } from '@/features/library/domain/system-views.policy';
import { getAssignedCollectionIds } from '@/features/library/domain/metadata-mapper';
import {
  isPersistedItemId,
  isPersistedLibraryItem,
} from '@/features/library/domain/library-permissions.policy';
import type { Item, CslStyle } from '@/features/library/domain/types/core.types';
import { isEditableOrModalElementFocused } from './keyboard-shortcuts.coordinator';
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
  return !isPersistedLibraryItem(item);
}

export function hasItemPdfOrAttachment(item: Item): boolean {
  return Boolean(
    item.hasFile ||
      (typeof item.attachmentCount === 'number' && item.attachmentCount > 0) ||
      item.fileUrl ||
      (Array.isArray(item.attachments) && item.attachments.length > 0),
  );
}

export const BATCH_CAP_BIT = {
  MOVE: 1 << 0,
  DELETE: 1 << 1,
  RESTORE: 1 << 2,
  DETACH: 1 << 3,
  MERGE: 1 << 4,
  UNSTAR: 1 << 5,
  UNPUBLISH: 1 << 6,
  RETRACT_OPS: 1 << 7,
  CITE_EXPORT: 1 << 8,
} as const;

export function computeBatchCapabilityMask(params: {
  canEdit: boolean;
  isTrash: boolean;
  isDuplicatesView: boolean;
  isStarredView: boolean;
  isMyPublicationsView: boolean;
  isRetractedView: boolean;
  hasCollection: boolean;
}): number {
  const {
    canEdit,
    isTrash,
    isDuplicatesView,
    isStarredView,
    isMyPublicationsView,
    isRetractedView,
    hasCollection,
  } = params;

  let mask = !isTrash ? BATCH_CAP_BIT.CITE_EXPORT : 0;
  if (!canEdit) return mask;

  mask |= BATCH_CAP_BIT.DELETE;
  if (isTrash) {
    return mask | BATCH_CAP_BIT.RESTORE;
  }

  if (!isDuplicatesView) mask |= BATCH_CAP_BIT.MOVE;
  if (hasCollection) mask |= BATCH_CAP_BIT.DETACH;
  if (isDuplicatesView) mask |= BATCH_CAP_BIT.MERGE;
  if (isStarredView) mask |= BATCH_CAP_BIT.UNSTAR;
  if (isMyPublicationsView) mask |= BATCH_CAP_BIT.UNPUBLISH;
  if (isRetractedView) mask |= BATCH_CAP_BIT.RETRACT_OPS;

  return mask;
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
  const isMyPublicationsView = view === 'my-publications';
  const isRetractedView = view === 'retracted';

  const capabilityMask = useMemo(
    () =>
      computeBatchCapabilityMask({
        canEdit,
        isTrash: effectiveIsTrash,
        isDuplicatesView,
        isStarredView,
        isMyPublicationsView,
        isRetractedView,
        hasCollection: Boolean(collectionId),
      }),
    [
      canEdit,
      effectiveIsTrash,
      isDuplicatesView,
      isStarredView,
      isMyPublicationsView,
      isRetractedView,
      collectionId,
    ],
  );

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

  const selectedCount = selectedItems.length;
  const isAllSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  // Processing Guards & Set Difference A = (S ∩ V) \ P
  const processingIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of selectedItems) {
      if (isProvisionalOrProcessingItem(item)) {
        set.add(item.id);
      }
    }
    return set;
  }, [selectedItems]);

  const actionableItems = useMemo(
    () => selectedItems.filter((item) => !processingIds.has(item.id)),
    [selectedItems, processingIds],
  );

  const actionableIds = useMemo(
    () => actionableItems.map((item) => item.id).filter(Boolean),
    [actionableItems],
  );

  const isAllProcessingSelected =
    selectedCount > 0 && processingIds.size === selectedCount;

  // Retraction Warning
  const retractedSelected = useMemo(
    () => selectedItems.filter((i) => isItemRetracted(i)),
    [selectedItems],
  );

  // Selected Items with PDFs / Attachments
  const selectedItemsWithFilesIds = useMemo(
    () =>
      actionableItems
        .filter(hasItemPdfOrAttachment)
        .map((i) => i.id)
        .filter(Boolean),
    [actionableItems],
  );

  const selectedWithAttachmentsCount = selectedItemsWithFilesIds.length;

  // Keyboard Shortcuts (Escape to clear)
  useEffect(() => {
    if (!enableKeydownListener || selectedCount === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (isEditableOrModalElementFocused(e.target)) return;

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
      if (!(capabilityMask & BATCH_CAP_BIT.MOVE)) return;
      if (isUnfiledView && targetCollectionId === null) return;

      if (processingIds.size > 0) {
        toast.warning('Cannot move files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      if (actionableIds.length === 0) return;

      const previousCollectionsByItem = new Map<string, string[]>();
      for (const item of actionableItems) {
        const assigned = getAssignedCollectionIds(item);
        if (assigned.length > 0) {
          previousCollectionsByItem.set(item.id, assigned);
        }
      }

      try {
        await useLibraryCommandStore.getState().executeCommand(
          createMoveItemsCommand({
            itemIds: actionableIds,
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
      capabilityMask,
      isUnfiledView,
      actionableIds,
      actionableItems,
      processingIds.size,
      collectionId,
      moveMutation,
      batchDetachMutation,
      assignMutation,
      effectiveScope,
      clearSelection,
    ],
  );

  // Action: Batch Assign (Add) to Collection (preserves existing collection memberships)
  const batchAssign = useCallback(
    async (targetCollectionId: string, targetCollectionName?: string) => {
      if (!(capabilityMask & BATCH_CAP_BIT.MOVE) || !targetCollectionId) return;

      if (processingIds.size > 0) {
        toast.warning('Cannot add files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      if (actionableIds.length === 0) return;

      const alreadyAssignedItemIds = new Set<string>();
      for (const item of actionableItems) {
        const assigned = getAssignedCollectionIds(item);
        if (assigned.includes(targetCollectionId)) {
          alreadyAssignedItemIds.add(item.id);
        }
      }

      try {
        await useLibraryCommandStore.getState().executeCommand(
          createBatchAssignCommand({
            collectionId: targetCollectionId,
            collectionName: targetCollectionName,
            itemIds: actionableIds,
            alreadyAssignedItemIds,
            assignMutation,
            detachMutation: batchDetachMutation,
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
      capabilityMask,
      actionableIds,
      actionableItems,
      processingIds.size,
      assignMutation,
      batchDetachMutation,
      clearSelection,
    ],
  );

  // Action: Batch Delete Items
  const batchDelete = useCallback(() => {
    if (!(capabilityMask & BATCH_CAP_BIT.DELETE)) return;
    if (processingIds.size > 0) {
      toast.warning('Cannot delete files that are currently uploading or processing', {
        id: 'library-item-guard',
      });
    }
    if (actionableIds.length === 0) return;

    if (effectiveIsTrash) {
      openModal('DELETE_CONFIRM', { itemIds: actionableIds, permanent: true });
      return;
    }
    openModal('DELETE_CONFIRM', { itemIds: actionableIds });
  }, [capabilityMask, actionableIds, processingIds.size, effectiveIsTrash, openModal]);

  // Action: Batch Restore from Trash
  const batchRestore = useCallback(async () => {
    if (!(capabilityMask & BATCH_CAP_BIT.RESTORE)) return;
    if (actionableIds.length === 0) return;
    await useLibraryCommandStore.getState().executeCommand(
      createRestoreCommand({
        itemIds: actionableIds,
        restoreMutation: { mutateAsync: restoreMutation.mutateAsync },
        deleteMutation: { mutateAsync: deleteMutation.mutateAsync },
        onExecuted: () => {
          clearSelection();
        },
      }),
      { silentToast: true },
    );
  }, [capabilityMask, actionableIds, restoreMutation, deleteMutation, clearSelection]);

  // Action: Batch Detach from Collection
  const batchDetach = useCallback(
    async (targetColId?: string) => {
      const activeColId = targetColId || collectionId;
      if (!canEdit || effectiveIsTrash || !activeColId) return;

      if (processingIds.size > 0) {
        toast.warning('Cannot remove files that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      if (actionableIds.length === 0) return;

      try {
        await useLibraryCommandStore.getState().executeCommand(
          createBatchDetachCommand({
            collectionId: activeColId,
            itemIds: actionableIds,
            detachMutation: batchDetachMutation,
            assignMutation,
            onExecuted: () => {
              clearSelection();
            },
          }),
          { silentToast: true },
        );
      } catch {
        // Error toast handled by useLibraryCommandStore
      }
    },
    [
      canEdit,
      effectiveIsTrash,
      collectionId,
      actionableIds,
      processingIds.size,
      batchDetachMutation,
      assignMutation,
      clearSelection,
    ],
  );

  // Action: Batch Merge Duplicates (Strictly available ONLY in Duplicates view)
  const batchMerge = useCallback(() => {
    if (!(capabilityMask & BATCH_CAP_BIT.MERGE) || actionableItems.length < 2) return;
    openModal('MERGE_DUPLICATES', {
      itemIds: actionableIds,
      items: actionableItems,
      duplicates: actionableItems,
    });
  }, [capabilityMask, actionableItems, openModal, actionableIds]);

  // Action: Batch Unstar Items (Contextual for Starred Items view)
  const batchUnstar = useCallback(async () => {
    if (!(capabilityMask & BATCH_CAP_BIT.UNSTAR) || actionableIds.length === 0) return;
    try {
      await Promise.all(
        actionableIds.map((id) => toggleStarMutation.mutateAsync({ id, isStarred: false })),
      );
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [capabilityMask, actionableIds, toggleStarMutation, clearSelection]);

  // Action: Batch Remove from My Publications (Contextual for My Publications view)
  const batchRemoveFromMyPublications = useCallback(async () => {
    if (!(capabilityMask & BATCH_CAP_BIT.UNPUBLISH) || actionableIds.length === 0) return;
    try {
      await Promise.all(
        actionableIds.map((itemId) =>
          setMyPublicationMutation.mutateAsync({ itemId, isMyPublication: false }),
        ),
      );
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [capabilityMask, actionableIds, setMyPublicationMutation, clearSelection]);

  // Action: Batch Re-check Retraction Status (Contextual for Retracted Items view)
  const batchRecheckRetraction = useCallback(async () => {
    if (!(capabilityMask & BATCH_CAP_BIT.RETRACT_OPS) || actionableIds.length === 0) return;
    try {
      await checkRetractionLibrary(actionableIds);
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [capabilityMask, actionableIds, checkRetractionLibrary, clearSelection]);

  // Action: Batch Clear Retraction Flags (Contextual for Retracted Items view)
  const batchClearRetractionFlags = useCallback(async () => {
    if (!(capabilityMask & BATCH_CAP_BIT.RETRACT_OPS) || actionableIds.length === 0) return;
    try {
      await Promise.all(actionableIds.map((id) => unflagRetractionItem(id)));
      clearSelection();
    } catch {
      // Error toast handled by mutation
    }
  }, [capabilityMask, actionableIds, unflagRetractionItem, clearSelection]);

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
      actionableIds,
      actionableItems,
      selectedItemsWithFilesIds,
      selectedCount,
      isAllSelected,
      processingIds,
      isAllProcessingSelected,
      retractedSelected,
      selectedWithAttachmentsCount,
      capabilityMask,

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
      batchMove: capabilityMask & BATCH_CAP_BIT.MOVE ? batchMove : undefined,
      batchAssign: capabilityMask & BATCH_CAP_BIT.MOVE ? batchAssign : undefined,
      batchDelete: capabilityMask & BATCH_CAP_BIT.DELETE ? batchDelete : undefined,
      batchRestore: capabilityMask & BATCH_CAP_BIT.RESTORE ? batchRestore : undefined,
      batchDetach: capabilityMask & BATCH_CAP_BIT.DETACH ? batchDetach : undefined,
      batchMerge: capabilityMask & BATCH_CAP_BIT.MERGE ? batchMerge : undefined,
      batchUnstar: capabilityMask & BATCH_CAP_BIT.UNSTAR ? batchUnstar : undefined,
      batchRemoveFromMyPublications:
        capabilityMask & BATCH_CAP_BIT.UNPUBLISH ? batchRemoveFromMyPublications : undefined,
      batchRecheckRetraction:
        capabilityMask & BATCH_CAP_BIT.RETRACT_OPS ? batchRecheckRetraction : undefined,
      batchClearRetractionFlags:
        capabilityMask & BATCH_CAP_BIT.RETRACT_OPS ? batchClearRetractionFlags : undefined,
      isCheckingRetraction,
      isUnflaggingRetraction,
      copyMultiCite: capabilityMask & BATCH_CAP_BIT.CITE_EXPORT ? copyMultiCite : undefined,
      copyInTextCite: capabilityMask & BATCH_CAP_BIT.CITE_EXPORT ? copyInTextCite : undefined,
      exportAllBibtex: capabilityMask & BATCH_CAP_BIT.CITE_EXPORT ? exportAllBibtex : undefined,
      downloadBibFile: capabilityMask & BATCH_CAP_BIT.CITE_EXPORT ? downloadBibFile : undefined,
    }),
    [
      selectedIds,
      selectedItems,
      actionableIds,
      actionableItems,
      selectedItemsWithFilesIds,
      selectedCount,
      isAllSelected,
      processingIds,
      isAllProcessingSelected,
      retractedSelected,
      selectedWithAttachmentsCount,
      capabilityMask,
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
      batchMove,
      batchAssign,
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
