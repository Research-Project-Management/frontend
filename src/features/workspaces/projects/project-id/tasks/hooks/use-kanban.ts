'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions,
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
  type LucideIcon,
} from 'lucide-react';
import type { Task, Column } from '../types/task.types';
import { resolveTaskColumnId } from '../types/task.types';
import { TaskHelpers } from './use-task';

export type TaskCardLabel = {
  _id: string;
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
  onMoveCard?: (cardId: string, targetColId: string) => void;
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

  const validColIds = useMemo(() => {
    return new Set(
      columns
        .map((c) => resolveTaskColumnId(c))
        .filter((id): id is string => Boolean(id)),
    );
  }, [columns]);

  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columns) {
      const colId = resolveTaskColumnId(col);
      if (colId) map.set(colId, []);
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
    return tasks.find((t) => t._id === activeId) ?? null;
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

      let targetColId: string | null = null;
      if (validColIds.has(overId)) {
        targetColId = overId;
      } else {
        const overTask = tasks.find((t) => t._id === overId);
        if (overTask?.columnId && validColIds.has(overTask.columnId)) {
          targetColId = overTask.columnId;
        }
      }

      if (!targetColId) return;

      const currentTask = tasks.find((t) => t._id === activeTaskId);
      if (currentTask && currentTask.columnId !== targetColId) {
        onMoveCard?.(activeTaskId, targetColId);
      }
    },
    [tasks, validColIds, onMoveCard, isReadOnly],
  );

  const dragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const moveTask = useCallback(
    (taskId: string, targetColId: string) => {
      if (isReadOnly || !validColIds.has(targetColId)) return;
      onMoveCard?.(taskId, targetColId);
    },
    [isReadOnly, validColIds, onMoveCard],
  );

  const getColTasks = useCallback(
    (colId: string) => tasksByColumn.get(colId) ?? [],
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
    if (card.dueState === 'overdue' || card.isOverdue === true) return true;
    return TaskHelpers.checkOverdue(card.dueDate);
  }, [card.dueState, card.isOverdue, card.dueDate]);

  const hasDesc = Boolean(card.description?.trim() || card.content?.trim());
  const comments = card.commentCount ?? 0;
  const attachments = Array.isArray(card.attachments) ? card.attachments.length : 0;
  const checklists = Array.isArray(card.checklists) ? card.checklists : [];
  const checkTotal = checklists.reduce((acc, c) => acc + (Array.isArray(c?.items) ? c.items.length : 0), 0);
  const checkDone = checklists.reduce((acc, c) => acc + (Array.isArray(c?.items) ? c.items.filter((i: any) => i?.completed).length : 0), 0);

  const labels = useMemo(() => {
    return (card.labels || [])
      .map((id: string) => labelMap?.get(id))
      .filter(Boolean)
      .map((t) => ({ id: t!._id, color: t!.color, title: t!.name }))
      .filter((l) => Boolean(l.color));
  }, [card.labels, labelMap]);

  const user = card.assigneeId;
  const initials = useMemo(() => (user ? TaskHelpers.getInitials(user.name) : ''), [user]);
  const isCurrentUser = Boolean(currentUserId && user?._id === currentUserId);
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
    if (checkTotal > 0) {
      list.push({
        key: 'checklists',
        icon: CheckSquare,
        label: `${checkDone}/${checkTotal} checklist items completed`,
        text: `${checkDone}/${checkTotal}`,
      });
    }
    const subCount = card.subtaskCount ?? (card.subtasks?.length ?? 0);
    const subDone = card.subtaskCompletedCount ?? (card.subtasks?.filter((s: any) => s.completed || s.columnId === 'done').length ?? 0);
    if (subCount > 0) {
      list.push({
        key: 'subtasks',
        icon: GitBranch,
        label: `${subDone}/${subCount} subtasks completed`,
        text: `${subDone}/${subCount}`,
      });
    }

    if (card.priority && card.priority !== 'none') {
      const pIcons: Record<string, any> = {
        urgent: AlertCircle,
        high: ArrowUp,
        medium: Minus,
        low: ArrowDown,
      };
      const PIcon = pIcons[card.priority] || Minus;
      list.push({
        key: 'priority',
        icon: PIcon,
        label: `Priority: ${card.priority}`,
        text: card.priority.toUpperCase(),
      });
    }

    return list;
  }, [dateText, hasDesc, comments, attachments, checkTotal, checkDone, card.subtaskCount, card.subtaskCompletedCount, card.subtasks, card.priority]);

  const toggleLabels = useCallback(() => setShowLabels((prev) => !prev), []);

  const state = {
    dates: { start: startDate, due: dueDate, display: dateText, hasDue, isOverdue },
    counts: { comments, attachments, checkTotal, checkDone },
    labels,
    assignee: { user, initials, isCurrentUser, avatar },
    hasDescription: hasDesc,
    showLabelDetails: showLabels,
    metadataItems,
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
