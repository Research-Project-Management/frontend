'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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

import { ViewService, type SavedViewRecord } from '../services/view.service';
import type { Item, WorkItem, Column } from '../types/work-item.types';
import { resolveColumnId, resolveWorkItemColumnId, getItemBucketKey } from '../utils/work-item.utils';
import { ItemHelpers, WorkItemHelpers } from '../utils/work-item.utils';

// ── 1. Query Keys & Server State Hooks (matching backend view module) ───────────

export const viewKeys = {
  all: ['project-views'] as const,
  list: (projectId: string) => ['project-views', projectId] as const,
  detail: (projectId: string, viewId: string) => ['project-views', projectId, viewId] as const,
  favorites: (projectId: string) => ['project-views', projectId, 'favorites'] as const,
  workItems: (projectId: string, viewId: string) => ['project-views', projectId, viewId, 'work-items'] as const,
};

export function useViewsQuery(projectId: string) {
  return useQuery({
    queryKey: viewKeys.list(projectId),
    queryFn: () => ViewService.getViews(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useCreateViewMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      layout?: string;
      filters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      access?: 'public' | 'private';
    }) => ViewService.createView(projectId, data),
    onSuccess: (newView) => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(projectId) });
      toast.success(`Created view "${newView.name}"`, { id: 'work-item-view-action' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create view', { id: 'work-item-view-action' });
    },
  });
}

export function useUpdateViewMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      viewId,
      data,
    }: {
      viewId: string;
      data: Partial<{
        name: string;
        description?: string;
        layout?: string;
        filters?: Record<string, unknown>;
        displayProperties?: Record<string, unknown>;
        access?: 'public' | 'private';
      }>;
    }) => ViewService.updateView(projectId, viewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(projectId) });
      toast.success('View updated', { id: 'work-item-view-action' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update view', { id: 'work-item-view-action' });
    },
  });
}

export function useDeleteViewMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (viewId: string) => ViewService.deleteView(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(projectId) });
      toast.success('View deleted', { id: 'work-item-view-action' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete view', { id: 'work-item-view-action' });
    },
  });
}

export function useFavoriteViewMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (viewId: string) => ViewService.favorite(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: viewKeys.favorites(projectId) });
    },
  });
}

export function useUnfavoriteViewMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (viewId: string) => ViewService.unfavorite(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: viewKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: viewKeys.favorites(projectId) });
    },
  });
}

// ── 2. Card & Kanban Types ───────────────────────────────────────────────────

export type ItemCardLabel = {
  id: string;
  name: string;
  color?: string;
};

export type CardMetadataItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  text: string;
};

// ── 3. Kanban Board Controller (useKanban) ──────────────────────────────────

export interface UseKanbanOptions {
  items?: Item[];
  workItems?: Item[];
  columns: Column[];
  onMoveCard?: (cardId: string, targetColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onReorderCard?: (workItemId: string, targetColumnId: string, rank: number) => void;
  isReadOnly?: boolean;
  subGroupBy?: string;
  groupBy?: string;
  itemsByColumnId?: Map<string, Item[]>;
}

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
            } else if (subGroupBy === 'cycle') {
              targetLaneId = overItem.cycleId || '__no_cycle__';
            } else if (subGroupBy === 'labels') {
              targetLaneId = (overItem.labels && overItem.labels.length > 0) ? overItem.labels[0] : '__no_label__';
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

  return {
    state: {
      activeId,
      activeItem,
      activeWorkItem: activeItem,
      itemsByColumn,
      workItemsByColumn: itemsByColumn,
      sensors,
    },
    actions: {
      dragStart,
      dragEnd,
      dragCancel,
    },
  };
}

// ── 4. Card Presentation Controller (useCard) ────────────────────────────────

export interface UseCardOptions {
  card: Item;
  labelMap?: Map<string, ItemCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onEdit?: (card: Item) => void;
  onDuplicate?: (card: Item) => void;
  onDelete?: (card: Item) => void;
  onJoin?: (card: Item) => void;
  onLeave?: (card: Item) => void;
  onRemoveFromCycle?: (card: Item) => void;
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
  const toggleLabels = useCallback(() => setShowLabels((prev) => !prev), []);

  const priorityMeta = useMemo(() => {
    switch (card.priority) {
      case 'urgent':
        return { label: 'Urgent', icon: AlertCircle, colorClass: 'text-red-500' };
      case 'high':
        return { label: 'High', icon: ArrowUp, colorClass: 'text-orange-500' };
      case 'medium':
        return { label: 'Medium', icon: Minus, colorClass: 'text-yellow-500' };
      case 'low':
        return { label: 'Low', icon: ArrowDown, colorClass: 'text-blue-500' };
      default:
        return { label: 'No Priority', icon: Minus, colorClass: 'text-muted-foreground' };
    }
  }, [card.priority]);

  const dates = useMemo(() => {
    const rawDue = (card as any).dueDate || (card as any).due_date;
    const rawStart = (card as any).startDate || (card as any).start_date;
    if (!rawDue && !rawStart) return { display: null, isOverdue: false };

    const due = rawDue ? new Date(rawDue) : null;
    const isOverdue = due ? due.getTime() < Date.now() && card.columnId !== 'done' : false;
    const display = due ? due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;

    return { display, isOverdue };
  }, [card]);

  const comments = (card as any).commentCount ?? (card as any).comments?.length ?? 0;
  const attachments = (card as any).attachmentCount ?? (
    Array.isArray((card as any).attachments)
      ? (card as any).attachments.length
      : ((card as any).attachments?.files?.length ?? 0) +
        ((card as any).attachments?.pages?.length ?? 0) +
        ((card as any).attachments?.papers?.length ?? 0) +
        ((card as any).attachments?.links?.length ?? 0)
  );
  const childWorkItems = (card as any).childWorkItems ?? (card as any).subItems ?? (card as any).children ?? [];
  const childWorkItemTotal = childWorkItems.length;
  const childWorkItemDone = childWorkItems.filter((st: any) => st.completed || st.stateGroup === 'completed' || st.state?.group === 'completed' || st.columnId === 'done').length;

  const labels = useMemo(() => {
    const raw = card.labels || [];
    return raw.map((lbl: any) => {
      if (typeof lbl === 'string') {
        return labelMap?.get(lbl) || { id: lbl, name: lbl };
      }
      return lbl;
    });
  }, [card.labels, labelMap]);

  const assignee = (card as any).assignee;
  const user = assignee ? {
    id: assignee.id || assignee.userId,
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

  const state = {
    priority: priorityMeta,
    dates,
    counts: { comments, attachments, childWorkItemTotal, childWorkItemDone },
    labels,
    assignee: { user, initials, isCurrentUser, avatar: user?.avatar },
    hasDescription: hasDesc,
    showLabelDetails: showLabels,
    metadataItems,
    isBlocked: Array.isArray(card.relations) && card.relations.some((relation) => relation.type === 'blocked_by'),
    status: {
      isCompleted: Boolean(card.completed || (card as any).stateGroup === 'completed' || (card as any).state?.group === 'completed' || card.columnId === 'done'),
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

// ── Export aliases ───────────────────────────────────────────────────────────
export const useView = useViewsQuery;
export default useViewsQuery;
