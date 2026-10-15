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

import type { Item, Column } from '@/features/projects/project-id/work-items/types/work-item.types';
import type {
  ItemCardLabel,
  CardMetadataItem,
  UseKanbanOptions,
  UseCardOptions,
} from '@/features/projects/project-id/work-items/types/kanban-view.types';
import { resolveColumnId, getItemBucketKey } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { ItemHelpers } from '@/features/projects/project-id/work-items/utils/work-item.utils';

export type {
  ItemCardLabel,
  CardMetadataItem,
  UseKanbanOptions,
  UseCardOptions,
};

export function useKanban({
  items: propItems,
  workItems: propWorkItems,
  columns = [],
  onMoveCard,
  onReorderCard,
  isReadOnly = false,
  subGroupBy = 'none',
  groupBy = 'state',
  itemsByColumnId: propItemsByColumnId,
}: UseKanbanOptions) {
  const items = propItems || propWorkItems || [];
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
        .map((column) => resolveColumnId(column))
        .filter((id): id is string => Boolean(id)),
    );
  }, [columns]);

  const itemsByColumn = useMemo(() => {
    if (propItemsByColumnId && propItemsByColumnId.size > 0) {
      return propItemsByColumnId;
    }
    const map = new Map<string, Item[]>();
    for (const column of columns) {
      const columnId = resolveColumnId(column);
      if (columnId) map.set(columnId, []);
    }
    for (const item of items) {
      const bucketKey = getItemBucketKey(item, groupBy);
      if (bucketKey && map.has(bucketKey)) {
        map.get(bucketKey)!.push(item);
      } else if (item.columnId && map.has(item.columnId)) {
        map.get(item.columnId)!.push(item);
      }
    }
    return map;
  }, [items, columns, groupBy, propItemsByColumnId]);

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return items.find((item) => item.id === activeId) ?? null;
  }, [activeId, items]);

  const dragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const dragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || isReadOnly) return;

      const activeItemId = String(active.id);
      const overId = String(over.id);

      let targetColumnId: string | null = null;
      let targetLaneId: string | null = null;
      let isOverCard = false;

      if (validColumnIds.has(overId)) {
        targetColumnId = overId;
      } else if (overId.includes(':::')) {
        const parts = overId.split(':::');
        targetLaneId = parts[0];
        targetColumnId = parts[1];
      } else {
        const overItem = items.find((item) => item.id === overId);
        if (overItem) {
          targetColumnId = getItemBucketKey(overItem, groupBy) || overItem.columnId || null;
          isOverCard = true;
          if (subGroupBy && subGroupBy !== 'none') {
            if (subGroupBy === 'priority') {
              targetLaneId = (overItem.priority || 'none').toLowerCase();
            } else if (subGroupBy === 'assignee') {
              targetLaneId = ItemHelpers.resolveAssigneeId(overItem) || '__unassigned__';
            } else if (subGroupBy === 'labels') {
              const firstLbl = (overItem.labels && overItem.labels.length > 0) ? overItem.labels[0] : null;
              const lbl = firstLbl as { name?: string; id?: string } | null;
              targetLaneId = firstLbl ? (typeof firstLbl === 'string' ? firstLbl : lbl?.name || lbl?.id || '__no_label__') : '__no_label__';
            }
          }
        }
      }

      if (!targetColumnId) return;

      if (targetLaneId) {
        if (onMoveCard) {
          onMoveCard(activeItemId, targetColumnId, { subGroupBy, laneId: targetLaneId });
        }
        return;
      }

      if (isOverCard && onReorderCard) {
        if (activeItemId === overId) return;
        const columnCards = itemsByColumn.get(targetColumnId) || [];
        const overIndex = columnCards.findIndex((item) => item.id === overId);
        if (overIndex !== -1) {
          onReorderCard(activeItemId, targetColumnId, overIndex);
          return;
        }
      }

      if (onMoveCard) {
        onMoveCard(activeItemId, targetColumnId);
      }
    },
    [validColumnIds, isReadOnly, items, itemsByColumn, onMoveCard, onReorderCard, subGroupBy],
  );

  const dragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const state = useMemo(
    () => ({
      activeId,
      activeItem,
      activeWorkItem: activeItem,
      itemsByColumn,
      workItemsByColumn: itemsByColumn,
      sensors,
    }),
    [activeId, activeItem, itemsByColumn, sensors]
  );

  const actions = useMemo(
    () => ({
      dragStart,
      dragEnd,
      dragCancel,
    }),
    [dragStart, dragEnd, dragCancel]
  );

  return { state, actions };
}

