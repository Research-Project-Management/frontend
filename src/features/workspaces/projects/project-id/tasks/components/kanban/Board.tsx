'use client';

import React, { useEffect, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  defaultDropAnimationSideEffects,
  type DropAnimation,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { Column } from './Column';
import { CardUI, type TaskCardLabel } from './Card';
import { useKanban } from '../../hooks/use-kanban';
import { resolveTaskColumnId, type Task, type Column as ColumnType } from '../../types/task.types';

export type BoardProps = {
  tasks: Task[];
  tasksByColumnId?: Map<string, Task[]>;
  columns: ColumnType[];
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (card: Task) => void;
  onDeleteCard: (card: Task) => void;
  onDuplicateCard: (card: Task) => void;
  onJoinCard: (card: Task) => void;
  onLeaveCard: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  cycleId?: string;
  isReadOnly?: boolean;
};

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.5',
      },
    },
  }),
};

export function Board({
  tasks,
  columns,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onMoveCard,
  isReadOnly = false,
}: BoardProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { state: kanbanState, actions: kanbanActions } = useKanban({
    tasks,
    columns,
    onMoveCard,
    isReadOnly,
  });

  const { tasksByColumn, activeTask, sensors } = kanbanState;
  const { dragStart, dragEnd, dragCancel } = kanbanActions;

  return (
    <div className="w-full flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={dragStart}
        onDragEnd={dragEnd}
        onDragCancel={dragCancel}
      >
        <div className="flex gap-4 h-full min-w-max pb-2">
          {columns?.map((column) => {
            if (!column) return null;
            const columnId = resolveTaskColumnId(column);
            if (!columnId) return null;

            const columnCards = tasksByColumn.get(columnId) ?? [];

            return (
              <Column
                key={columnId}
                column={column}
                cards={columnCards}
                labelMap={labelMap}
                onAdd={onAddCard}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                currentUserId={currentUserId}
                currentUserAvatar={currentUserAvatar}
                onJoinCard={onJoinCard}
                onLeaveCard={onLeaveCard}
                onRemoveFromCycle={onRemoveFromCycle}
                onAddDisabled={isReadOnly}
                isReadOnly={isReadOnly}
              />
            );
          })}
        </div>

        {isMounted &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimationConfig}>
              {activeTask ? (
                <div className="w-72 rotate-1 cursor-grabbing opacity-90">
                  <CardUI
                    card={activeTask}
                    labelMap={labelMap}
                    currentUserId={currentUserId}
                    currentUserAvatar={currentUserAvatar}
                    isReadOnly={isReadOnly}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>
    </div>
  );
}

export default Board;
