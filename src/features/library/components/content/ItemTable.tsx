'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLibraryUIStore } from '../../store/library-ui.store';
import { useSelectedCount } from '../../store/selectors';
import {
  useToggleStarItemMutation,
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useCollectionsQuery,
  CollectionsService,
  itemKeys,
  invalidateCollections,
} from '../../data';
import {
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  type LibraryDisplayOptions,
} from '../topbar/LibraryDisplayPopover';
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
  onRestoreItems?: (ids: string[]) => void;
  onPermanentDeleteItems?: (ids: string[]) => void;
  onMoveToCollection?: (itemId: string, collectionId: string) => void;
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
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  displayOptions: propDisplayOptions,
  isTrash = false,
  scopeId,
  onRestoreItems,
  onPermanentDeleteItems,
  onMoveToCollection: propOnMoveToCollection,
  onSortChange,
}: ItemTableProps) {
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
  const selectedCount = useSelectedCount();

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
        await CollectionsService.moveItems(scopeId, targetCollectionId, [itemId]);
        queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
        queryClient.invalidateQueries({ queryKey: ['items', scopeId || 'user'] });
        queryClient.invalidateQueries({ queryKey: itemKeys.byCollection(scopeId, targetCollectionId) });
        invalidateCollections(queryClient, scopeId);
        toast.success('Reference moved', {
          description: 'Reference successfully moved to collection.',
          id: toastId,
        });
      } catch (err: any) {
        toast.error('Failed to move reference', {
          description: err?.message || 'Could not move document to collection.',
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
    setStoreDisplayOptions?.((prev) => ({
      ...prev,
      orderBy: columnKey as any,
      orderDirection: nextDir,
    }));
    onSortChange?.(columnKey, nextDir);
  };

  // Sort items client-side
  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;

    return [...items].sort((a, b) => {
      const recordA = a as unknown as Record<string, unknown>;
      const recordB = b as unknown as Record<string, unknown>;
      let valA: unknown = recordA[sortColumn];
      let valB: unknown = recordB[sortColumn];

      if (sortColumn === 'authors') {
        valA = Array.isArray(a.authors) ? a.authors[0] : a.authors;
        valB = Array.isArray(b.authors) ? b.authors[0] : b.authors;
      } else if (sortColumn === 'dateAdded') {
        valA = a.createdAt;
        valB = b.createdAt;
      } else if (sortColumn === 'dateModified') {
        valA = a.updatedAt;
        valB = b.updatedAt;
      }

      if (!valA && valA !== 0) return 1;
      if (!valB && valB !== 0) return -1;

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (Number(valA) < Number(valB)) return sortDirection === 'asc' ? -1 : 1;
      if (Number(valA) > Number(valB)) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortColumn, sortDirection]);

  // Select all handler
  const isAllSelected = items.length > 0 && selectedCount === items.length;
  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll(items.map((it) => it.id));
    }
  };

  // Row click handler: activates the item to view in inspector, NEVER selects the checkbox automatically
  const handleRowClick = useCallback(
    (_e: React.MouseEvent, item: Item, index: number) => {
      setActiveItem(item.id);
      lastSelectedIndexRef.current = index;
    },
    [setActiveItem],
  );

  // Checkbox toggle handler: explicit user choice with Shift + Click range support
  const handleToggleSelect = useCallback(
    (id: string, e: React.MouseEvent, index: number) => {
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

  // Keyboard navigation
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
    } else if (e.key === ' ') {
      e.preventDefault();
      if (activeItemId) {
        toggleSelect(activeItemId);
      }
    }
  };

  const handleToggleStar = useCallback(
    (item: Item, isStarred: boolean) => {
      toggleStarMutation.mutate({
        id: item.id,
        isStarred: !isStarred,
      });
    },
    [toggleStarMutation],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate([id]);
    },
    [deleteMutation],
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
      if (onPermanentDeleteItems) {
        onPermanentDeleteItems([id]);
      } else {
        purgeMutation.mutate([id]);
      }
    },
    [onPermanentDeleteItems, purgeMutation],
  );

  const columns =
    displayOptions?.columns || DEFAULT_LIBRARY_DISPLAY_OPTIONS.columns;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-none">
      {/* Scrollable Data Table Container */}
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex-1 w-full overflow-auto text-13 focus:outline-none"
      >
        <table className="w-full min-w-[960px] table-fixed text-left border-collapse">
          <colgroup>
            <col />
            {columns.authors !== false && <col style={{ width: '200px' }} />}
            {columns.year !== false && <col style={{ width: '70px' }} />}
            {columns.publication !== false && <col style={{ width: '180px' }} />}
            {columns.itemType && <col style={{ width: '120px' }} />}
            {columns.doi && <col style={{ width: '140px' }} />}
            {columns.citationKey && <col style={{ width: '120px' }} />}
            {columns.citations && <col style={{ width: '80px' }} />}
            {isTrash && <col style={{ width: '120px' }} />}
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

          <tbody className="divide-y divide-border">
            {sortedItems.map((item, index) => (
              <ItemTableRow
                key={item.id}
                item={item}
                index={index}
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
              />
            ))}
          </tbody>
        </table>

        {/* Invisible sentinel for seamless infinite scroll */}
        {hasNextPage && (
          <div
            ref={(node) => {
              if (!node || !hasNextPage || isLoadingMore) return;
              const observer = new IntersectionObserver((entries) => {
                if (entries[0]?.isIntersecting) {
                  onLoadMore?.();
                }
              });
              observer.observe(node);
              return () => observer.disconnect();
            }}
            className="h-1 w-full"
          />
        )}
      </div>
    </div>
  );
});

export default ItemTable;

