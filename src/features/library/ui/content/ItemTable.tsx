"use client";

import React, { useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import {
  useToggleStarItemMutation,
  useUpdateLibraryItemMutation,
  useDeleteLibraryItemsMutation,
  useBatchRestoreItemsMutation,
  useBatchPurgeItemsMutation,
} from "@/features/library/sdk/queries/catalog.queries";
import {
  useCollectionsQuery,
  useMoveCollectionItemsMutation,
  useAssignCollectionItemsMutation,
  useBatchDetachItemsMutation,
} from "@/features/library/sdk/queries/collections.queries";
import { toast } from "sonner";
import { useTags } from "@/features/library/sdk/queries/tags-notes.queries";
import {
  DEFAULT_LIBRARY_DISPLAY_OPTIONS,
  type LibraryDisplayOptions,
  type LibraryOrderBy,
} from "@/features/library/ui/topbar/LibraryDisplayPopover";
import { sortLibraryItems } from "@/features/library/domain/sort-items.domain";
import { ItemTableHeader } from "./ItemTableHeader";
import { ItemTableRow } from "./ItemTableRow";
import { useLibraryKeyboardShortcuts } from "./useLibraryKeyboardShortcuts";
import { useLibraryItemOperations } from "@/features/library/core/coordinator/item-operations.coordinator";
import type { Item, Collection } from "@/features/library/domain/types/library.types";

export interface ItemTableProps {
  items: Item[];
  totalCount?: number;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  enableInfiniteScroll?: boolean;
  displayOptions?: LibraryDisplayOptions;
  isTrash?: boolean;
  scopeId?: string;
  collectionId?: string;
  canEdit?: boolean;
  onRestoreItems?: (ids: string[]) => void;
  onPermanentDeleteItems?: (ids: string[]) => void;
  onMoveToCollection?: (itemId: string, collectionId: string) => void;
  onDetachItem?: (id: string) => void;
  onSortChange?: (columnKey: string, direction: "asc" | "desc") => void;
}

/**
 * ItemTable - High-Performance Table Container
 *
 * Decomposed into modular components:
 * - ItemTableHeader: Pure header and sort controls
 * - ItemTableRow: Memoized row listening to granular boolean selectors
 * - ItemContextMenu: Isolated context menu portal
 */
const EMPTY_COLLECTIONS: Collection[] = [];
const EMPTY_TAGS: unknown[] = [];

export const ItemTable = React.memo(function ItemTable({
  items,
  totalCount,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  displayOptions: propDisplayOptions,
  isTrash = false,
  canEdit = true,
  scopeId,
  collectionId,
  onRestoreItems,
  onPermanentDeleteItems,
  onMoveToCollection: propOnMoveToCollection,
  onDetachItem,
  onSortChange,
}: ItemTableProps) {
  const router = useRouter();

  // Store actions
  const selectAll = useLibraryUIStore((s) => s.selectAll);
  const clearSelection = useLibraryUIStore((s) => s.clearSelection);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);
  const storeDisplayOptions = useLibraryUIStore((s) => s.displayOptions);
  const setStoreDisplayOptions = useLibraryUIStore((s) => s.setDisplayOptions);
  const openModal = useLibraryUIStore((s) => s.openModal);

  // Granular Boolean Selector: Does NOT re-render ItemTable when selectedIds count increments (O(1) row isolation)
  const isAllSelected = useLibraryUIStore(
    useCallback(
      (s) => items.length > 0 && s.selectedIds.size === items.length,
      [items.length],
    ),
  );

  const displayOptions =
    propDisplayOptions ??
    storeDisplayOptions ??
    DEFAULT_LIBRARY_DISPLAY_OPTIONS;

  // Mutations & Queries
  const toggleStarMutation = useToggleStarItemMutation(scopeId);
  const updateItemMutation = useUpdateLibraryItemMutation(scopeId);
  const deleteMutation = useDeleteLibraryItemsMutation(scopeId);
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const purgeMutation = useBatchPurgeItemsMutation(scopeId);
  const moveMutation = useMoveCollectionItemsMutation(scopeId);
  const assignMutation = useAssignCollectionItemsMutation(scopeId);
  const batchDetachMutation = useBatchDetachItemsMutation(scopeId);
  const { data: rawCollections } = useCollectionsQuery(scopeId);
  const collections = rawCollections ?? EMPTY_COLLECTIONS;
  const { tags: rawScopeTags } = useTags(scopeId);
  const scopeTags = (rawScopeTags ?? EMPTY_TAGS) as typeof rawScopeTags;

  // Sorting state derived directly from displayOptions
  const sortColumn = displayOptions?.orderBy || "createdAt";
  const sortDirection: "asc" | "desc" =
    displayOptions?.orderDirection || "desc";

  // Track last selected index for Shift + Click range selection
  const lastSelectedIndexRef = useRef<number | null>(null);

  // Scrollable container ref for TanStack Virtual
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Column sort toggle
  const handleSort = (columnKey: string) => {
    let nextDir: "asc" | "desc" = "desc";
    if (sortColumn === columnKey) {
      nextDir = sortDirection === "asc" ? "desc" : "asc";
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
    () =>
      sortLibraryItems(items, sortColumn, sortDirection, Boolean(onSortChange)),
    [items, onSortChange, sortColumn, sortDirection],
  );

  // Reference-stable ref to keep handleToggleSelect memoized across item changes
  const sortedItemsRef = useRef(sortedItems);
  sortedItemsRef.current = sortedItems;

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
  }, [
    lastVirtualRow,
    hasNextPage,
    isLoadingMore,
    onLoadMore,
    sortedItems.length,
  ]);

  // Reset scroll position to top when items reference changes (e.g. page navigation)
  const prevItemsRef = useRef(items);
  React.useEffect(() => {
    if (prevItemsRef.current !== items) {
      prevItemsRef.current = items;
      tableContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
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
    count++; // Dedicated Actions column
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

  // O(1) lookup map by item ID for action guards
  const itemsById = useMemo(
    () => new Map(items.map((it) => [it.id, it])),
    [items],
  );

    // Row click handler: activates the item to view in inspector, opens the inspector if closed, and toggles off if clicked again.
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

      // Otherwise, activate this item and ensure inspector is open to give immediate feedback
      setActiveItem(item.id);
      setIsInspectorOpen(true);
      lastSelectedIndexRef.current = index;
    },
    [setActiveItem, setIsInspectorOpen],
  );

  // Checkbox toggle handler: explicit user choice with Shift + Click range support
  const handleToggleSelect = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number) => {
      if (e.shiftKey && lastSelectedIndexRef.current !== null) {
        const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
        const start = Math.min(lastSelectedIndexRef.current, index);
        const end = Math.max(lastSelectedIndexRef.current, index);
        const rangeIds = sortedItemsRef.current.slice(start, end + 1).map((it) => it.id);
        selectAll(
          Array.from(new Set([...Array.from(currentSelectedIds), ...rangeIds])),
        );
      } else {
        toggleSelect(id);
      }
      lastSelectedIndexRef.current = index;
    },
    [selectAll, toggleSelect],
  );

  const handleOpenItem = useCallback(
    (itemId: string) => {
      if (isTrash) return;
      const currentQuery =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("q")
          : null;
      const activeScope = useLibraryUIStore.getState().activeScope;
      const targetItem = itemsById.get(itemId);
      const effectiveProjectId =
        targetItem?.projectId ||
        (activeScope.type === "project" ? activeScope.id : null);

      const queryParts = [
        effectiveProjectId
          ? `projectId=${encodeURIComponent(effectiveProjectId)}`
          : "",
        currentQuery ? `q=${encodeURIComponent(currentQuery)}` : "",
      ].filter(Boolean);
      const qParam = queryParts.length ? `?${queryParts.join("&")}` : "";
      router.push(`/library/papers/${itemId}${qParam}`);
    },
    [router, isTrash, itemsById],
  );



  // Desktop-grade keyboard navigation
  const { handleKeyDown } = useLibraryKeyboardShortcuts({
    items,
    sortedItems,
    itemsById,
    isTrash,
    collectionId,
    scopeTags,
    onDetachItem,
    handleOpenItem,
    deleteItems: (ids) => deleteMutation.mutate(ids),
    deleteMutation,
    restoreMutation,
    updateItemMutation,
    lastSelectedIndexRef,
  });

  // Unified Document Operations (Star, Delete, Restore, Purge, Move)
  const {
    handleToggleStar,
    handleDelete,
    handleRestore,
    handlePurge,
    handleMoveToCollection,
  } = useLibraryItemOperations({
    itemsById,
    isTrash,
    collectionId,
    propOnMoveToCollection,
    onRestoreItems,
    onPermanentDeleteItems,
    toggleStarMutation,
    deleteMutation,
    restoreMutation,
    purgeMutation,
    moveMutation,
    detachMutation: batchDetachMutation,
    assignMutation,
  });

  const handleAddToCollection = useCallback(
    async (itemId: string, targetCollectionId: string) => {
      try {
        await assignMutation.mutateAsync({
          collectionId: targetCollectionId,
          itemIds: [itemId],
        });
        const targetCol = collections.find((c) => c.id === targetCollectionId);
        toast.success(`Added to "${targetCol?.name || 'collection'}"`);
      } catch (err) {
        toast.error('Failed to add to collection', {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [assignMutation, collections],
  );

  // Dynamically compute table minimum width to prevent column squashing when fields are toggled
  const tableMinWidth = useMemo(() => {
    let width = 280; // Baseline Title column (Checkbox + status badges + title text)
    if (columns.authors !== false) width += 180;
    if (columns.year !== false) width += 72;
    if (columns.publication !== false) width += 180;
    if (columns.itemType) width += 130;
    if (columns.doi) width += 180;
    if (columns.citationKey) width += 160;
    if (columns.citations) width += 84;
    if (isTrash) width += 140;
    width += 44; // Dedicated Actions column
    return Math.max(640, width);
  }, [
    columns.authors,
    columns.year,
    columns.publication,
    columns.itemType,
    columns.doi,
    columns.citationKey,
    columns.citations,
    isTrash,
  ]);

  // Dynamically balance proportional column widths using Golden Ratio
  const colWidths = useMemo(() => {
    const showAuthors = columns.authors !== false;
    const showPub = columns.publication !== false;

    let fixedPx = 44; // Actions column
    if (columns.year !== false) fixedPx += 72;
    if (columns.itemType) fixedPx += 130;
    if (columns.doi) fixedPx += 180;
    if (columns.citationKey) fixedPx += 160;
    if (columns.citations) fixedPx += 84;
    if (isTrash) fixedPx += 140;

    let authorsWidth: string | undefined = undefined;
    let pubWidth: string | undefined = undefined;

    if (showAuthors && showPub) {
      authorsWidth = fixedPx > 200 ? "22%" : "30.9%";
      pubWidth = fixedPx > 200 ? "16%" : "19.1%";
    } else if (showAuthors) {
      authorsWidth = fixedPx > 200 ? "28%" : "38.2%";
    } else if (showPub) {
      pubWidth = fixedPx > 200 ? "24%" : "38.2%";
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
            (e.target as HTMLElement).tagName === "TABLE" ||
            (e.target as HTMLElement).tagName === "TBODY"
          ) {
            setActiveItem(null);
            clearSelection();
          }
        }}
        className="flex-1 w-full overflow-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden text-13 focus:outline-none pb-4"
      >
        <table
          style={{ minWidth: `${tableMinWidth}px` }}
          className="w-full table-fixed text-left border-collapse"
        >
          <colgroup>
            <col style={{ minWidth: "260px" }} />
            {columns.authors !== false && (
              <col style={{ width: colWidths.authors, minWidth: "160px" }} />
            )}
            {columns.year !== false && <col style={{ width: "72px" }} />}
            {columns.publication !== false && (
              <col style={{ width: colWidths.publication, minWidth: "160px" }} />
            )}
            {columns.itemType && <col style={{ width: "130px" }} />}
            {columns.doi && <col style={{ width: "180px" }} />}
            {columns.citationKey && <col style={{ width: "160px" }} />}
            {columns.citations && <col style={{ width: "84px" }} />}
            {isTrash && <col style={{ width: "140px" }} />}
            <col style={{ width: "44px" }} />
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
              <tr
                className="border-0 border-none"
                style={{ height: `${virtualRows[0].start}px`, border: "none" }}
              >
                <td
                  colSpan={activeColumnCount}
                  className="p-0 border-0 border-none"
                  style={{ padding: 0, border: "none" }}
                />
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
                  scopeId={scopeId}
                  isLast={isLast}
                  columns={columns}
                  isTrash={isTrash}
                  collections={collections}
                  canEdit={canEdit}
                  onRowClick={handleRowClick}
                  onToggleSelect={handleToggleSelect}
                  onToggleStar={canEdit ? handleToggleStar : undefined}
                  onDelete={canEdit ? handleDelete : undefined}
                  onRestore={canEdit ? handleRestore : undefined}
                  onPurge={canEdit ? handlePurge : undefined}
                  onAddToCollection={canEdit ? handleAddToCollection : undefined}
                  onMoveToCollection={canEdit ? handleMoveToCollection : undefined}
                  onDetachFromCollection={canEdit ? onDetachItem : undefined}
                  onOpenItem={handleOpenItem}
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
                    totalVirtualHeight -
                      (virtualRows[virtualRows.length - 1]?.end ?? 0),
                  )}px`,
                  border: "none",
                }}
              >
                <td
                  colSpan={activeColumnCount}
                  className="p-0 border-0 border-none"
                  style={{ padding: 0, border: "none" }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default ItemTable;
