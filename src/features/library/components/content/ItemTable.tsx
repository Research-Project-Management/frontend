'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { useLibraryUIStore } from '../../store/library-ui.store';
import {
  useToggleStarItemMutation,
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useCollectionsQuery,
  libraryServices,
  itemKeys,
  invalidateCollections,
} from '../../data';
import {
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  type LibraryDisplayOptions,
  type LibraryOrderBy,
} from '../topbar/LibraryDisplayPopover';
import { sortLibraryItems } from '../../utils/sort-items';
import { ItemTableHeader } from './ItemTableHeader';
import { ItemTableRow } from './ItemTableRow';
import type { Item } from '../../types/library.types';

export interface ItemTableProps {
  items: Item[];
  totalCount?: number;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  displayOptions?: LibraryDisplayOptions;
  isTrash?: boolean;
  scopeId?: string;
  collectionId?: string;
  onRestoreItems?: (ids: string[]) => void;
  onPermanentDeleteItems?: (ids: string[]) => void;
  onMoveToCollection?: (itemId: string, collectionId: string) => void;
  onDetachItem?: (id: string) => void;
  onSortChange?: (columnKey: string, direction: 'asc' | 'desc') => void;
}

/**
 * ItemTable - High-Performance Table Container
 *
 * Decomposed into modular components:
 * - ItemTableHeader: Pure header and sort controls
 * - ItemTableRow: Memoized row listening to granular boolean selectors
 * - ItemContextMenu: Isolated context menu portal
 */
