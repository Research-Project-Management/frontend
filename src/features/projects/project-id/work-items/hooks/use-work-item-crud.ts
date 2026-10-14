'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CoreService } from '../api/work-item.api';
import type {
  Item,
  CreateItemInput,
  UpdateItemInput,
  ReorderItemInput,
  BulkUpdateItemInput,
  CreateSubItemInput,
} from '../types/work-item.types';
import {
  createItemSchema,
  updateItemSchema,
  reorderItemSchema,
  bulkUpdateItemSchema,
} from '../types/work-item.types';
import { resolveItemId } from '../utils/work-item.utils';
import { invalidateWorkItemRelatedQueries } from './use-work-items-query';

type ProjectItemsCache =
  | Item[]
  | ({ items?: Item[]; workItems?: Item[] } & Record<string, unknown>);

// ── CRUD Mutations ──────────────────────────────────────────────────────────

export const useCreateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateItemInput & { projectId: string }) => {
      const parsed = createItemSchema.safeParse(input);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || 'Invalid work item data';
        throw new Error(errorMsg);
      }
      return CoreService.create(input);
    },
    onSuccess: () => {
      toast.success('Work item created', { id: 'work-item-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create work item', { id: 'work-item-action' }),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
    },
  });
};

export const useCreateWorkItem = useCreateItem;

export const useUpdateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id?: string; itemId?: string; workItemId?: string; projectId?: string } & UpdateItemInput) => {
      const parsed = updateItemSchema.safeParse(data);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || 'Invalid work item update';
        throw new Error(errorMsg);
      }
      return CoreService.update(data);
    },
    onMutate: async (data) => {
      const targetId = (data.id || data.itemId || data.workItemId) ?? '';
      if (!targetId) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      const rawDueDate: unknown = data.dueDate;
      const formattedDueDate = rawDueDate instanceof Date ? rawDueDate.toISOString() : data.dueDate;
      const rawStartDate = (data as { startDate?: unknown }).startDate;
      const formattedStartDate = rawStartDate instanceof Date ? rawStartDate.toISOString() : (typeof rawStartDate === 'string' ? rawStartDate : undefined);

      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) => {
        if (!old) return old;
        const updateList = (list?: Item[]): Item[] | undefined => {
          if (!Array.isArray(list)) return list;
          return list.map((item) => {
            if (resolveItemId(item) === targetId) {
              return {
                ...item,
                ...data,
                assignee: typeof data.assignee === 'object' ? data.assignee : item.assignee,
                ...(data.columnId && { columnId: data.columnId, stateId: data.columnId }),
                ...(data.priority && { priority: data.priority }),
                ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
                ...(formattedDueDate !== undefined && { dueDate: formattedDueDate }),
                ...(formattedStartDate !== undefined && { startDate: formattedStartDate }),
              };
            }
            return item;
          });
        };

        if (Array.isArray(old)) {
          return updateList(old);
        }

        return {
          ...old,
          ...(old.items ? { items: updateList(old.items) } : {}),
          ...(old.workItems ? { workItems: updateList(old.workItems) } : {}),
        };
      });

      return { previousQueries };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || 'Failed to update work item', { id: 'work-item-action' });
    },
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
    },
  });
};

export const useUpdateWorkItem = useUpdateItem;

export const useDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      workItemId,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      projectId?: string;
    }) => CoreService.delete((id || workItemId) ?? ''),
    onMutate: async ({ id, workItemId }) => {
      const targetId = (id || workItemId) ?? '';
      if (!targetId) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) => {
        if (!old) return old;
        const filterList = (list?: Item[]) => {
          if (!Array.isArray(list)) return list;
          return list.filter((item) => resolveItemId(item) !== targetId);
        };

        if (Array.isArray(old)) {
          return filterList(old) || [];
        }

        const oldObj = old as { items?: Item[]; workItems?: Item[] } & Record<string, unknown>;
        return {
          ...oldObj,
          ...(Array.isArray(oldObj.items) ? { items: filterList(oldObj.items) } : {}),
          ...(Array.isArray(oldObj.workItems) ? { workItems: filterList(oldObj.workItems) } : {}),
        };
      });

      return { previousQueries };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || 'Failed to delete work item', { id: 'work-item-action' });
    },
    onSuccess: () => {
      toast.success('Work item deleted', { id: 'work-item-action' });
    },
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
    },
  });
};

export const useDeleteWorkItem = useDeleteItem;

export const useDuplicateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; itemId?: string; workItemId?: string; projectId: string }) =>
      CoreService.duplicate({
        id: vars.id || vars.workItemId || vars.itemId,
        workItemId: vars.id || vars.workItemId || vars.itemId,
        itemId: vars.id || vars.workItemId || vars.itemId,
        projectId: vars.projectId,
      }),
    onSuccess: () => {
      toast.success('Work item duplicated', { id: 'work-item-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to duplicate work item', { id: 'work-item-action' }),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
    },
  });
};

export const useDuplicateWorkItem = useDuplicateItem;

