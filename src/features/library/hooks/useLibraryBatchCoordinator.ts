'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copyToClipboard } from '@/shared/lib/utils';
import { useLibraryUIStore } from '@/features/library/store/library-ui.store';
import {
  useBatchRestoreItemsMutation,
  useBatchDetachItemsMutation,
  CollectionsService,
  libraryServices,
  itemKeys,
  invalidateCollections,
} from '@/features/library/data';
import { generateCitationKey, toBibTeXEntry, formatCitation } from '@/features/library/domain/citations';
import { isItemRetracted } from '@/features/library/domain/retraction';
import type { Item, Collection, CslStyle } from '@/features/library/types/library.types';
import type { LibraryScope } from '@/features/library/types/core.types';

export interface UseLibraryBatchCoordinatorOptions {
  items?: Item[];
  scopeId?: string;
  collectionId?: string;
  view?: string;
  isTrash?: boolean;
  canEdit?: boolean;
}

// ── Shared Batch Citation & BibTeX Helpers ────────────────────────────────────

export function buildFallbackCitation(item: Item, style: CslStyle = 'apa'): string {
  return formatCitation(item, style);
}

export function buildFallbackBibtex(items: Item[]): string {
  const usedKeys = new Set<string>();
  return items
    .map((item) => {
      if (item.bibtex && item.bibtex.trim()) {
        return item.bibtex.trim();
      }
      const key = generateCitationKey(item, usedKeys);
      usedKeys.add(key);
      return toBibTeXEntry({
        ...item,
        title: item.title || 'Untitled',
        citationKey: item.citationKey || key,
      });
    })
    .filter(Boolean)
    .join('\n\n');
}

export async function copyWithToastHelper(
  text: string,
  label: string = 'Copied to clipboard',
) {
  if (!text || !text.trim()) {
    toast.error('Nothing to copy', { id: 'library-clipboard' });
    return;
  }
  const ok = await copyToClipboard(text);
  if (ok) {
    toast.success(label, { id: 'library-clipboard' });
  } else {
    toast.error('Failed to copy to clipboard', { id: 'library-clipboard' });
  }
}

export function warnIfRetractedHelper(
  retractedCount: number,
  totalSelectedCount: number,
  actionLabel: string,
) {
  if (retractedCount > 0) {
    toast.warning(
      `Retraction Alert: ${retractedCount} of ${totalSelectedCount} selected item(s) have been retracted!`,
      {
        description: `Proceeding with ${actionLabel}. Please verify validity before citing in your research.`,
        duration: 6000,
      },
    );
  }
}

export async function executeCopyMultiCite(
  items: Item[],
  scopeId: string,
  style: CslStyle | 'latex' = 'apa',
  retractedCount: number = 0,
) {
  warnIfRetractedHelper(retractedCount, items.length, 'citation formatting');
  if (style === 'latex') {
    const usedKeys = new Set<string>();
    const keys = items
      .map((p) => {
        const k = (p.citationKey || p.key || generateCitationKey(p, usedKeys))?.trim();
        if (k) usedKeys.add(k);
        return k;
      })
      .filter(Boolean);
    const citeCmd = `\\cite{${keys.join(', ')}}`;
    await copyWithToastHelper(citeCmd, `Copied ${citeCmd} to clipboard`);
    return;
  }

  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length > 0) {
    try {
      const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
      const text =
        res.bibliographyText ||
        res.citations
          .map((c) => c.citation?.bibliography)
          .filter(Boolean)
          .join('\n\n');
      if (text) {
        await copyWithToastHelper(
          text,
          `Copied ${itemIds.length} citations (${style.toUpperCase()}) to clipboard`,
        );
        return;
      }
    } catch {
      toast.error('Failed to format citation. Please try again.');
      return;
    }
  }
  toast.error('No valid items found to format citation.');
}

export async function executeCopyInTextCite(
  items: Item[],
  scopeId: string,
  style: CslStyle = 'apa',
  retractedCount: number = 0,
) {
  warnIfRetractedHelper(retractedCount, items.length, 'in-text citation');
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length > 0) {
    try {
      const res = await libraryServices.citations.batchFormat(scopeId, itemIds, style);
      const text =
        res.combinedInText ||
        res.citations.map((c) => c.citation?.inText).filter(Boolean).join('; ');
      if (text) {
        await copyWithToastHelper(text, `Copied in-text citation (${itemIds.length} items)`);
        return;
      }
    } catch {
      toast.error('Failed to format citation. Please try again.');
      return;
    }
  }
  toast.error('No valid items found to format citation.');
}

export async function executeExportAllBibtex(
  items: Item[],
  scopeId: string,
  selectedCount: number,
  retractedCount: number = 0,
) {
  warnIfRetractedHelper(retractedCount, items.length, 'BibTeX export');
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length === 0) return;

  try {
    const res = await libraryServices.exports.exportLibrary(scopeId, {
      format: 'bibtex',
      itemIds,
    });
    if (res?.content) {
      await copyWithToastHelper(
        res.content,
        `Copied BibTeX for ${selectedCount} reference(s) to clipboard`,
      );
      return;
    }
  } catch (err) {
    console.warn('Backend BibTeX export failed', err);
  }

  const fallbackBib = buildFallbackBibtex(items);
  if (fallbackBib) {
    await copyWithToastHelper(fallbackBib, `Copied BibTeX for ${selectedCount} reference(s) to clipboard`);
  } else {
    toast.error('Unable to export BibTeX for selected items', { id: 'library-clipboard' });
  }
}

