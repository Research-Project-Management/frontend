'use client';

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useLibraryUIStore } from '../../store/library-ui.store';
import { useSelectedCount } from '../../store/selectors';
import {
  useToggleStarItemMutation,
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
  useCollectionsQuery,
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
  displayOptions?: LibraryDisplayOptions;
  isTrash?: boolean;
  scopeId?: string;
  onRestoreItems?: (ids: string[]) => void;
  onPermanentDeleteItems?: (ids: string[]) => void;
}

/**
 * ItemTable - High-Performance Table Container
 *
 * Decomposed into modular components:
 * - ItemTableHeader: Pure header and sort controls
 * - ItemTableRow: Memoized row listening to granular boolean selectors
 * - ItemContextMenu: Isolated context menu portal
 */
export function ItemTable({
  items,
  displayOptions: propDisplayOptions,
  isTrash = false,
  scopeId,
  onRestoreItems,
  onPermanentDeleteItems,
}: ItemTableProps) {
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
  };

  // Sort items client-side
  const sortedItems = useMemo(() => {
    if (!sortColumn) return items;

    return [...items].sort((a: any, b: any) => {
      let valA: any = a[sortColumn];
      let valB: any = b[sortColumn];

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

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
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

  // Row selection handler with Shift + Click support
  const handleRowClick = useCallback(
    (e: React.MouseEvent, item: Item, index: number) => {
      if (e.shiftKey && lastSelectedIndexRef.current !== null) {
        const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds = sortedItems.slice(start, end + 1).map((it) => it.id);
        selectAll(Array.from(new Set([...Array.from(currentSelectedIds), ...rangeIds])));
      } else if (e.metaKey || e.ctrlKey) {
        toggleSelect(item.id);
        setActiveItem(item.id);
        lastSelectedIndexRef.current = index;
      } else {
        selectOnly(item.id);
        lastSelectedIndexRef.current = index;
      }
    },
    [sortedItems, selectAll, toggleSelect, selectOnly, setActiveItem],
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
        selectOnly(nextItem.id);
        lastSelectedIndexRef.current = nextIndex;
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(currentIndex - 1, 0);
      const prevItem = sortedItems[prevIndex];
      if (prevItem) {
        setActiveItem(prevItem.id);
        selectOnly(prevItem.id);
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
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="w-full h-full overflow-auto text-xs focus:outline-none select-none"
    >
      <table className="w-full table-fixed text-left border-collapse">
        <ItemTableHeader
          columns={columns}
          isTrash={isTrash}
          isAllSelected={isAllSelected}
          onSelectAll={handleSelectAll}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        <tbody className="divide-y divide-border/30">
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
              onToggleStar={handleToggleStar}
              onDelete={handleDelete}
              onRestore={handleRestore}
              onPurge={handlePurge}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ItemTable;