// ── 4. Card Presentation Controller (useCard) ────────────────────────────────

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
  isReadOnly = false,
}: UseCardOptions) {
  const [showLabels, setShowLabels] = useState(false);
  const toggleLabels = useCallback(() => setShowLabels((prev) => !prev), []);

  const priorityMeta = useMemo(() => {
    switch (card.priority) {
      case 'urgent':
        return { label: 'Urgent', icon: AlertCircle, colorClass: 'text-destructive' };
      case 'high':
        return { label: 'High', icon: ArrowUp, colorClass: 'text-warning' };
      case 'medium':
        return { label: 'Medium', icon: Minus, colorClass: 'text-muted-foreground' };
      case 'low':
        return { label: 'Low', icon: ArrowDown, colorClass: 'text-muted-foreground' };
      default:
        return { label: 'No Priority', icon: Minus, colorClass: 'text-muted-foreground' };
    }
  }, [card.priority]);

  const dates = useMemo(() => {
    const rawCard = card as Item & { due_date?: string; start_date?: string };
    const rawDue = rawCard.dueDate || rawCard.due_date;
    const rawStart = rawCard.startDate || rawCard.start_date;
    if (!rawDue && !rawStart) return { display: null, isOverdue: false };

    const due = rawDue ? new Date(rawDue) : null;
    const isOverdue = due ? due.getTime() < Date.now() && card.columnId !== 'done' : false;
    const display = due ? ItemHelpers.formatDate(due) : null;

    return { display, isOverdue };
  }, [card]);

  const cardObj = card as Item & {
    commentCount?: number;
    comments?: unknown[];
    attachmentCount?: number;
    subItems?: unknown[];
    children?: unknown[];
  };
  const comments = cardObj.commentCount ?? cardObj.comments?.length ?? 0;
  const attachments = cardObj.attachmentCount ?? (
    Array.isArray(card.attachments)
      ? card.attachments.length
      : ((card.attachments?.files?.length ?? 0) +
        ((card.attachments as { pages?: unknown[] })?.pages?.length ?? 0) +
        ((card.attachments as { papers?: unknown[] })?.papers?.length ?? 0) +
        ((card.attachments as { links?: unknown[] })?.links?.length ?? 0))
  );
  const childWorkItems = card.childWorkItems ?? cardObj.subItems ?? cardObj.children ?? [];
  const childWorkItemTotal = childWorkItems.length;
  const childWorkItemDone = childWorkItems.filter((st: unknown) => {
    const s = st as { completed?: boolean; stateGroup?: string; state?: { group?: string }; columnId?: string };
    return Boolean(s.completed || s.stateGroup === 'completed' || s.state?.group === 'completed' || s.columnId === 'done');
  }).length;

  const labels = useMemo(() => {
    const raw = card.labels || [];
    return raw.map((lbl: unknown) => {
      if (typeof lbl === 'string') {
        return labelMap?.get(lbl) || { id: lbl, name: lbl };
      }
      return lbl as { id?: string; name?: string; color?: string };
    });
  }, [card.labels, labelMap]);

  const assignee = card.assignee as ({ id?: string; name?: string; avatar?: string; fullName?: string; avatarUrl?: string }) | undefined;
  const user = assignee ? {
    id: assignee.id || (assignee as { userId?: string }).userId,
    name: assignee.name || assignee.fullName || 'Unassigned',
    avatar: assignee.avatar || assignee.avatarUrl || currentUserAvatar,
  } : null;

  const isCurrentUser = Boolean(user && currentUserId && user.id === currentUserId);
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : '??';

  const hasDesc = Boolean(card.description && card.description.trim().length > 0);

  const metadataItems = useMemo(() => {
    const items: CardMetadataItem[] = [];

    if (card.priority && card.priority !== 'none') {
      items.push({
        key: 'priority',
        icon: priorityMeta.icon,
        label: priorityMeta.label,
        text: priorityMeta.label,
      });
    }

    if (hasDesc) {
      items.push({
        key: 'description',
        icon: AlignLeft,
        label: 'Has description',
        text: '',
      });
    }

    if (childWorkItemTotal > 0) {
      items.push({
        key: 'childWorkItems',
        icon: CheckSquare,
        label: `${childWorkItemDone}/${childWorkItemTotal} sub-items`,
        text: `${childWorkItemDone}/${childWorkItemTotal}`,
      });
    }

    if (comments > 0) {
      items.push({
        key: 'comments',
        icon: MessageSquare,
        label: `${comments} comments`,
        text: String(comments),
      });
    }

    if (attachments > 0) {
      items.push({
        key: 'attachments',
        icon: Paperclip,
        label: `${attachments} attachments`,
        text: String(attachments),
      });
    }

    if (Array.isArray(card.relations) && card.relations.length > 0) {
      items.push({
        key: 'relations',
        icon: GitBranch,
        label: `${card.relations.length} relations`,
        text: String(card.relations.length),
      });
    }

    return items;
  }, [card.priority, priorityMeta, hasDesc, childWorkItemTotal, childWorkItemDone, comments, attachments, card.relations]);

  const isCompleted = Boolean(
    card.completed ||
    card.stateGroup === 'completed' ||
    card.state?.group === 'completed' ||
    card.columnId === 'done'
  );

  const isBlocked = useMemo(() => {
    return Array.isArray(card.relations) && card.relations.some((relation) => relation.type === 'blocked_by');
  }, [card.relations]);

  const assigneeData = useMemo(() => ({
    user,
    initials,
    isCurrentUser,
    avatar: user?.avatar,
  }), [user, initials, isCurrentUser]);

  const counts = useMemo(() => ({
    comments,
    attachments,
    childWorkItemTotal,
    childWorkItemDone,
  }), [comments, attachments, childWorkItemTotal, childWorkItemDone]);

  const status = useMemo(() => ({
    isCompleted,
    isReadOnly,
  }), [isCompleted, isReadOnly]);

  const state = useMemo(
    () => ({
      priority: priorityMeta,
      dates,
      counts,
      labels,
      assignee: assigneeData,
      hasDescription: hasDesc,
      showLabelDetails: showLabels,
      metadataItems,
      isBlocked,
      status,
    }),
    [
      priorityMeta,
      dates,
      counts,
      labels,
      assigneeData,
      hasDesc,
      showLabels,
      metadataItems,
      isBlocked,
      status,
    ]
  );

  const edit = useCallback(() => onEdit?.(card), [onEdit, card]);
  const duplicate = useCallback(() => onDuplicate?.(card), [onDuplicate, card]);
  const remove = useCallback(() => onDelete?.(card), [onDelete, card]);
  const join = useCallback(() => onJoin?.(card), [onJoin, card]);
  const leave = useCallback(() => onLeave?.(card), [onLeave, card]);

  const actions = useMemo(
    () => ({
      setShowLabelDetails: setShowLabels,
      toggleLabelDetails: toggleLabels,
      toggleLabels,
      edit,
      duplicate,
      remove,
      delete: remove,
      join,
      leave,
    }),
    [toggleLabels, edit, duplicate, remove, join, leave]
  );

  return { state, actions };
}


