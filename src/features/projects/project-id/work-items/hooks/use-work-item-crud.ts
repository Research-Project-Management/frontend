'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CoreService } from '@/features/projects/project-id/work-items/api/work-item.api';
import type {
  Item,
  CreateItemInput,
  UpdateItemInput,
  ReorderItemInput,
  BulkUpdateItemInput,
  CreateSubItemInput,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import {
  createItemSchema,
  updateItemSchema,
  reorderItemSchema,
  bulkUpdateItemSchema,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import { resolveItemId } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { invalidateWorkItemRelatedQueries } from './use-work-items-query';
import { workItemToast, type WorkItemToastScope } from './use-work-item-toast';

type ProjectItemsCache =
  | Item[]
  | ({ items?: Item[]; workItems?: Item[] } & Record<string, unknown>);

function applyOptimisticItemsUpdate(
  old: ProjectItemsCache | undefined,
  updater: (items: Item[]) => Item[],
): ProjectItemsCache | undefined {
  if (!old) return old;
  if (Array.isArray(old)) {
    return updater(old);
  }
  return {
    ...old,
    ...(Array.isArray(old.items) ? { items: updater(old.items) } : {}),
    ...(Array.isArray(old.workItems) ? { workItems: updater(old.workItems) } : {}),
  };
}

interface OptimisticWorkItemMutationConfig<TVars, TResult> {
  mutationFn: (vars: TVars) => Promise<TResult>;
  getUpdater: (vars: TVars) => ((items: Item[]) => Item[]) | null;
  getProjectId?: (vars: TVars) => string | undefined;
  errorMessage: string;
  toastScope: WorkItemToastScope;
  onSuccess?: (data: TResult, vars: TVars) => void;
}

function useOptimisticWorkItemMutation<TVars, TResult>({
  mutationFn,
  getUpdater,
  getProjectId,
  errorMessage,
  toastScope,
  onSuccess,
}: OptimisticWorkItemMutationConfig<TVars, TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      const updater = getUpdater(vars);
      if (!updater) return;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['work-items'] }),
        queryClient.cancelQueries({ queryKey: ['your-work'] }),
      ]);

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({
        queryKey: ['work-items'],
      });

      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) =>
        applyOptimisticItemsUpdate(old, updater),
      );

      return { previousQueries };
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      workItemToast.error(error, errorMessage, toastScope);
    },
    onSuccess,
    onSettled: (_data, _error, variables) => {
      const projectId = getProjectId?.(variables);
      invalidateWorkItemRelatedQueries(queryClient, projectId);
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['work-items-analytics', projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
    },
  });
}

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
      workItemToast.success('Work item created', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to create work item', 'action'),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['work-items-analytics', variables.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
    },
  });
};

export const useCreateWorkItem = useCreateItem;

export const useUpdateItem = () =>
  useOptimisticWorkItemMutation({
    mutationFn: (
      data: { id?: string; itemId?: string; workItemId?: string; projectId?: string } & UpdateItemInput,
    ) => {
      const parsed = updateItemSchema.safeParse(data);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || 'Invalid work item update';
        throw new Error(errorMsg);
      }
      return CoreService.update(data);
    },
    getUpdater: (data) => {
      const targetId = (data.id || data.itemId || data.workItemId) ?? '';
      if (!targetId) return null;

      const rawDueDate: unknown = data.dueDate;
      const formattedDueDate =
        rawDueDate instanceof Date ? rawDueDate.toISOString() : data.dueDate;
      const rawStartDate = (data as { startDate?: unknown }).startDate;
      const formattedStartDate =
        rawStartDate instanceof Date
          ? rawStartDate.toISOString()
          : typeof rawStartDate === 'string'
          ? rawStartDate
          : undefined;

      return (list: Item[]) =>
        list.map((item) => {
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
    },
    getProjectId: (vars) => vars?.projectId,
    errorMessage: 'Failed to update work item',
    toastScope: 'action',
  });

export const useUpdateWorkItem = useUpdateItem;

export const useDeleteItem = () =>
  useOptimisticWorkItemMutation({
    mutationFn: ({
      id,
      workItemId,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      projectId?: string;
    }) => CoreService.delete((id || workItemId) ?? ''),
    getUpdater: ({ id, workItemId }) => {
      const targetId = (id || workItemId) ?? '';
      if (!targetId) return null;
      return (list: Item[]) => list.filter((item) => resolveItemId(item) !== targetId);
    },
    getProjectId: (vars) => vars?.projectId,
    errorMessage: 'Failed to delete work item',
    toastScope: 'action',
    onSuccess: () => {
      workItemToast.success('Work item deleted', 'action');
    },
  });

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
      workItemToast.success('Work item duplicated', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to duplicate work item', 'action'),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
    },
  });
};

