'use client';

import React from "react";
import BoardView from "../kanban/Board";
import ListView from "./ListView";
import CalendarView from "./CalendarView";
import type {
  WorkItem,
  Task,
  Column as ColumnType,
  WorkItemViewMode,
  TaskViewMode,
} from "../../types/work-item.types";
import type { TaskCardLabel } from "../kanban/Card";

export interface WorkItemViewsProps {
  viewMode: WorkItemViewMode;
  tasks: WorkItem[];
  tasksByColumnId?: Map<string, WorkItem[]>;
  columns: ColumnType[];
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  workspaceId?: string;
  projectId?: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onEditCard: (card: WorkItem) => void;
  onDeleteCard: (card: WorkItem) => void;
  onDuplicateCard: (card: WorkItem) => void;
  onJoinCard: (card: WorkItem) => void;
  onLeaveCard: (card: WorkItem) => void;
  onRemoveFromCycle?: (card: WorkItem) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  onAssignExistingTasks?: (taskIds: string[], dueDate: string, quiet?: boolean, startDate?: string | null) => void;
  cycleId?: string;
  isReadOnly?: boolean;
}

export type TaskViewsProps = WorkItemViewsProps;

export function WorkItemViews({
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
      const columnId = column.id ?? "";
      map.set(columnId, []);
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

export const TaskViews = WorkItemViews;
export { BoardView, ListView, CalendarView };
export default WorkItemViews;
