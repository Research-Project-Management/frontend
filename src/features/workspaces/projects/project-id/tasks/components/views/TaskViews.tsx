'use client';

import React from "react";
import BoardView from "../kanban/Board";
import ListView from "./ListView";
import CalendarView from "./CalendarView";
import type { Task, Column as ColumnType, TaskViewMode } from "../../types/task.types";
import type { TaskCardLabel } from "../kanban/Card";

export interface TaskViewsProps {
  viewMode: TaskViewMode;
  tasks: Task[];
  tasksByColumnId?: Map<string, Task[]>;
  columns: ColumnType[];
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  workspaceId?: string;
  projectId?: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onEditCard: (card: Task) => void;
  onDeleteCard: (card: Task) => void;
  onDuplicateCard: (card: Task) => void;
  onJoinCard: (card: Task) => void;
  onLeaveCard: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  onAssignExistingTasks?: (taskIds: string[], dueDate: string, quiet?: boolean, startDate?: string | null) => void;
  cycleId?: string;
  isReadOnly?: boolean;
}

export function TaskViews({
  viewMode,
  tasks,
  tasksByColumnId,
  columns,
  labelMap,
  currentUserId,
  currentUserAvatar,
  workspaceId = "",
  projectId = "",
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onMoveCard,
  onAssignExistingTasks,
  cycleId,
  isReadOnly,
}: TaskViewsProps) {
  const resolvedTasksByColumnId = React.useMemo(() => {
    if (tasksByColumnId) return tasksByColumnId;
    const map = new Map<string, Task[]>();
    for (const column of columns) {
      const colId = column.id ?? "";
      map.set(colId, []);
    }
    for (const task of tasks) {
      const list = map.get(task.columnId) ?? [];
      list.push(task);
      map.set(task.columnId, list);
    }
    return map;
  }, [tasks, columns, tasksByColumnId]);

  switch (viewMode) {
    case "list":
      return (
        <ListView
          projectId={projectId}
          tasksByColumnId={resolvedTasksByColumnId}
          columns={columns}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
          onAddCard={onAddCard}
          onEditCard={onEditCard}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onJoinCard={onJoinCard}
          onLeaveCard={onLeaveCard}
          onRemoveFromCycle={onRemoveFromCycle}
          onMoveCard={onMoveCard}
          isReadOnly={isReadOnly}
        />
      );

    case "calendar":
      return (
        <CalendarView
          tasks={tasks}
          columns={columns}
          workspaceId={workspaceId}
          projectId={projectId}
          onAddCard={onAddCard}
          onOpenCardDetail={onEditCard}
          onAssignExistingTasks={onAssignExistingTasks ?? (() => {})}
          onRemoveFromCycle={cycleId ? onRemoveFromCycle : undefined}
          isReadOnly={isReadOnly}
        />
      );

    case "board":
    default:
      return (
        <BoardView
          tasks={tasks}
          tasksByColumnId={resolvedTasksByColumnId}
          columns={columns}
          labelMap={labelMap}
          currentUserId={currentUserId}
          currentUserAvatar={currentUserAvatar}
          onAddCard={onAddCard}
          onEditCard={onEditCard}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onJoinCard={onJoinCard}
          onLeaveCard={onLeaveCard}
          onRemoveFromCycle={onRemoveFromCycle}
          onMoveCard={onMoveCard}
          cycleId={cycleId}
          isReadOnly={isReadOnly}
        />
      );
  }
}

export { BoardView, ListView, CalendarView };
export default TaskViews;