export const useDuplicateWorkItem = useDuplicateItem;

export type BulkUpdateVariables = BulkUpdateItemInput & {
  quiet?: boolean;
  successMessage?: string;
};

export const useBulkUpdate = () =>
  useOptimisticWorkItemMutation({
    mutationFn: (vars: BulkUpdateVariables) => {
      const { quiet: _quiet, successMessage: _successMessage, ...payload } = vars;
      const parsed = bulkUpdateItemSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid bulk update data');
      }
      return CoreService.bulkUpdate(payload);
    },
    getUpdater: (vars) => {
      const targetIds = new Set(vars.ids || vars.itemIds || vars.workItemIds || []);
      if (targetIds.size === 0) return null;
      const patch = vars.data || {};
      return (list: Item[]) =>
        list.map((item) => {
          if (targetIds.has(resolveItemId(item))) {
            return {
              ...item,
              ...patch,
              assignee: typeof patch.assignee === 'object' ? patch.assignee : item.assignee,
            };
          }
          return item;
        });
    },
    getProjectId: (vars) => (vars as { projectId?: string } | undefined)?.projectId,
    errorMessage: 'Failed to update work items',
    toastScope: 'bulk',
    onSuccess: (_data, vars) => {
      if (vars.quiet) {
        workItemToast.dismiss('bulk');
        return;
      }
      if (vars.successMessage) {
        workItemToast.success(vars.successMessage, 'bulk');
        return;
      }
      const count = vars.ids?.length || vars.itemIds?.length || vars.workItemIds?.length || 0;
      workItemToast.success(count > 0 ? `Updated ${count} items` : 'Work items updated', 'bulk');
    },
  });

export const useBulkUpdateItems = useBulkUpdate;
export const useBulkUpdateWorkItems = useBulkUpdate;

export const useBulkDelete = () =>
  useOptimisticWorkItemMutation({
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
    getUpdater: ({ ids, itemIds, workItemIds }) => {
      const targetIds = new Set(ids || itemIds || workItemIds || []);
      if (targetIds.size === 0) return null;
      return (list: Item[]) => list.filter((item) => !targetIds.has(resolveItemId(item)));
    },
    getProjectId: (vars) => vars?.projectId,
    errorMessage: 'Failed to delete work items',
    toastScope: 'bulk',
    onSuccess: () => {
      workItemToast.success('Work items deleted', 'bulk');
    },
  });

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
      workItemToast.success('Sub-item created', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to create sub-item', 'action'),
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
      workItemToast.success('Converted to top-level item', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to convert to top-level item', 'action'),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, (variables as { projectId?: string } | undefined)?.projectId);
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
  });
};

export const useConvertSubWorkItemToRoot = useConvertSubItemToRoot;

export const useReorderItem = () =>
  useOptimisticWorkItemMutation({
    mutationFn: (vars: ReorderItemInput) => {
      const parsed = reorderItemSchema.safeParse(vars);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid reorder data');
      }
      return CoreService.reorder(vars);
    },
    getUpdater: (vars) => {
      const targetId = (vars.workItemId || vars.id) ?? '';
      if (!targetId) return null;
      return (list: Item[]) =>
        list.map((item) => {
          if (resolveItemId(item) === targetId) {
            return {
              ...item,
              ...(vars.columnId && { columnId: vars.columnId, stateId: vars.columnId }),
              ...(vars.rank !== undefined && { rank: vars.rank }),
            };
          }
          return item;
        });
    },
    getProjectId: (vars) => (vars as { projectId?: string } | undefined)?.projectId,
    errorMessage: 'Failed to reorder work item',
    toastScope: 'reorder',
  });

export const useReorderWorkItem = useReorderItem;

export const useSubItemNotification = () => {
  const notifySubItemAdded = useCallback((count: number = 1) => {
    workItemToast.success(count === 1 ? 'Sub-item added' : `${count} sub-items added`, 'action');
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
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          workItemToast.success(message || 'Copied to clipboard', 'clipboard');
        })
        .catch(() => {
          try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            workItemToast.success(message || 'Copied to clipboard', 'clipboard');
          } catch {
            workItemToast.error('Could not copy to clipboard', 'clipboard');
          }
        });
    } else {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        workItemToast.success(message || 'Copied to clipboard', 'clipboard');
      } catch {
        workItemToast.error('Clipboard access unavailable', 'clipboard');
      }
    }
  }, []);
};

