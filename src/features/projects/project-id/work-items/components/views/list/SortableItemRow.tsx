'use client';

import React, { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SubItem } from '@/features/projects/project-id/work-items/types/work-item.types';
import type { SortableItemRowProps } from '@/features/projects/project-id/work-items/types/list-view.types';
import { ItemRow } from './ItemRow';
import { ChildItemRow, ChildItemQuickAdd } from './ChildItemRow';

export const SortableItemRow = memo(function SortableItemRow({
  onUpdateChildItem,
  onDeleteChildItem,
  onAddChildItem,
  ...props
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    data: { item: props.item },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const childList: SubItem[] = useMemo(() => {
    if (props.item.childWorkItems && props.item.childWorkItems.length > 0) {
      return props.item.childWorkItems;
    }
    if (props.item.subItems && props.item.subItems.length > 0) {
      return props.item.subItems;
    }
    return [];
  }, [props.item.subItems, props.item.childWorkItems]);

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners}>
        <ItemRow {...props} isDragging={isDragging} />
      </div>
      {props.isChildrenExpanded && (
        <div
          className="bg-muted/20 border-b border-border divide-y divide-border/40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {childList.map((sub: SubItem, idx: number) => (
            <ChildItemRow
              key={sub.id || `sub_${idx}`}
              childItem={sub}
              parentItem={props.item}
              index={idx}
              columns={props.columns}
              projectStates={props.projectStates}
              members={props.members}
              isReadOnly={props.isReadOnly}
              onEditCard={props.onEditCard}
              onUpdateChildItem={onUpdateChildItem}
              onDeleteChildItem={onDeleteChildItem}
            />
          ))}
          {!props.isReadOnly && onAddChildItem && (
            <ChildItemQuickAdd
              parentItem={props.item}
              onAddChildItem={onAddChildItem}
            />
          )}
        </div>
      )}
    </div>
  );
});
