'use client';

import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TablePropertyKey } from '../../../types/table-view.types';
import { TableRowItem } from './TableRowItem';

export interface TableGroupRowListProps {
  rows: Array<{
    item: Item;
    isSubItem: boolean;
    hasChildren: boolean;
    isChildrenExpanded: boolean;
  }>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  columns: ColumnType[];
  projectStates?: ColumnType[];
  visibleProperties: Record<TablePropertyKey, boolean>;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEditCard: (card: Item) => void;
  onDeleteCard?: (card: Item) => void;
  onDuplicateCard?: (card: Item) => void;
  onUpdateCard?: (data: Partial<Item> & { id: string }) => void;
  members?: ProjectMember[];
  projectId?: string;
  isReadOnly?: boolean;
  toggleExpandChildren: (parentId: string) => void;
}

export function TableGroupRowList({
  rows,
  scrollRef,
  columns,
  projectStates,
  visibleProperties,
  selectedIds,
  onToggleSelect,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onUpdateCard,
  members = [],
  projectId = '',
  isReadOnly = false,
  toggleExpandChildren,
}: TableGroupRowListProps) {
  const isVirtualized = rows.length > 50;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 10,
    enabled: isVirtualized,
  });

  const virtualItems = isVirtualized ? virtualizer.getVirtualItems() : [];

  if (isVirtualized && virtualItems.length > 0) {
    return (
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          const { item, isSubItem, hasChildren, isChildrenExpanded } = row;
          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TableRowItem
                item={item}
                columns={columns}
                projectStates={projectStates || columns}
                visibleProperties={visibleProperties}
                isSelected={selectedIds.includes(item.id)}
                onToggleSelect={onToggleSelect}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                onUpdateCard={onUpdateCard}
                members={members}
                projectId={projectId}
                isReadOnly={isReadOnly}
                isSubItem={isSubItem}
                hasChildren={hasChildren}
                isChildrenExpanded={isChildrenExpanded}
                onToggleExpandChildren={toggleExpandChildren}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {rows.map(({ item, isSubItem, hasChildren, isChildrenExpanded }) => (
        <TableRowItem
          key={item.id}
          item={item}
          columns={columns}
          projectStates={projectStates || columns}
          visibleProperties={visibleProperties}
          isSelected={selectedIds.includes(item.id)}
          onToggleSelect={onToggleSelect}
          onEditCard={onEditCard}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onUpdateCard={onUpdateCard}
          members={members}
          projectId={projectId}
          isReadOnly={isReadOnly}
          isSubItem={isSubItem}
          hasChildren={hasChildren}
          isChildrenExpanded={isChildrenExpanded}
          onToggleExpandChildren={toggleExpandChildren}
        />
      ))}
    </div>
  );
}
