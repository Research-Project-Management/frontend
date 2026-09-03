'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/shared/components/ui/skeleton';
import ItemTableHeader from './table/ItemTableHeader';
import ItemTableRow from './table/ItemTableRow';
import ItemTableEmpty from './table/ItemTableEmpty';
import ItemBatchBar from './table/ItemBatchBar';
import MoveToTrashModal, { type MoveToTrashTarget } from './modals/MoveToTrashModal';
import { usePaperTable, type SortField, type SortOrder } from '../hooks/library/use-items';
import type { CatalogItem, Collection } from '../types/library.types';

export interface PaperTableProps {
  items?: CatalogItem[];
  /** @deprecated use items */
  papers?: CatalogItem[];
  collectionMap?: Record<string, Collection>;
  collections?: Collection[];
  isLoading: boolean;
  isSearch: boolean;
  selectedItemId?: string | null;
  /** @deprecated use selectedItemId */
  selectedPaperId?: string | null;
  onSelectItem?: (item: CatalogItem) => void;
  /** @deprecated use onSelectItem */
  onSelectPaper?: (item: CatalogItem) => void;
  onDeleteItem?: (id: string) => void;
  /** @deprecated use onDeleteItem */
  onDeletePaper?: (id: string) => void;
  onBatchDeleteItems?: (ids: string[]) => void;
  /** @deprecated use onBatchDeleteItems */
  onBatchDeletePapers?: (ids: string[]) => void;
  onBatchMoveItems?: (ids: string[], targetCollectionId: string | null) => void;
  /** @deprecated use onBatchMoveItems */
  onBatchMovePapers?: (ids: string[], targetCollectionId: string | null) => void;
  onClearSearch?: () => void;
  onAddItem?: () => void;
  /** @deprecated use onAddItem */
  onAddPaper?: () => void;
  collectionName?: string;
  showCollection?: boolean;
  showLastRead?: boolean;
  isTrash?: boolean;
  onRestoreItem?: (id: string) => void;
  onPurgeItem?: (id: string) => void;
  onBatchRestoreItems?: (ids: string[]) => void;
  onBatchPurgeItems?: (ids: string[]) => void;
}

