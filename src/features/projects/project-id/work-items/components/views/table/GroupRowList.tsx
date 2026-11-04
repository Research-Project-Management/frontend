'use client';

import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Item, Column, ProjectMember } from '@/features/projects/project-id/work-items/types/work-item.types';
import type { TablePropertyKey } from '@/features/projects/project-id/work-items/types/work-item.types';
import { RowItem } from './RowItem';

export interface GroupRowListProps {
  rows: Array<{
    item: Item;
    isSubItem: boolean;
    hasChildren: boolean;
    isChildrenExpanded: boolean;
  }>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  columns: Column[];
  projectStates?: Column[];
  visibleProperties: Record<TablePropertyKey, boolean>;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEditItem: (card: Item) => void;
  onDeleteItem?: (card: Item) => void;
  onDuplicateItem?: (card: Item) => void;
  onUpdateItem?: (data: Partial<Item> & { id: string }) => void;
  members?: ProjectMember[];
  projectId?: string;
  isReadOnly?: boolean;
  toggleExpandChildren: (parentId: string) => void;
}

export function GroupRowList({
  rows,
  scrollRef,
  columns,
  projectStates,
  visibleProperties,
  selectedIds,
  onToggleSelect,
  onEditItem,
  onDeleteItem,
  onDuplicateItem,
  onUpdateItem,
  members = [],
  projectId = '',
  isReadOnly = false,
  toggleExpandChildren,
}: GroupRowListProps) {
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
              <RowItem
                item={item}
                columns={columns}
                projectStates={projectStates || columns}
                visibleProperties={visibleProperties}
                isSelected={selectedIds.includes(item.id)}
                onToggleSelect={onToggleSelect}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
                onDuplicateItem={onDuplicateItem}
                onUpdateItem={onUpdateItem}
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
        <RowItem
          key={item.id}
          item={item}
          columns={columns}
          projectStates={projectStates || columns}
          visibleProperties={visibleProperties}
          isSelected={selectedIds.includes(item.id)}
          onToggleSelect={onToggleSelect}
          onEditItem={onEditItem}
          onDeleteItem={onDeleteItem}
          onDuplicateItem={onDuplicateItem}
          onUpdateItem={onUpdateItem}
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
