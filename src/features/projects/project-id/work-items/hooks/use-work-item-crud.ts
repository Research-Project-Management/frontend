'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '@/features/projects/project-id/work-items/api/work-item.api';
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
      return workItemApi.items.create(input);
    },
    onSuccess: (res, variables) => {
      const created = (res as { workItem?: Item; item?: Item } | undefined)?.workItem
        ?? (res as { workItem?: Item; item?: Item } | undefined)?.item
        ?? (res && typeof res === 'object' && 'id' in res ? (res as unknown as Item) : undefined);
      if (created && variables?.projectId) {
        const createdId = resolveItemId(created);
        queryClient.setQueriesData<ProjectItemsCache>(
          { queryKey: ['work-items', variables.projectId] },
          (old) =>
            applyOptimisticItemsUpdate(old, (list) => {
              if (createdId && list.some((i) => resolveItemId(i) === createdId)) {
                return list.map((i) => (resolveItemId(i) === createdId ? { ...i, ...created } : i));
              }
              return [...list, created];
            }),
        );
      }
      workItemToast.success('Work item created', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to create work item', 'action'),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
    },
  });
};

export const useCreateWorkItem = useCreateItem;

function applySingleItemPatch(
  item: Item,
  data: { id?: string; itemId?: string; workItemId?: string; projectId?: string } & UpdateItemInput,
  formattedDueDate: string | null | undefined,
  formattedStartDate: string | undefined,
): Item {
  let nextAssignee = typeof data.assignee === 'object' ? data.assignee : item.assignee;
  let nextAssignees = item.assignees;
  let nextAssigneeIds = item.assigneeIds;
  let nextAssigneeId = item.assigneeId;

  if (Array.isArray(data.assigneeIds)) {
    nextAssigneeIds = data.assigneeIds;
    nextAssigneeId = data.assigneeIds[0] ?? null;
    if (data.assigneeIds.length === 0) {
      nextAssignee = null;
      nextAssignees = [];
    } else if (Array.isArray(item.assignees)) {
      const idSet = new Set(data.assigneeIds);
      const filtered = item.assignees.filter((a) => idSet.has(String(a.id || '')));
      // Clear partial assignees array if new IDs were added so resolveAssignees resolves all from project members
      nextAssignees = filtered.length === data.assigneeIds.length ? filtered : [];
      if (nextAssignee && !idSet.has(String(nextAssignee.id || ''))) {
        nextAssignee = undefined;
      }
    }
  } else if (data.assigneeId !== undefined) {
    nextAssigneeId = data.assigneeId;
    if (data.assigneeId === null) {
      nextAssignee = null;
      nextAssignees = [];
      nextAssigneeIds = [];
    } else if (typeof data.assigneeId === 'string') {
      nextAssigneeIds = [data.assigneeId];
      if (typeof data.assignee !== 'object') {
        if (nextAssignee && String(nextAssignee.id || '') !== data.assigneeId) {
          nextAssignee = undefined;
        }
        nextAssignees = [];
      }
    }
  }

  return {
    ...item,
    ...data,
    assignee: nextAssignee,
    assignees: nextAssignees,
    assigneeIds: nextAssigneeIds,
    assigneeId: nextAssigneeId,
    ...(data.columnId && { columnId: data.columnId, stateId: data.columnId }),
    ...(data.priority && { priority: data.priority }),
    ...(formattedDueDate !== undefined && { dueDate: formattedDueDate }),
    ...(formattedStartDate !== undefined && { startDate: formattedStartDate }),
  };
}