export default function ItemTable({
  items: itemsProp,
  papers,
  collectionMap = {},
  collections = [],
  isLoading,
  isSearch,
  selectedItemId: selectedItemIdProp,
  selectedPaperId,
  onSelectItem,
  onSelectPaper,
  onDeleteItem,
  onDeletePaper,
  onBatchDeleteItems,
  onBatchDeletePapers,
  onBatchMoveItems,
  onBatchMovePapers,
  onClearSearch,
  onAddItem,
  onAddPaper,
  collectionName,
  showCollection = true,
  showLastRead = false,
  isTrash = false,
  onRestoreItem,
  onPurgeItem,
  onBatchRestoreItems,
  onBatchPurgeItems,
}: PaperTableProps) {
  const effectiveSelectedItemId = selectedItemIdProp !== undefined ? selectedItemIdProp : (selectedPaperId || null);
  const effectiveOnSelect = onSelectItem || onSelectPaper || (() => {});
  const effectiveOnDelete = onDeleteItem || onDeletePaper || (() => {});
  const effectiveOnBatchDelete = onBatchDeleteItems || onBatchDeletePapers;
  const effectiveOnBatchMove = onBatchMoveItems || onBatchMovePapers;

  const { workspaceId: workspaceUrl } = useParams();
  const currentWorkspaceId = (workspaceUrl as string) || '';
  const items = React.useMemo(() => {
    return itemsProp || papers || [];
  }, [itemsProp, papers]);

  const [trashTarget, setTrashTarget] = React.useState<MoveToTrashTarget | null>(null);
  const [isTrashOpen, setIsTrashOpen] = React.useState(false);

  const {
    sortedPapers,
    sortField,
    sortOrder,
    handleSort,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    isAllSelected,
    isPartiallySelected,
    selectedCount,
  } = usePaperTable({
    papers: items,
    initialActiveId: effectiveSelectedItemId,
    initialSortField: showLastRead ? 'lastReadAt' : 'createdAt',
    initialSortOrder: 'desc',
  });

  const selectedItems = React.useMemo(
    () => items.filter((p) => selectedIds.has(p.id)),
    [items, selectedIds],
  );

  const handleOpenSingleDelete = (idOrItem: string | CatalogItem) => {
    if (typeof idOrItem === 'string') {
      const targetItem = items.find((p) => p.id === idOrItem);
      setTrashTarget({ id: idOrItem, title: targetItem?.title });
    } else {
      setTrashTarget({ id: idOrItem.id, title: idOrItem.title });
    }
    setIsTrashOpen(true);
  };

  const handleOpenBatchDelete = () => {
    setTrashTarget({ ids: Array.from(selectedIds) });
    setIsTrashOpen(true);
  };

  const handleConfirmTrash = () => {
    if (!trashTarget) return;
    if ('ids' in trashTarget && trashTarget.ids) {
      if (effectiveOnBatchDelete) {
        effectiveOnBatchDelete(trashTarget.ids);
      } else {
        for (const id of trashTarget.ids) {
          effectiveOnDelete(id);
        }
      }
      clearSelection();
    } else if ('id' in trashTarget && trashTarget.id) {
      effectiveOnDelete(trashTarget.id);
      if (selectedIds.has(trashTarget.id)) {
        clearSelection();
      }
    }
  };

  const handleBatchMove = (targetCollectionId: string | null) => {
    if (effectiveOnBatchMove) {
      effectiveOnBatchMove(Array.from(selectedIds), targetCollectionId);
    }
    clearSelection();
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        <div className="h-9 w-full bg-muted/60 rounded-md" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <ItemTableEmpty
        isSearch={isSearch}
        onClearSearch={onClearSearch}
        collectionName={collectionName}
      />
    );
  }

  return (
    <div className="relative flex-1 min-h-0 overflow-y-auto overflow-x-auto min-w-0 select-none">
      <table className="w-full text-left border-collapse select-none font-sans">
        <ItemTableHeader
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          isAllSelected={isAllSelected}
          isPartiallySelected={isPartiallySelected}
          onToggleSelectAll={toggleSelectAll}
          showCollection={showCollection}
          showLastRead={showLastRead}
        />

        <tbody className="divide-y divide-border/30">
          {sortedPapers.map((item: CatalogItem) => (
            <ItemTableRow
              key={item.id}
              paper={item}
              item={item}
              collection={item.collectionId ? collectionMap[item.collectionId] ?? null : null}
              collections={collections}
              isSelected={selectedIds.has(item.id)}
              isActive={effectiveSelectedItemId === item.id}
              onSelect={effectiveOnSelect}
              onToggleCheck={toggleSelect}
              onDelete={handleOpenSingleDelete}
              onRestore={onRestoreItem}
              onPurge={onPurgeItem}
              onMove={(targetColId) => effectiveOnBatchMove?.([item.id], targetColId)}
              isTrash={isTrash}
              showCollection={showCollection}
              showLastRead={showLastRead}
            />
          ))}
        </tbody>
      </table>

      {/* Floating Batch Action Bar */}
      <ItemBatchBar
        selectedCount={selectedCount}
        selectedItems={selectedItems}
        selectedPapers={selectedItems}
        collections={collections}
        onClearSelection={clearSelection}
        onBatchMove={handleBatchMove}
        onBatchDelete={isTrash ? (onBatchPurgeItems ? () => onBatchPurgeItems(Array.from(selectedIds)) : undefined) : handleOpenBatchDelete}
        onBatchRestore={isTrash && onBatchRestoreItems ? () => onBatchRestoreItems(Array.from(selectedIds)) : undefined}
        isTrash={isTrash}
      />

      {/* Move to Trash Confirmation Modal */}
      <MoveToTrashModal
        open={isTrashOpen}
        onOpenChange={setIsTrashOpen}
        target={trashTarget}
        onConfirm={handleConfirmTrash}
      />
    </div>
  );
}

export { ItemTable as Table };
