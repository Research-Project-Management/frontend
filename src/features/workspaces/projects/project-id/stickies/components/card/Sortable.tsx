'use client';

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Sticky } from '@/features/workspaces/projects/project-id/stickies/types/sticky.types';
import Card from "./Card";

export const SortableSticky = React.memo(({
  sticky,
  onUpdate,
  onDelete,
}: {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: sticky._id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms cubic-bezier(0.2, 0, 0, 1.0)",
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        sticky={sticky}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
});

SortableSticky.displayName = "SortableSticky";