export const useUpdateItem = () => {
  const queryClient = useQueryClient();
  return useOptimisticWorkItemMutation({
    mutationFn: (
      data: { id?: string; itemId?: string; workItemId?: string; projectId?: string } & UpdateItemInput,
    ) => {
      const parsed = updateItemSchema.safeParse(data);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || 'Invalid work item update';
        throw new Error(errorMsg);
      }
      return workItemApi.items.update(data);
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
          let nextItem = item;
          if (resolveItemId(item) === targetId) {
            nextItem = applySingleItemPatch(item, data, formattedDueDate, formattedStartDate);
          }
          const hasMatchingSub =
            (Array.isArray(nextItem.subItems) &&
              nextItem.subItems.some((s) => resolveItemId(s as unknown as Item) === targetId)) ||
            (Array.isArray(nextItem.childWorkItems) &&
              nextItem.childWorkItems.some((s) => resolveItemId(s) === targetId));

          if (hasMatchingSub) {
            const patchSubEntry = <T extends { id: string; title: string; completed: boolean; columnId: string }>(s: T): T => ({
              ...s,
              ...(data.title !== undefined && { title: data.title }),
              ...(data.completed !== undefined && { completed: data.completed }),
              ...(data.columnId !== undefined && { columnId: data.columnId }),
            });
            nextItem = {
              ...nextItem,
              ...(Array.isArray(nextItem.subItems)
                ? {
                    subItems: nextItem.subItems.map((s) =>
                      resolveItemId(s as unknown as Item) === targetId ? patchSubEntry(s) : s,
                    ),
                  }
                : {}),
              ...(Array.isArray(nextItem.childWorkItems)
                ? {
                    childWorkItems: nextItem.childWorkItems.map((s) =>
                      resolveItemId(s) === targetId ? patchSubEntry(s) : s,
                    ),
                  }
                : {}),
            };
          }
          return nextItem;
        });
    },
    getProjectId: (vars) => vars?.projectId,
    errorMessage: 'Failed to update work item',
    toastScope: 'action',
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      const serverItem = (res as { workItem?: Item; item?: Item } | undefined)?.workItem
        ?? (res as { workItem?: Item; item?: Item } | undefined)?.item;
      if (targetId && serverItem) {
        queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) =>
          applyOptimisticItemsUpdate(old, (list) =>
            list.map((item) =>
              resolveItemId(item) === targetId ? { ...item, ...serverItem } : item,
            ),
          ),
        );
      }
      if (targetId) {
        queryClient.invalidateQueries({ queryKey: ['work-item-activity', targetId] });
        if (vars.attachments !== undefined) {
          queryClient.invalidateQueries({ queryKey: ['work-items', targetId, 'attachments'] });
        }
      }
    },
  });
};

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
    }) => workItemApi.items.delete((id || workItemId) ?? ''),
    getUpdater: ({ id, workItemId }) => {
      const targetId = (id || workItemId) ?? '';
      if (!targetId) return null;
      return (list: Item[]) =>
        list
          .filter((item) => resolveItemId(item) !== targetId)
          .map((item) => {
            const hasSub =
              (Array.isArray(item.subItems) &&
                item.subItems.some((s) => resolveItemId(s as unknown as Item) === targetId)) ||
              (Array.isArray(item.childWorkItems) &&
                item.childWorkItems.some((s) => resolveItemId(s) === targetId));
            if (!hasSub) return item;
            return {
              ...item,
              ...(Array.isArray(item.subItems)
                ? {
                    subItems: item.subItems.filter(
                      (s) => resolveItemId(s as unknown as Item) !== targetId,
                    ),
                  }
                : {}),
              ...(Array.isArray(item.childWorkItems)
                ? {
                    childWorkItems: item.childWorkItems.filter(
                      (s) => resolveItemId(s) !== targetId,
                    ),
                  }
                : {}),
            };
          });
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
      workItemApi.items.duplicate({
        id: vars.id || vars.workItemId || vars.itemId,
        workItemId: vars.id || vars.workItemId || vars.itemId,
        itemId: vars.id || vars.workItemId || vars.itemId,
        projectId: vars.projectId,
      }),
    onSuccess: (res, variables) => {
      const duplicated = (res as { workItem?: Item; item?: Item } | undefined)?.workItem
        ?? (res as { workItem?: Item; item?: Item } | undefined)?.item
        ?? (res && typeof res === 'object' && 'id' in res ? (res as unknown as Item) : undefined);
      if (duplicated && variables?.projectId) {
        const dupId = resolveItemId(duplicated);
        queryClient.setQueriesData<ProjectItemsCache>(
          { queryKey: ['work-items', variables.projectId] },
          (old) =>
            applyOptimisticItemsUpdate(old, (list) => {
              if (dupId && list.some((i) => resolveItemId(i) === dupId)) {
                return list.map((i) => (resolveItemId(i) === dupId ? { ...i, ...duplicated } : i));
              }
              return [...list, duplicated];
            }),
        );
      }
      workItemToast.success('Work item duplicated', 'action');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to duplicate work item', 'action'),
    onSettled: (_data, _error, variables) => {
      invalidateWorkItemRelatedQueries(queryClient, variables?.projectId);
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
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
      return workItemApi.items.bulkUpdate(payload);
    },
    getUpdater: (vars) => {
      const targetIds = new Set(vars.ids || vars.itemIds || vars.workItemIds || []);
      if (targetIds.size === 0) return null;
      const patch = vars.data || {};
      const { addLabel, removeLabel, clearLabels, ...restPatch } = patch;
      return (list: Item[]) =>
        list.map((item) => {
          if (targetIds.has(resolveItemId(item))) {
            let nextLabels = Array.isArray(item.labels) ? [...item.labels] : [];
            if (clearLabels) {
              nextLabels = [];
            }
            if (removeLabel) {
              nextLabels = nextLabels.filter((l) => l !== removeLabel);
            }
            if (addLabel && !nextLabels.includes(addLabel)) {
              nextLabels.push(addLabel);
            }

            let nextAssignee = typeof patch.assignee === 'object' ? patch.assignee : item.assignee;
            let nextAssignees = item.assignees;
            let nextAssigneeIds = item.assigneeIds;
            let nextAssigneeId = item.assigneeId;

            if (patch.assigneeId !== undefined) {
              nextAssigneeId = patch.assigneeId;
              if (patch.assigneeId === null) {
                nextAssignee = null;
                nextAssignees = [];
                nextAssigneeIds = [];
              } else if (typeof patch.assigneeId === 'string') {
                nextAssigneeIds = [patch.assigneeId];
                nextAssignees = [];
                if (typeof patch.assignee !== 'object') {
                  nextAssignee = undefined;
                }
              }
            }

            return {
              ...item,
              ...restPatch,
              labels: nextLabels,
              assignee: nextAssignee,
              assignees: nextAssignees,
              assigneeIds: nextAssigneeIds,
              assigneeId: nextAssigneeId,
              ...(patch.columnId && { columnId: patch.columnId, stateId: patch.columnId }),
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
      workItemApi.items.bulkDelete({
        ids: ids || itemIds || workItemIds,
        itemIds: ids || itemIds || workItemIds,
        workItemIds: ids || itemIds || workItemIds,
        projectId,
      }),
    getUpdater: ({ ids, itemIds, workItemIds }) => {
      const targetIds = new Set(ids || itemIds || workItemIds || []);
      if (targetIds.size === 0) return null;
      return (list: Item[]) =>
        list
          .filter((item) => !targetIds.has(resolveItemId(item)))
          .map((item) => ({
            ...item,
            ...(Array.isArray(item.subItems)
              ? {
                  subItems: item.subItems.filter(
                    (s) => !targetIds.has(resolveItemId(s as unknown as Item)),
                  ),
                }
              : {}),
            ...(Array.isArray(item.childWorkItems)
              ? {
                  childWorkItems: item.childWorkItems.filter(
                    (s) => !targetIds.has(resolveItemId(s)),
                  ),
                }
              : {}),
          }));
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
      return workItemApi.items.createChild(targetId, data);
    },
    onSuccess: (res, variables) => {
      const parentId = (variables.id || variables.itemId || variables.workItemId) ?? '';
      const createdSub = (res as { subItem?: Item; workItem?: Item; item?: Item } | undefined)?.subItem
        ?? (res as { subItem?: Item; workItem?: Item; item?: Item } | undefined)?.workItem
        ?? (res as { subItem?: Item; workItem?: Item; item?: Item } | undefined)?.item;
      if (parentId && createdSub) {
        const subId = resolveItemId(createdSub);
        queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) =>
          applyOptimisticItemsUpdate(old, (list) => {
            const updatedList = list.map((item) => {
              if (resolveItemId(item) === parentId) {
                const prevSubs = Array.isArray(item.subItems) ? item.subItems : [];
                const prevChildren = Array.isArray(item.childWorkItems) ? item.childWorkItems : [];
                const alreadyInSubs = prevSubs.some(
                  (s) => resolveItemId(s as unknown as Item) === subId,
                );
                const alreadyInChildren = prevChildren.some((s) => resolveItemId(s) === subId);
                const subEntry = {
                  id: subId,
                  title: createdSub.title,
                  completed: Boolean(createdSub.completed),
                  columnId: createdSub.columnId,
                  rank: typeof createdSub.rank === 'number' ? createdSub.rank : prevSubs.length,
                };
                return {
                  ...item,
                  subItems: alreadyInSubs ? prevSubs : [...prevSubs, subEntry],
                  childWorkItems: alreadyInChildren ? prevChildren : [...prevChildren, subEntry],
                };
              }
              return item;
            });
            if (subId && !updatedList.some((i) => resolveItemId(i) === subId)) {
              return [
                ...updatedList,
                {
                  ...createdSub,
                  parentId,
                  parentWorkItemId: parentId,
                  parentItemId: parentId,
                },
              ];
            }
            return updatedList;
          }),
        );
      }
      if (parentId) {
        queryClient.invalidateQueries({ queryKey: ['work-item-activity', parentId] });
      }
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
      return workItemApi.items.convertToRoot(targetId);
    },
    onSuccess: (res, variables) => {
      const targetId = (variables.id || variables.itemId || variables.workItemId) ?? '';
      const serverItem = (res as { workItem?: Item; item?: Item } | undefined)?.workItem
        ?? (res as { workItem?: Item; item?: Item } | undefined)?.item;
      if (targetId) {
        queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) =>
          applyOptimisticItemsUpdate(old, (list) =>
            list.map((item) => {
              if (resolveItemId(item) === targetId) {
                return {
                  ...item,
                  ...(serverItem ?? {}),
                  parentId: null,
                  parentWorkItemId: null,
                  parentItemId: null,
                };
              }
              const hasSub =
                (Array.isArray(item.subItems) &&
                  item.subItems.some((s) => resolveItemId(s as unknown as Item) === targetId)) ||
                (Array.isArray(item.childWorkItems) &&
                  item.childWorkItems.some((s) => resolveItemId(s) === targetId));
              if (!hasSub) return item;
              return {
                ...item,
                ...(Array.isArray(item.subItems)
                  ? {
                      subItems: item.subItems.filter(
                        (s) => resolveItemId(s as unknown as Item) !== targetId,
                      ),
                    }
                  : {}),
                ...(Array.isArray(item.childWorkItems)
                  ? {
                      childWorkItems: item.childWorkItems.filter(
                        (s) => resolveItemId(s) !== targetId,
                      ),
                    }
                  : {}),
              };
            }),
          ),
        );
        queryClient.invalidateQueries({ queryKey: ['work-item-activity', targetId] });
      }
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
      return workItemApi.items.reorder(vars);
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