export async function executeDownloadBibFile(
  items: Item[],
  scopeId: string,
  selectedCount: number,
  retractedCount: number = 0,
) {
  warnIfRetractedHelper(retractedCount, items.length, 'BibTeX download');
  const itemIds = items.map((p) => p.id).filter(Boolean);
  if (itemIds.length === 0) return;

  let bibtexContent: string | null = null;
  let downloadFilename = `references-selected-${selectedCount}.bib`;

  try {
    const res = await libraryServices.exports.exportLibrary(scopeId, {
      format: 'bibtex',
      itemIds,
    });
    if (res?.content) {
      bibtexContent = res.content;
      if (res.filename) downloadFilename = res.filename;
    }
  } catch (err) {
    console.warn('Backend BibTeX export failed', err);
  }

  if (!bibtexContent) {
    bibtexContent = buildFallbackBibtex(items) || null;
  }

  if (!bibtexContent) {
    toast.error('Unable to generate BibTeX file for download', { id: 'library-clipboard' });
    return;
  }

  const blob = new Blob([bibtexContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFilename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
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
  items = [],
  scopeId,
  collectionId,
  view,
  isTrash = false,
  canEdit = true,
}: UseLibraryBatchCoordinatorOptions = {}) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  // ── Store Selection Actions ──────────────────────────────────────────────────
  const selectedIds = useLibraryUIStore((s) => s.selectedIds);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const selectAll = useLibraryUIStore((s) => s.selectAll);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const openModal = useLibraryUIStore((s) => s.openModal);

  // ── Batch Mutations ──────────────────────────────────────────────────────────
  const restoreMutation = useBatchRestoreItemsMutation(effectiveScope);
  const batchDetachMutation = useBatchDetachItemsMutation(effectiveScope);

  // ── Selected Items Resolution ────────────────────────────────────────────────
  const selectedItems = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  const selectedCount = selectedIds.size;
  const isAllSelected = items.length > 0 && selectedCount === items.length;

  // ── Processing Guards ────────────────────────────────────────────────────────
  const processingIds = useMemo(
    () =>
      new Set(
        selectedItems
          .filter(
            (item: Item & { _isProcessing?: boolean }) =>
              Boolean(item._isProcessing) ||
              item.id.startsWith('temp-') ||
              item.id.startsWith('provisional-'),
          )
          .map((item) => item.id),
      ),
    [selectedItems],
  );

  const isAllProcessingSelected =
    selectedItems.length > 0 &&
    selectedItems.every(
      (item: Item & { _isProcessing?: boolean }) =>
        Boolean(item._isProcessing) ||
        item.id.startsWith('temp-') ||
        item.id.startsWith('provisional-'),
    );

  // ── Retraction Warning ───────────────────────────────────────────────────────
  const retractedSelected = useMemo(
    () => selectedItems.filter((i) => isItemRetracted(i)),
    [selectedItems],
  );

  // ── Keyboard Shortcuts (Escape to clear) ─────────────────────────────────────
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

  // ── Range Select (Shift + Click support) ──────────────────────────────────────
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

  // ── Action: Batch Move to Collection ─────────────────────────────────────────
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
          description: err instanceof Error ? err.message : 'Could not move documents to collection.',
          id: toastId,
        });
      }
    },
    [canEdit, isTrash, selectedIds, processingIds, effectiveScope, collectionId, queryClient, clearSelection],
  );

  // ── Action: Batch Delete Items ───────────────────────────────────────────────
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

  // ── Action: Batch Restore from Trash ─────────────────────────────────────────
  const batchRestore = useCallback(async () => {
    if (!canEdit || !isTrash) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await restoreMutation.mutateAsync(ids);
    clearSelection();
  }, [canEdit, isTrash, selectedIds, restoreMutation, clearSelection]);

  // ── Action: Batch Detach from Collection ─────────────────────────────────────
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
    [canEdit, isTrash, collectionId, selectedIds, processingIds, batchDetachMutation, clearSelection],
  );

  // ── Action: Batch Merge Duplicates ───────────────────────────────────────────
  const batchMerge = useCallback(() => {
    if (!canEdit || selectedItems.length < 2) return;
    openModal('MERGE_DUPLICATES', {
      itemIds: Array.from(selectedIds),
      items: selectedItems,
      duplicates: selectedItems,
    });
  }, [canEdit, selectedItems, openModal, selectedIds]);

  // ── Action: Copy Multi Citation ──────────────────────────────────────────────
  const copyMultiCite = useCallback(
    (style: CslStyle | 'latex' = 'apa') =>
      executeCopyMultiCite(selectedItems, effectiveScope, style, retractedSelected.length),
    [selectedItems, effectiveScope, retractedSelected.length],
  );

  // ── Action: Copy In-Text Citation ────────────────────────────────────────────
  const copyInTextCite = useCallback(
    (style: CslStyle = 'apa') =>
      executeCopyInTextCite(selectedItems, effectiveScope, style, retractedSelected.length),
    [selectedItems, effectiveScope, retractedSelected.length],
  );

  // ── Action: Export BibTeX to Clipboard ───────────────────────────────────────
  const exportAllBibtex = useCallback(
    () =>
      executeExportAllBibtex(selectedItems, effectiveScope, selectedCount, retractedSelected.length),
    [selectedItems, effectiveScope, selectedCount, retractedSelected.length],
  );

  // ── Action: Download BibTeX File ─────────────────────────────────────────────
  const downloadBibFile = useCallback(
    () =>
      executeDownloadBibFile(selectedItems, effectiveScope, selectedCount, retractedSelected.length),
    [selectedItems, effectiveScope, selectedCount, retractedSelected.length],
  );

  return {
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
  };
}