export const useBulkUpdate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: BulkUpdateItemInput) => {
      const parsed = bulkUpdateItemSchema.safeParse(vars);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid bulk update data');
      }
      return CoreService.bulkUpdate(vars);
    },
    onMutate: async (vars) => {
      const targetIds = new Set(vars.ids || vars.itemIds || vars.workItemIds || []);
      if (targetIds.size === 0) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) => {
        if (!old) return old;
        const updateList = (list?: Item[]): Item[] | undefined => {
          if (!Array.isArray(list)) return list;
          const patch = vars.data || {};
          return list.map((item) => {
            if (targetIds.has(resolveItemId(item))) {
              return {
                ...item,
                ...patch,
                assignee: typeof patch.assignee === 'object' ? patch.assignee : item.assignee,
              };
            }
            return item;
          });
        };

        if (Array.isArray(old)) {
          return updateList(old);
        }

        return {
          ...old,
          ...(old.items ? { items: updateList(old.items) } : {}),
          ...(old.workItems ? { workItems: updateList(old.workItems) } : {}),
        };
      });

      return { previousQueries };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || 'Failed to update work items', { id: 'work-item-bulk' });
    },
    onSuccess: (_, vars) => {
      const count = vars.ids?.length || vars.itemIds?.length || vars.workItemIds?.length || 0;
      if (count > 0) {
        toast.success(`Updated ${count} items`, { id: 'work-item-bulk' });
      } else {
        toast.success('Work items updated', { id: 'work-item-bulk' });
      }
    },
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, (variables as { projectId?: string } | undefined)?.projectId);
    },
  });
};

export const useBulkUpdateItems = useBulkUpdate;
export const useBulkUpdateWorkItems = useBulkUpdate;

export const useBulkDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ids,
      itemIds,
      workItemIds,
      projectId,
    }: {
      ids?: string[];
      itemIds?: string[];
      workItemIds?: string[];
      projectId?: string;
    }) =>
      CoreService.bulkDelete({
        ids: ids || itemIds || workItemIds,
        itemIds: ids || itemIds || workItemIds,
        workItemIds: ids || itemIds || workItemIds,
        projectId,
      }),
    onMutate: async ({ ids, itemIds, workItemIds }) => {
      const targetIds = new Set(ids || itemIds || workItemIds || []);
      if (targetIds.size === 0) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) => {
        if (!old) return old;
        const filterList = (list?: Item[]) => {
          if (!Array.isArray(list)) return list;
          return list.filter((item) => !targetIds.has(resolveItemId(item)));
        };

        if (Array.isArray(old)) {
          return filterList(old);
        }

        return {
          ...old,
          ...(old.items ? { items: filterList(old.items) } : {}),
          ...(old.workItems ? { workItems: filterList(old.workItems) } : {}),
        };
      });

      return { previousQueries };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || 'Failed to delete work items', { id: 'work-item-bulk' });
    },
    onSuccess: () => {
      toast.success('Work items deleted', { id: 'work-item-bulk' });
    },
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
    },
  });
};

export const useBulkDeleteItems = useBulkDelete;
export const useBulkDeleteWorkItems = useBulkDelete;

export const useCreateSubItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      projectId: _projectId,
      ...data
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      projectId?: string;
    } & CreateSubItemInput) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return CoreService.createSubItem(targetId, data);
    },
    onSuccess: () => {
      toast.success('Sub-item created', { id: 'work-item-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create sub-item', { id: 'work-item-action' }),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, (variables as { projectId?: string } | undefined)?.projectId);
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });
};

export const useCreateSubWorkItem = useCreateSubItem;

export const useConvertSubItemToRoot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      projectId: _projectId,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      projectId?: string;
    }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return CoreService.convertToRoot(targetId);
    },
    onSuccess: () => {
      toast.success('Converted to top-level item', { id: 'work-item-action' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to convert to top-level item', { id: 'work-item-action' }),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, (variables as { projectId?: string } | undefined)?.projectId);
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });
};

export const useConvertSubWorkItemToRoot = useConvertSubItemToRoot;

export const useReorderItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: ReorderItemInput) => {
      const parsed = reorderItemSchema.safeParse(vars);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid reorder data');
      }
      return CoreService.reorder(vars);
    },
    onMutate: async (vars) => {
      const targetId = (vars.workItemId || vars.id) ?? '';
      if (!targetId) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) => {
        if (!old) return old;
        const updateList = (list?: Item[]) => {
          if (!Array.isArray(list)) return list;
          return list.map((item) => {
            if (resolveItemId(item) === targetId) {
              return {
                ...item,
                ...(vars.columnId && { columnId: vars.columnId, stateId: vars.columnId }),
                ...(vars.rank !== undefined && { rank: vars.rank }),
              };
            }
            return item;
          });
        };

        if (Array.isArray(old)) {
          return updateList(old);
        }

        return {
          ...old,
          ...(old.items ? { items: updateList(old.items) } : {}),
          ...(old.workItems ? { workItems: updateList(old.workItems) } : {}),
        };
      });

      return { previousQueries };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error(error.message || 'Failed to reorder work item', { id: 'work-item-reorder' });
    },
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, (variables as { projectId?: string } | undefined)?.projectId);
    },
  });
};

export const useReorderWorkItem = useReorderItem;

export const useSubItemNotification = () => {
  const notifySubItemAdded = useCallback((count: number = 1) => {
    toast.success(count === 1 ? 'Sub-item added' : `${count} sub-items added`, { id: 'work-item-action' });
  }, []);
  return { notifySubItemAdded };
};

export const useCopyItemText = () => {
  return useCallback((itemOrText: Partial<Item> | string, message?: string) => {
    let text = '';
    if (typeof itemOrText === 'string') {
      text = itemOrText;
    } else if (itemOrText && typeof itemOrText === 'object') {
      text = `${itemOrText.identifier ? `[${itemOrText.identifier}] ` : ''}${itemOrText.title || ''}`;
    }
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => {
      toast.success(message || 'Copied to clipboard', { id: 'work-item-clipboard' });
    });
  }, []);
};

export const useCopyWorkItemText = useCopyItemText;
