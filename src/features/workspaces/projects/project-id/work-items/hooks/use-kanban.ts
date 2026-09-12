'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  Clock3,
  AlignLeft,
  MessageSquare,
  Paperclip,
  CheckSquare,
  GitBranch,
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import type { Task, Column } from '../types/types';
import { resolveTaskColumnId } from '../types/types';
import { TaskHelpers } from '../utils/util';

export type TaskCardLabel = {
  id: string;
  name: string;
  color: string;
};

export type CardMetadataItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  text: string;
};

// ── 1. Kanban Board Controller (useKanban) ──────────────────────────────────

export interface UseKanbanOptions {
  tasks: Task[];
  columns: Column[];
  onMoveCard?: (cardId: string, targetColumnId: string) => void;
  isReadOnly?: boolean;
}

export function useKanban({
  tasks = [],
  columns = [],
  onMoveCard,
  isReadOnly = false,
}: UseKanbanOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  const validColumnIds = useMemo(() => {
    return new Set(
      columns
        .map((column) => resolveTaskColumnId(column))
        .filter((id): id is string => Boolean(id)),
    );
  }, [columns]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const column of columns) {
      const columnId = resolveTaskColumnId(column);
      if (columnId) map.set(columnId, []);
    }
    for (const task of tasks) {
      if (!task.columnId) continue;
      const list = map.get(task.columnId);
      if (list) list.push(task);
    }
    return map;
  }, [tasks, columns]);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    return tasks.find((task) => task.id === activeId) ?? null;
  }, [activeId, tasks]);

  const dragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const dragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || isReadOnly) return;

      const activeTaskId = String(active.id);
      const overId = String(over.id);

      let targetColumnId: string | null = null;
      if (validColumnIds.has(overId)) {
        targetColumnId = overId;
      } else {
        const overTask = tasks.find((task) => task.id === overId);
        if (overTask?.columnId && validColumnIds.has(overTask.columnId)) {
          targetColumnId = overTask.columnId;
        }
      }

      if (!targetColumnId) return;

      const currentTask = tasks.find((task) => task.id === activeTaskId);
      if (currentTask && currentTask.columnId !== targetColumnId) {
        onMoveCard?.(activeTaskId, targetColumnId);
      }
    },
    [tasks, validColumnIds, onMoveCard, isReadOnly],
  );

  const dragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const moveTask = useCallback(
    (taskId: string, targetColumnId: string) => {
      if (isReadOnly || !validColumnIds.has(targetColumnId)) return;
      onMoveCard?.(taskId, targetColumnId);
    },
    [isReadOnly, validColumnIds, onMoveCard],
  );

  const getColTasks = useCallback(
    (columnId: string) => tasksByColumn.get(columnId) ?? [],
    [tasksByColumn],
  );

  const state = {
    activeId,
    activeTask,
    tasksByColumn,
    tasksByColumnId: tasksByColumn,
    sensors,
    columns,
    tasks,
    isDragging: Boolean(activeId),
    isReadOnly,
  };

  const actions = {
    setActiveId,
    dragStart,
    dragEnd,
    dragCancel,
    moveTask,
    getColTasks,
    handleDragStart: dragStart,
    handleDragEnd: dragEnd,
    handleDragCancel: dragCancel,
    handleMoveCard: moveTask,
  };

  return { state, actions };
}

// ── 2. Kanban Card Controller (useCard) ─────────────────────────────────────

export interface UseCardOptions {
  card: Task;
  labelMap?: Map<string, TaskCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onEdit?: (card: Task) => void;
  onDuplicate?: (card: Task) => void;
  onDelete?: (card: Task) => void;
  onJoin?: (card: Task) => void;
  onLeave?: (card: Task) => void;
  onRemoveFromCycle?: (card: Task) => void;
  isReadOnly?: boolean;
}