export const ItemTable = React.memo(function ItemTable({
  items,
  totalCount,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  displayOptions: propDisplayOptions,
  isTrash = false,
  scopeId,
  collectionId,
  onRestoreItems,
  onPermanentDeleteItems,
  onMoveToCollection: propOnMoveToCollection,
  onDetachItem,
  onSortChange,
}: ItemTableProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Store actions
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const selectAll = useLibraryUIStore((s) => s.selectAll);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const storeDisplayOptions = useLibraryUIStore((s) => s.displayOptions);
  const setStoreDisplayOptions = useLibraryUIStore((s) => s.setDisplayOptions);

  // Granular Boolean Selector: Does NOT re-render ItemTable when selectedIds count increments (O(1) row isolation)
  const isAllSelected = useLibraryUIStore(
    useCallback(
      (s) => items.length > 0 && s.selectedIds.size === items.length,
      [items.length],
    ),
  );

  const displayOptions =
    propDisplayOptions ?? storeDisplayOptions ?? DEFAULT_LIBRARY_DISPLAY_OPTIONS;

  // Mutations & Queries
  const toggleStarMutation = useToggleStarItemMutation(scopeId);
  const deleteMutation = useDeleteLibraryItemsMutation(scopeId);
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const purgeMutation = useBatchPurgeItemsMutation(scopeId);
  const { data: collections = [] } = useCollectionsQuery(scopeId);

  const handleMoveToCollection = useCallback(
    async (itemId: string, targetCollectionId: string) => {
      if (propOnMoveToCollection) {
        propOnMoveToCollection(itemId, targetCollectionId);
        return;
      }
      const toastId = toast.loading('Moving reference...', { id: 'move-doc' });
      try {
        await libraryServices.collections.moveItems(scopeId, targetCollectionId, [itemId]);
        queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
        queryClient.invalidateQueries({ queryKey: itemKeys.byCollection(scopeId, targetCollectionId) });
        invalidateCollections(queryClient, scopeId);
        toast.success('Reference moved', {
          description: 'Reference successfully moved to collection.',
          id: toastId,
        });
      } catch (err: unknown) {
        toast.error('Failed to move reference', {
          description: err instanceof Error ? err.message : 'Could not move document to collection.',
          id: toastId,
        });
      }
    },
    [propOnMoveToCollection, scopeId, queryClient],
  );

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(
    displayOptions?.orderBy || 'year',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    displayOptions?.orderDirection || 'desc',
  );

  // Synchronize internal sort with displayOptions when updated from Topbar Popover
  React.useEffect(() => {
    if (displayOptions?.orderBy) {
      setSortColumn(displayOptions.orderBy);
    }
    if (displayOptions?.orderDirection) {
      setSortDirection(displayOptions.orderDirection);
    }
  }, [displayOptions?.orderBy, displayOptions?.orderDirection]);

  // Track last selected index for Shift + Click range selection
  const lastSelectedIndexRef = useRef<number | null>(null);

  // Scrollable container ref for TanStack Virtual
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sentinel ref and lifecycle-safe IntersectionObserver for infinite scrolling
  const sentinelRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore?.();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, isLoadingMore, onLoadMore]);

  // Column sort toggle
  const handleSort = (columnKey: string) => {
    let nextDir: 'asc' | 'desc' = 'desc';
    if (sortColumn === columnKey) {
      nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(nextDir);
    } else {
      setSortColumn(columnKey);
      setSortDirection('desc');
    }
    if (onSortChange) {
      // Server-sort mode: let the parent (LibraryContent) own the store update
      // to avoid double-refetch (setStoreDisplayOptions + onSortChange both trigger query re-run)
      onSortChange(columnKey, nextDir);
    } else {
      // Client-sort mode: update store so Topbar reflects the active sort column
      setStoreDisplayOptions?.((prev) => ({
        ...prev,
        orderBy: columnKey as LibraryOrderBy,
        orderDirection: nextDir,
      }));
    }
  };

  // Sort items client-side only when server-side sorting (onSortChange) is not active.
  // Processing items (_isProcessing) are always pinned to the top.
  const sortedItems = useMemo(
    () => sortLibraryItems(items, sortColumn, sortDirection, Boolean(onSortChange)),
    [items, onSortChange, sortColumn, sortDirection],
  );

  // Precise row height estimate (32px / h-8) adhering strictly to Flat Precision SaaS rhythm
  const estimatedRowHeight = 32;

  // TanStack Virtual instance
  const rowVirtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 12,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualHeight = rowVirtualizer.getTotalSize();

  // Auto-trigger infinite load more when virtual window reaches bottom items (if infinite pagination is active)
  const lastVirtualRow = virtualRows[virtualRows.length - 1];
  React.useEffect(() => {
    if (!lastVirtualRow || !hasNextPage || isLoadingMore) return;
    if (lastVirtualRow.index >= sortedItems.length - 4) {
      onLoadMore?.();
    }
  }, [lastVirtualRow, hasNextPage, isLoadingMore, onLoadMore, sortedItems.length]);

  // Reset scroll position to top when items reference changes (e.g. page navigation)
  const prevItemsRef = useRef(items);
  React.useEffect(() => {
    if (prevItemsRef.current !== items) {
      prevItemsRef.current = items;
      tableContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [items]);

  const columns =
    displayOptions?.columns || DEFAULT_LIBRARY_DISPLAY_OPTIONS.columns;

  // Active column count for proper colSpan on virtual spacer rows
  const activeColumnCount = useMemo(() => {
    let count = 1;
    if (columns.authors !== false) count++;
    if (columns.year !== false) count++;
    if (columns.publication !== false) count++;
    if (columns.itemType) count++;
    if (columns.doi) count++;
    if (columns.citationKey) count++;
    if (columns.citations) count++;
    if (isTrash) count++;
    return count;
  }, [columns, isTrash]);

  // Select all handler
  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll(items.map((it) => it.id));
    }
  };

  // Row click handler: activates the item to view in inspector, and toggles off if clicked again.
  // NEVER checks or shows the checkbox automatically (checkbox must be explicitly clicked by user).
  const handleRowClick = useCallback(
    (_e: React.MouseEvent, item: Item, index: number) => {
      const currentActiveId = useLibraryUIStore.getState().activeItemId;

      // If clicking the currently active item, toggle it off!
      if (currentActiveId === item.id) {
        setActiveItem(null);
        lastSelectedIndexRef.current = null;
        return;
      }

      // Otherwise, activate this item without touching checkboxes
      setActiveItem(item.id);
      lastSelectedIndexRef.current = index;
    },
    [setActiveItem],
  );

  // Checkbox toggle handler: explicit user choice with Shift + Click range support
  const handleToggleSelect = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number) => {
      if (e.shiftKey && lastSelectedIndexRef.current !== null) {
        const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds = sortedItems.slice(start, end + 1).map((it) => it.id);
        selectAll(Array.from(new Set([...Array.from(currentSelectedIds), ...rangeIds])));
      } else {
        toggleSelect(id);
      }
      lastSelectedIndexRef.current = index;
    },
    [sortedItems, selectAll, toggleSelect],
  );

  // Keyboard navigation matching Zotero 7 desktop parity
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!sortedItems.length) return;
    const currentIndex = sortedItems.findIndex((it) => it.id === activeItemId);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(currentIndex + 1, sortedItems.length - 1);
      const nextItem = sortedItems[nextIndex];
      if (nextItem) {
        setActiveItem(nextItem.id);
        lastSelectedIndexRef.current = nextIndex;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      const prevItem = sortedItems[prevIndex];
      if (prevItem) {
        setActiveItem(prevItem.id);
        lastSelectedIndexRef.current = prevIndex;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveItem(null);
      clearSelection();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (activeItemId) {
        toggleSelect(activeItemId);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeItemId && !isTrash) {
        const currentQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') : null;
        const qParam = currentQuery ? `?q=${encodeURIComponent(currentQuery)}` : '';
        router.push(`/library/papers/${activeItemId}${qParam}`);
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
      const rawIds = currentSelectedIds.size > 0 ? Array.from(currentSelectedIds) : (activeItemId ? [activeItemId] : []);
      const processingIds = new Set(
        items
          .filter((it: any) => it._isProcessing || it.id.startsWith('temp-') || it.id.startsWith('provisional-'))
          .map((it) => it.id),
      );
      const hasProcessing = rawIds.some((id) => processingIds.has(id));
      if (hasProcessing) {
        toast.warning('Cannot delete or remove items that are currently uploading or processing', {
          id: 'library-item-guard',
        });
      }
      const ids = rawIds.filter((id) => !processingIds.has(id));
      if (ids.length > 0) {
        if (isTrash) {
          if (window.confirm(`Permanently delete ${ids.length} selected item(s)? This action cannot be undone.`)) {
            ids.forEach((id) => handlePurge(id));
            clearSelection();
          }
        } else if (onDetachItem && collectionId && !e.shiftKey) {
          // Zotero 7: In collection, Delete removes from collection without deleting paper from library
          ids.forEach((id) => onDetachItem(id));
          clearSelection();
        } else {
          // Move to trash
          deleteMutation.mutate(ids);
          clearSelection();
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAll(items.map((it) => it.id));
    }
  };

  const handleToggleStar = useCallback(
    (item: Item, isStarred: boolean) => {
      if (item._isProcessing) return;
      toggleStarMutation.mutate({
        id: item.id,
        isStarred: !isStarred,
      });
    },
    [toggleStarMutation],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const targetItem = items.find((it) => it.id === id);
      if (targetItem?._isProcessing) {
        toast.warning('Cannot delete an item that is currently uploading or processing', {
          id: 'library-item-guard',
        });
        return;
      }
      deleteMutation.mutate([id]);
    },
    [deleteMutation, items],
  );

  const handleRestore = useCallback(
    (id: string) => {
      if (onRestoreItems) {
        onRestoreItems([id]);
      } else {
        restoreMutation.mutate([id]);
      }
    },
    [onRestoreItems, restoreMutation],
  );

  const handlePurge = useCallback(
    (id: string) => {
      const targetItem = items.find((it) => it.id === id);
      if (targetItem?._isProcessing) {
        toast.warning('Cannot delete an item that is currently uploading or processing', {
          id: 'library-item-guard',
        });
        return;
      }
      if (onPermanentDeleteItems) {
        onPermanentDeleteItems([id]);
      } else {
        purgeMutation.mutate([id]);
      }
    },
    [onPermanentDeleteItems, purgeMutation, items],
  );


  // Dynamically balance proportional column widths using Golden Ratio (phi ≈ 1.618)
  const colWidths = useMemo(() => {
    const showAuthors = columns.authors !== false;
    const showPub = columns.publication !== false;

    // Calculate space consumed by active fixed-width columns based on Fibonacci progression (55px, 89px, 144px)
    let fixedPx = 0;
    if (columns.year !== false) fixedPx += 89;
    if (columns.itemType) fixedPx += 89;
    if (columns.doi) fixedPx += 144;
    if (columns.citationKey) fixedPx += 144;
    if (columns.citations) fixedPx += 55;
    if (isTrash) fixedPx += 160;

    let authorsWidth: string | undefined = undefined;
    let pubWidth: string | undefined = undefined;

    // Golden Ratio column proportions: Title : Authors : Publication = phi^2 : phi : 1 = 2.618 : 1.618 : 1.000
    // => Title = 50.0%, Authors = 30.9%, Publication = 19.1% (Adjacent ratios = 1.618)
    // When fixed columns consume higher width (> 200px), scaled by 1/phi^2:
    // => Authors = 23.6%, Publication = 14.6% (Ratio 23.6 / 14.6 = 1.618)
    if (showAuthors && showPub) {
      authorsWidth = fixedPx > 200 ? '23.6%' : '30.9%';
      pubWidth = fixedPx > 200 ? '14.6%' : '19.1%';
    } else if (showAuthors) {
      // Title : Authors = phi : 1 => Title = 61.8%, Authors = 38.2%
      authorsWidth = fixedPx > 200 ? '30.9%' : '38.2%';
    } else if (showPub) {
      // Title : Publication = phi : 1 => Title = 61.8%, Publication = 38.2%
      pubWidth = fixedPx > 200 ? '23.6%' : '38.2%';
    }

    return {
      authors: authorsWidth,
      publication: pubWidth,
    };
  }, [
    columns.authors,
    columns.publication,
    columns.year,
    columns.itemType,
    columns.doi,
    columns.citationKey,
    columns.citations,
    isTrash,
  ]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Scrollable Data Table Container */}
      <div
        ref={tableContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          if (
            e.target === e.currentTarget ||
            (e.target as HTMLElement).tagName === 'TABLE' ||
            (e.target as HTMLElement).tagName === 'TBODY'
          ) {
            setActiveItem(null);
            clearSelection();
          }
        }}
        className="flex-1 w-full overflow-auto text-13 focus:outline-none pb-4"
      >
        <table className="w-full min-w-[640px] table-fixed text-left border-collapse">
          <colgroup>
            <col />
            {columns.authors !== false && <col style={{ width: colWidths.authors }} />}
            {columns.year !== false && <col style={{ width: '89px' }} />}
            {columns.publication !== false && <col style={{ width: colWidths.publication }} />}
            {columns.itemType && <col style={{ width: '89px' }} />}
            {columns.doi && <col style={{ width: '144px' }} />}
            {columns.citationKey && <col style={{ width: '144px' }} />}
            {columns.citations && <col style={{ width: '55px' }} />}
            {isTrash && <col style={{ width: '160px' }} />}
          </colgroup>
          <ItemTableHeader
            columns={columns}
            isTrash={isTrash}
            isAllSelected={isAllSelected}
            onSelectAll={handleSelectAll}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />

          <tbody>
            {/* Top virtual spacer */}
            {virtualRows.length > 0 && virtualRows[0].start > 0 && (
              <tr className="border-0 border-none" style={{ height: `${virtualRows[0].start}px`, border: 'none' }}>
                <td colSpan={activeColumnCount} className="p-0 border-0 border-none" style={{ padding: 0, border: 'none' }} />
              </tr>
            )}

            {/* Virtualized visible window rows */}
            {virtualRows.map((virtualRow) => {
              const item = sortedItems[virtualRow.index];
              if (!item) return null;
              const isLast = virtualRow.index === sortedItems.length - 1;
              return (
                <ItemTableRow
                  key={item.id}
                  item={item}
                  index={virtualRow.index}
                  isLast={isLast}
                  columns={columns}
                  density={displayOptions.density}
                  isTrash={isTrash}
                  collections={collections}
                  onRowClick={handleRowClick}
                  onToggleSelect={handleToggleSelect}
                  onToggleStar={handleToggleStar}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                  onPurge={handlePurge}
                  onMoveToCollection={handleMoveToCollection}
                  onDetachFromCollection={onDetachItem}
                />
              );
            })}

            {/* Bottom virtual spacer */}
            {virtualRows.length > 0 && (
              <tr
                className="border-0 border-none"
                style={{
                  height: `${Math.max(
                    0,
                    totalVirtualHeight - (virtualRows[virtualRows.length - 1]?.end ?? 0),
                  )}px`,
                  border: 'none',
                }}
              >
                <td colSpan={activeColumnCount} className="p-0 border-0 border-none" style={{ padding: 0, border: 'none' }} />
              </tr>
            )}
          </tbody>
        </table>

        {/* Invisible sentinel for seamless infinite scroll */}
        {hasNextPage && (
          <div ref={sentinelRef} className="h-1 w-full" />
        )}
      </div>
    </div>
  );
});

export default ItemTable;