export function useCard({
  card,
  labelMap,
  currentUserId,
  currentUserAvatar,
  onEdit,
  onDuplicate,
  onDelete,
  onJoin,
  onLeave,
  onRemoveFromCycle,
  isReadOnly = false,
}: UseCardOptions) {
  const [showLabels, setShowLabels] = useState(false);

  const startDate = useMemo(() => TaskHelpers.formatDate(card.startDate), [card.startDate]);
  const dueDate = useMemo(() => TaskHelpers.formatDate(card.dueDate), [card.dueDate]);
  const dateText = useMemo(() => {
    if (startDate && dueDate) return `${startDate} - ${dueDate}`;
    return dueDate || startDate;
  }, [startDate, dueDate]);

  const hasDue = Boolean(card.dueDate && !Number.isNaN(new Date(card.dueDate).getTime()));
  const isOverdue = useMemo(() => {
    return TaskHelpers.checkOverdue(card.dueDate);
  }, [card.dueDate]);

  const hasDesc = Boolean(card.description?.trim() || card.content?.trim());
  const comments = (card as any).commentCount ?? (card as any).comments?.length ?? 0;
  const attachments = TaskHelpers.countAttachments(card.attachments);
  const subtasks = Array.isArray(card.subtasks) ? card.subtasks : [];
  const subtaskTotal = (card as any).subtaskCount ?? subtasks.length;
  const subtaskDone =
    (card as any).subtaskCompletedCount ??
    subtasks.filter((subtask: any) => subtask?.completed || subtask?.columnId === 'done').length;

  const labels = useMemo(() => {
    return (card.labels || [])
      .map((id: string) => labelMap?.get(id))
      .filter(Boolean)
      .map((labelItem) => ({ id: labelItem!.id, color: labelItem!.color, title: labelItem!.name }))
      .filter((labelItem) => Boolean(labelItem.color));
  }, [card.labels, labelMap]);

  const user = useMemo(() => {
    const raw = TaskHelpers.resolveAssignee(card);
    if (!raw) return null;
    return {
      id: raw.id,
      name: raw.name || '',
      avatar: raw.avatar || undefined,
    };
  }, [card]);

  const initials = useMemo(() => (user?.name ? TaskHelpers.getInitials(user.name) : ''), [user]);
  const isCurrentUser = Boolean(currentUserId && user?.id === currentUserId);
  const avatar = user?.avatar || (isCurrentUser ? currentUserAvatar : undefined);

  const metadataItems = useMemo<CardMetadataItem[]>(() => {
    const list: CardMetadataItem[] = [];

    if (dateText) {
      list.push({ key: 'due-date', icon: Clock3, label: 'Due date', text: dateText });
    }
    if (hasDesc) {
      list.push({ key: 'description', icon: AlignLeft, label: 'Has description', text: '' });
    }
    if (comments > 0) {
      list.push({ key: 'comments', icon: MessageSquare, label: `${comments} comments`, text: String(comments) });
    }
    if (attachments > 0) {
      list.push({ key: 'attachments', icon: Paperclip, label: `${attachments} attachments`, text: String(attachments) });
    }
    if (subtaskTotal > 0) {
      list.push({
        key: 'subtasks',
        icon: CheckSquare,
        label: `${subtaskDone}/${subtaskTotal} subtasks completed`,
        text: `${subtaskDone}/${subtaskTotal}`,
      });
    }

    const isBlocked = Array.isArray(card.relations) && card.relations.some((relation) => relation.type === 'blocked_by');
    if (isBlocked) {
      list.push({
        key: 'blocked',
        icon: ShieldAlert,
        label: 'Blocked by dependencies',
        text: 'Blocked',
      });
    }

    const subCount = card.subtaskCount ?? (card.subtasks?.length ?? 0);
    const subDone = card.subtaskCompletedCount ?? (card.subtasks?.filter((subtask: any) => subtask.completed || subtask.columnId === 'done').length ?? 0);
    if (subCount > 0) {
      list.push({
        key: 'subtasks',
        icon: GitBranch,
        label: `${subDone}/${subCount} subtasks completed`,
        text: `${subDone}/${subCount}`,
      });
    }

    if (card.priority && card.priority !== 'none') {
      const priorityIcons: Record<string, any> = {
        urgent: AlertCircle,
        high: ArrowUp,
        medium: Minus,
        low: ArrowDown,
      };
      const Icon = priorityIcons[card.priority];
      if (Icon) {
        list.push({
          key: 'priority',
          icon: Icon,
          label: `Priority: ${card.priority}`,
          text: card.priority.charAt(0).toUpperCase() + card.priority.slice(1),
        });
      }
    }

    return list;
  }, [
    dateText,
    hasDesc,
    comments,
    attachments,
    subtaskTotal,
    subtaskDone,
    card.subtaskCount,
    card.subtaskCompletedCount,
    card.subtasks,
    card.priority,
    card.relations,
  ]);

  const toggleLabels = useCallback(() => setShowLabels((prev) => !prev), []);

  const state = {
    dates: { start: startDate, due: dueDate, display: dateText, hasDue, isOverdue },
    counts: { comments, attachments, subtaskTotal, subtaskDone },
    labels,
    assignee: { user, initials, isCurrentUser, avatar },
    hasDescription: hasDesc,
    showLabelDetails: showLabels,
    metadataItems,
    isBlocked: Array.isArray(card.relations) && card.relations.some((relation) => relation.type === 'blocked_by'),
    status: {
      isCompleted: card.columnId === 'done',
      isReadOnly,
    },
  };

  const actions = {
    setShowLabelDetails: setShowLabels,
    toggleLabelDetails: toggleLabels,
    toggleLabels,
    edit: useCallback(() => onEdit?.(card), [onEdit, card]),
    duplicate: useCallback(() => onDuplicate?.(card), [onDuplicate, card]),
    remove: useCallback(() => onDelete?.(card), [onDelete, card]),
    delete: useCallback(() => onDelete?.(card), [onDelete, card]),
    join: useCallback(() => onJoin?.(card), [onJoin, card]),
    leave: useCallback(() => onLeave?.(card), [onLeave, card]),
    removeFromCycle: useCallback(() => onRemoveFromCycle?.(card), [onRemoveFromCycle, card]),
  };

  return { state, actions };
}
