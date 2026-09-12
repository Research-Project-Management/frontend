'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CoreService } from '../services/core.service';
import {
  projectKeys,
  fetchProject,
  fetchUserProjects,
} from '@/features/workspaces/projects/shell/services/project.service';
import type {
  Item,
  Column,
  Project,
  ProjectMember,
  Cycle,
  Priority,
  CreateItemInput,
  UpdateItemInput,
  ReorderItemInput,
  BulkUpdateItemInput,
  CreateSubItemInput,
  Label,
} from '../types/work-item.types';
import {
  DEFAULT_STATES,
} from '../types/work-item.types';
import { normalizeStates, resolveItemId } from '../utils/work-item.utils';
import {
  createItemSchema,
  updateItemSchema,
  reorderItemSchema,
  bulkUpdateItemSchema,
  createSubItemSchema,
  prioritySchema,
} from '../schemas/work-item.schema';
import type { AttachCenterData } from '../components/modals/Attachments';
import { useTaskCycles, useCycles } from './use-cycle';
import { useLabelsQuery } from './use-label';

// ── Query Keys ──────────────────────────────────────────────────────────────

export const itemKeys = {
  all: ['work-items'] as const,
  project: (projectId: string, cycleId?: string) => ['work-items', projectId, cycleId] as const,
  cycles: (projectId: string) => ['cycles', projectId] as const,
  comments: (id: string) => ['work-item-comments', id] as const,
  activity: (id: string) => ['work-item-activity', id] as const,
  labels: (scope: string, type?: string, projectId?: string) => ['labels', scope, type, projectId] as const,
};

export const workItemKeys = itemKeys;
export const taskKeys = {
  ...itemKeys,
  all: ['tasks'] as const,
  project: (projectId: string, cycleId?: string) => ['tasks', projectId, cycleId] as const,
  workspace: (_workspaceId?: string) => ['tasks'] as const,
  comments: (id: string) => ['task-comments', id] as const,
  activity: (id: string) => ['task-activity', id] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────────

export const useProjectItems = (projectId: string, cycleId?: string) =>
  useQuery({
    queryKey: itemKeys.project(projectId, cycleId),
    queryFn: () => CoreService.getProjectItems(projectId, cycleId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

export const useProjectWorkItems = useProjectItems;
export const useProjectTasks = useProjectItems;
export const useTask = useProjectItems;
export const useWorkItem = useProjectItems;
export const useItems = useProjectItems;

export const useAllItems = (_workspaceId?: string) =>
  useQuery({
    queryKey: itemKeys.all,
    queryFn: () => CoreService.getItems(),
    enabled: true,
  });

export const useAllWorkItems = useAllItems;
export const useWorkspaceTasks = useAllItems;

export const useProjectDetails = (projectId: string) =>
  useQuery({
    queryKey: ['project-details', projectId],
    queryFn: () => fetchProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });
export const useTaskProjectDetails = useProjectDetails;

export const useWorkspaceProjects = (workspaceId?: string) =>
  useQuery({
    queryKey: projectKeys.all(workspaceId || 'all'),
    queryFn: async () => {
      const res = await fetchUserProjects('all');
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'projects' in res && Array.isArray((res as { projects: unknown[] }).projects)) {
        return (res as { projects: unknown[] }).projects;
      }
      return [];
    },
    enabled: true,
  });
export const useTaskWorkspaceProjects = useWorkspaceProjects;

// ── Mutations ───────────────────────────────────────────────────────────────

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
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Work item created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create work item'),
  });
};

export const useCreateWorkItem = useCreateItem;
export const useCreateTask = useCreateItem;

type ProjectItemsCache = Record<string, any>;

export const useUpdateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id?: string; itemId?: string; workItemId?: string; taskId?: string; projectId?: string } & UpdateItemInput) => {
      const parsed = updateItemSchema.safeParse(data);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || 'Invalid work item update';
        throw new Error(errorMsg);
      }
      return CoreService.update(data);
    },
    onMutate: async (data) => {
      const targetId = (data.id || data.itemId || data.workItemId || data.taskId) ?? '';
      if (!targetId) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      const formattedDueDate = data.dueDate instanceof Date ? data.dueDate.toISOString() : data.dueDate;
      const formattedStartDate = (data as any).startDate instanceof Date ? (data as any).startDate.toISOString() : (data as any).startDate;

      queryClient.setQueriesData<any>({ queryKey: ['work-items'] }, (old: any) => {
        if (!old) return old;
        const updateList = (list?: any[]) => {
          if (!Array.isArray(list)) return list;
          return list.map((item) => {
            if (resolveItemId(item) === targetId) {
              return {
                ...item,
                ...data,
                ...(data.columnId && { columnId: data.columnId, stateId: data.columnId }),
                ...(data.priority && { priority: data.priority }),
                ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
                ...(formattedDueDate !== undefined && { dueDate: formattedDueDate }),
                ...(formattedStartDate !== undefined && { startDate: formattedStartDate }),
                ...(data.cycleId !== undefined && { cycleId: data.cycleId }),
              };
            }
            return item;
          });
        };

        return {
          ...old,
          items: updateList(old.items),
          tasks: updateList(old.tasks),
          workItems: updateList(old.workItems),
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
      toast.error(error.message || 'Failed to update work item');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useUpdateWorkItem = useUpdateItem;
export const useUpdateTask = useUpdateItem;

export const useDeleteItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      workItemId,
      taskId,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      taskId?: string;
      projectId?: string;
    }) => CoreService.delete((id || workItemId || taskId) ?? ''),
    onMutate: async ({ id, workItemId, taskId }) => {
      const targetId = (id || workItemId || taskId) ?? '';
      if (!targetId) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, (old) => {
        if (!old) return old;
        const filterList = (list?: Item[]) => {
          if (!Array.isArray(list)) return list;
          return list.filter((item) => resolveItemId(item) !== targetId);
        };

        return {
          ...old,
          items: filterList(old.items),
          tasks: filterList(old.tasks),
          workItems: filterList(old.workItems),
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
      toast.error(error.message || 'Failed to delete work item');
    },
    onSuccess: () => {
      toast.success('Work item deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useDeleteWorkItem = useDeleteItem;
export const useDeleteTask = useDeleteItem;

export const useDuplicateItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; itemId?: string; workItemId?: string; taskId?: string; projectId: string }) =>
      CoreService.duplicate({
        id: vars.id || vars.workItemId || vars.taskId,
        workItemId: vars.id || vars.workItemId || vars.taskId,
        taskId: vars.id || vars.workItemId || vars.taskId,
        projectId: vars.projectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Work item duplicated');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to duplicate work item'),
  });
};

export const useDuplicateWorkItem = useDuplicateItem;
export const useDuplicateTask = useDuplicateItem;

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
      const targetIds = new Set(vars.ids || vars.itemIds || vars.workItemIds || vars.taskIds || []);
      if (targetIds.size === 0) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<any>({ queryKey: ['work-items'] }, (old: any) => {
        if (!old) return old;
        const updateList = (list?: any[]) => {
          if (!Array.isArray(list)) return list;
          return list.map((item) => {
            if (targetIds.has(resolveItemId(item))) {
              return {
                ...item,
                ...(vars.data || {}),
              };
            }
            return item;
          });
        };

        return {
          ...old,
          items: updateList(old.items),
          tasks: updateList(old.tasks),
          workItems: updateList(old.workItems),
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
      toast.error(error.message || 'Failed to update work items');
    },
    onSuccess: (_, vars) => {
      const count = vars.ids?.length || vars.itemIds?.length || vars.workItemIds?.length || vars.taskIds?.length || 0;
      if (count > 0) {
        toast.success(`Updated ${count} items`);
      } else {
        toast.success('Work items updated');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useBulkUpdateItems = useBulkUpdate;
export const useBulkUpdateWorkItems = useBulkUpdate;
export const useBulkUpdateTasks = useBulkUpdate;

export const useBulkDelete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ids,
      itemIds,
      workItemIds,
      taskIds,
      projectId,
    }: {
      ids?: string[];
      itemIds?: string[];
      workItemIds?: string[];
      taskIds?: string[];
      projectId?: string;
    }) =>
      CoreService.bulkDelete({
        ids: ids || itemIds || workItemIds || taskIds,
        itemIds: ids || itemIds || workItemIds || taskIds,
        workItemIds: ids || itemIds || workItemIds || taskIds,
        taskIds: ids || itemIds || workItemIds || taskIds,
        projectId,
      }),
    onMutate: async ({ ids, itemIds, workItemIds, taskIds }) => {
      const targetIds = new Set(ids || itemIds || workItemIds || taskIds || []);
      if (targetIds.size === 0) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<any>({ queryKey: ['work-items'] }, (old: any) => {
        if (!old) return old;
        const filterList = (list?: any[]) => {
          if (!Array.isArray(list)) return list;
          return list.filter((item) => !targetIds.has(resolveItemId(item)));
        };

        return {
          ...old,
          items: filterList(old.items),
          tasks: filterList(old.tasks),
          workItems: filterList(old.workItems),
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
      toast.error(error.message || 'Failed to delete work items');
    },
    onSuccess: () => {
      toast.success('Work items deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useBulkDeleteItems = useBulkDelete;
export const useBulkDeleteWorkItems = useBulkDelete;
export const useBulkDeleteTasks = useBulkDelete;

export const useCreateSubItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, taskId, ...data }: { id?: string; itemId?: string; taskId?: string } & CreateSubItemInput) => {
      const targetId = (id || itemId || taskId) ?? '';
      return CoreService.createSubItem(targetId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Sub-item created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create sub-item'),
  });
};

export const useCreateSubtask = useCreateSubItem;
export const useCreateSubWorkItem = useCreateSubItem;

export const useConvertSubItemToRoot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, taskId }: { id?: string; itemId?: string; taskId?: string }) => {
      const targetId = (id || itemId || taskId) ?? '';
      return CoreService.convertToRoot(targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Converted to top-level item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to convert to top-level item'),
  });
};

export const useConvertSubtaskToRoot = useConvertSubItemToRoot;

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
      const targetId = (vars.taskId || vars.workItemId || vars.id) ?? '';
      if (!targetId) return;

      await queryClient.cancelQueries({ queryKey: ['work-items'] });
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousQueries = queryClient.getQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] });

      queryClient.setQueriesData<any>({ queryKey: ['work-items'] }, (old: any) => {
        if (!old) return old;
        const updateList = (list?: any[]) => {
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

        return {
          ...old,
          items: updateList(old.items),
          tasks: updateList(old.tasks),
          workItems: updateList(old.workItems),
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
      toast.error(error.message || 'Failed to reorder work item');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useReorderTask = useReorderItem;
export const useReorderWorkItem = useReorderItem;

export const useSubItemNotification = () => {
  const notifySubItemAdded = useCallback((count: number = 1) => {
    toast.success(count === 1 ? 'Sub-item added' : `${count} sub-items added`);
  }, []);
  return { notifySubItemAdded, notifySubtaskAdded: notifySubItemAdded };
};
export const useSubtaskNotification = useSubItemNotification;

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
      toast.success(message || 'Copied to clipboard');
    });
  }, []);
};
export const useCopyTaskText = useCopyItemText;
export const useCopyWorkItemText = useCopyItemText;

// ── 5. Main Item Project Hook (useProject) ──────────────────────────────────

export interface UseProjectOptions {
  projectId: string;
  cycleId?: string;
  workspaceId?: string;
}

export type UseTaskProjectOptions = UseProjectOptions;

export function useProject({ projectId, cycleId, workspaceId }: UseProjectOptions) {
  const itemsQ = useProjectItems(projectId, cycleId);
  const detailsQ = useProjectDetails(projectId);
  const cyclesQ = useCycles(projectId);
  const labelsQ = useLabelsQuery(workspaceId || '', 'task', projectId);

  const createMut = useCreateItem();
  const updateMut = useUpdateItem();
  const deleteMut = useDeleteItem();
  const duplicateMut = useDuplicateItem();
  const bulkMut = useBulkUpdate();
  const reorderMut = useReorderItem();
  const subItemMut = useCreateSubItem();

  const items = useMemo(() => itemsQ.data?.items ?? itemsQ.data?.tasks ?? [], [itemsQ.data]);
  const project = useMemo(() => {
    const projectData = detailsQ.data;
    if (!projectData) return undefined;
    return ('project' in projectData && projectData.project ? projectData.project : projectData) as Project | undefined;
  }, [detailsQ.data]);

  const projectTaskColumns = (project as any)?.taskColumns;
  const columns = useMemo(() => {
    const rawCols = itemsQ.data?.columns || (itemsQ.data as any)?.states;
    if (Array.isArray(rawCols) && rawCols.length > 0) return normalizeStates(rawCols);
    if (Array.isArray(projectTaskColumns) && projectTaskColumns.length > 0) return normalizeStates(projectTaskColumns);
    return [...DEFAULT_STATES];
  }, [itemsQ.data, projectTaskColumns]);
  const members = useMemo(() => (project?.members ?? []) as ProjectMember[], [project?.members]);
  const cycles = useMemo(() => {
    if (!cyclesQ.data) return [] as Cycle[];
    if (Array.isArray(cyclesQ.data)) return cyclesQ.data as Cycle[];
    return (cyclesQ.data.cycles ?? []) as Cycle[];
  }, [cyclesQ.data]);
  const currentCycle = useMemo(
    () => (cycleId ? cycles.find((cycle) => cycle.id === cycleId) : undefined),
    [cycles, cycleId],
  );
  const labels = useMemo(() => (labelsQ.data ?? []) as Label[], [labelsQ.data]);

  const labelMap = useMemo(() => {
    return new Map(labels.map((label) => [label.id, { id: label.id, name: label.name, color: label.color || '#94a3b8' }]));
  }, [labels]);
  const isSaving = updateMut.isPending || createMut.isPending;
  const isDeleting = deleteMut.isPending;
  const isLoading = itemsQ.isLoading || detailsQ.isLoading;
  const isError = itemsQ.isError || detailsQ.isError;
  const error = itemsQ.error || detailsQ.error;

  const state = {
    items,
    allTasks: items,
    workItems: items,
    allWorkItems: items,
    columns,
    project,
    members,
    cycles,
    currentCycle,
    labels,
    labelMap,
    status: {
      isLoading,
      isError,
      isSaving,
      isDeleting,
      error,
    },
    isLoading,
    isError,
    error,
    isSaving,
    isDeleting,
    isSavingItem: isSaving,
    isDeletingItem: isDeleting,
    isSavingWorkItem: isSaving,
    isDeletingWorkItem: isDeleting,
    isSavingTask: isSaving,
    isDeletingTask: isDeleting,
  };

  const createMutAsync = createMut.mutateAsync;
  const updateMutAsync = updateMut.mutateAsync;
  const deleteMutAsync = deleteMut.mutateAsync;
  const duplicateMutAsync = duplicateMut.mutateAsync;
  const bulkMutAsync = bulkMut.mutateAsync;
  const reorderMutAsync = reorderMut.mutateAsync;
  const subItemMutAsync = subItemMut.mutateAsync;
  const refetchItems = itemsQ.refetch;
  const refetchDetails = detailsQ.refetch;

  const createAction = useCallback((payload: Parameters<typeof createMutAsync>[0]) => createMutAsync(payload), [createMutAsync]);
  const updateAction = useCallback((payload: Parameters<typeof updateMutAsync>[0]) => updateMutAsync(payload), [updateMutAsync]);
  const deleteAction = useCallback((target: { id?: string; itemId?: string; taskId?: string; projectId?: string }) => {
    const tid = resolveItemId(target);
    return deleteMutAsync({
      id: tid,
      itemId: tid,
      taskId: tid,
      projectId: target.projectId,
    });
  }, [deleteMutAsync]);

  const duplicateAction = useCallback(
    (target: { id?: string; itemId?: string; taskId?: string; projectId?: string }) => {
      const tid = resolveItemId(target);
      return duplicateMutAsync({ projectId: target.projectId || projectId, id: tid, itemId: tid, taskId: tid });
    },
    [duplicateMutAsync, projectId],
  );

  const moveAction = useCallback(
    (moveInput: { id?: string; itemId?: string; taskId?: string; columnId: string; projectId?: string }) => {
      const tid = resolveItemId(moveInput);
      return updateMutAsync({
        projectId: moveInput.projectId || projectId,
        id: tid,
        itemId: tid,
        taskId: tid,
        columnId: moveInput.columnId,
      });
    },
    [updateMutAsync, projectId],
  );

  const reorderAction = useCallback(
    (reorderInput: { id?: string; itemId?: string; taskId?: string; rank: number; columnId?: string; projectId?: string }) => {
      const tid = resolveItemId(reorderInput);
      return reorderMutAsync({
        projectId: reorderInput.projectId || projectId,
        id: tid,
        itemId: tid,
        taskId: tid,
        columnId: reorderInput.columnId,
        rank: reorderInput.rank,
      });
    },
    [reorderMutAsync, projectId],
  );

  const createSubItemAction = useCallback(
    (subItemInput: { id?: string; itemId?: string; taskId?: string; title: string; columnId?: string; priority?: Priority }) => {
      const tid = resolveItemId(subItemInput);
      return subItemMutAsync({
        id: tid,
        itemId: tid,
        taskId: tid,
        title: subItemInput.title,
        columnId: subItemInput.columnId,
        priority: subItemInput.priority,
      });
    },
    [subItemMutAsync],
  );

  const bulkAction = useCallback((payload: Parameters<typeof bulkMutAsync>[0]) => bulkMutAsync(payload), [bulkMutAsync]);

  const refetchAction = useCallback(() => {
    refetchItems();
    refetchDetails();
  }, [refetchItems, refetchDetails]);

  const assignItemsToDateAction = useCallback(
    (itemIds: string[], dueDate: string, quiet = false, startDate?: string | null) => {
      if (itemIds.length === 0) return;
      itemIds.forEach((targetId) => {
        const payload: any = { id: targetId, workItemId: targetId, taskId: targetId, projectId, dueDate };
        if (startDate !== undefined) payload.startDate = startDate;
        updateMutAsync(payload);
      });
      if (!quiet) {
        toast.success(
          itemIds.length === 1
            ? 'Work item added to calendar'
            : `${itemIds.length} work items added to calendar`
        );
      }
    },
    [updateMutAsync, projectId],
  );

  const actions = {
    create: createAction,
    update: updateAction,
    delete: deleteAction,
    duplicate: duplicateAction,
    move: moveAction,
    reorder: reorderAction,
    createSubItem: createSubItemAction,
    bulk: bulkAction,
    refetch: refetchAction,

    // Item Action Aliases
    createItem: createAction,
    updateItem: updateAction,
    moveItem: moveAction,
    deleteItem: deleteAction,
    duplicateItem: duplicateAction,
    bulkUpdateItems: bulkAction,
    reorderItem: reorderAction,

    // Backward Compat Aliases
    createWorkItem: createAction,
    updateWorkItem: updateAction,
    moveWorkItem: moveAction,
    deleteWorkItem: deleteAction,
    duplicateWorkItem: duplicateAction,
    bulkUpdateWorkItems: bulkAction,
    reorderWorkItem: reorderAction,
    createSubWorkItem: createSubItemAction,

    createTask: createAction,
    updateTask: updateAction,
    moveTask: moveAction,
    deleteTask: deleteAction,
    duplicateTask: duplicateAction,
    bulkUpdateTasks: bulkAction,
    reorderTask: reorderAction,
    createSubtask: createSubItemAction,

    removeFromCycle: useCallback(
      (targetId: string, callback?: () => void) => {
        updateMutAsync({ id: targetId, workItemId: targetId, taskId: targetId, projectId, cycleId: null })
          .then(() => {
            toast.success('Work item removed from cycle');
            callback?.();
          })
          .catch((err: any) => {
            toast.error(err?.message || 'Failed to remove work item from cycle');
          });
      },
      [updateMutAsync, projectId]
    ),

    assignItemsToDate: assignItemsToDateAction,
    assignTasksToDate: assignItemsToDateAction,
    assignWorkItemsToDate: assignItemsToDateAction,

    notifyAnalyticsComingSoon: useCallback(() => {
      toast.info('Analytics is coming soon');
    }, []),
  };

  return { state, actions };
}

export const useTaskProject = useProject;
export const useItemsProject = useProject;
export const useWorkItemProject = useProject;
export const useWorkItems = useProject;
export const useTasks = useProject;

// ── Work Item Form & Mutation Controller ─────────────────────────────────────

export const createWorkItemFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string(),
  columnId: z.string(),
  priority: prioritySchema,
  dueDate: z.string(),
  startDate: z.string(),
  cycleId: z.string().nullable(),
  parentId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  labels: z.array(z.string()),
  assigneeId: z.string().nullable(),
  assigneeIds: z.array(z.string()),
  attachments: z.custom<AttachCenterData>(),
  createMore: z.boolean(),
});

export const createItemFormSchema = createWorkItemFormSchema;

export type CreateWorkItemFormData = z.infer<typeof createWorkItemFormSchema>;
export type CreateItemFormData = CreateWorkItemFormData;

export interface UseWorkItemFormOptions {
  defaultColumnId?: string;
  defaultCycleId?: string | null;
  initialValues?: Partial<CreateWorkItemFormData>;
}

export type UseItemFormOptions = UseWorkItemFormOptions;

export function useWorkItemForm(options: UseWorkItemFormOptions = {}) {
  const { defaultColumnId = 'todo', defaultCycleId = null, initialValues } = options;

  const defaultValues: CreateWorkItemFormData = useMemo(
    () => ({
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      columnId: initialValues?.columnId ?? defaultColumnId,
      priority: (initialValues?.priority as Priority) ?? 'none',
      dueDate: initialValues?.dueDate ?? '',
      startDate: initialValues?.startDate ?? '',
      cycleId: initialValues?.cycleId ?? defaultCycleId,
      parentId: initialValues?.parentId ?? initialValues?.parentItemId ?? initialValues?.parentTaskId ?? null,
      parentTaskId: initialValues?.parentTaskId ?? initialValues?.parentItemId ?? initialValues?.parentId ?? null,
      parentItemId: initialValues?.parentItemId ?? initialValues?.parentId ?? initialValues?.parentTaskId ?? null,
      labels: initialValues?.labels ?? [],
      assigneeId: initialValues?.assigneeId ?? null,
      assigneeIds: initialValues?.assigneeIds ?? [],
      attachments: initialValues?.attachments ?? {
        pages: [],
        papers: [],
        files: [],
        links: [],
      },
      createMore: initialValues?.createMore ?? false,
    }),
    [defaultColumnId, defaultCycleId, initialValues]
  );

  const form = useForm<CreateWorkItemFormData>({
    resolver: zodResolver(createWorkItemFormSchema),
    defaultValues,
    mode: 'onSubmit',
  });

  const { setValue, reset } = form;

  // Field setters
  const setColumnId = useCallback(
    (colId: string) => setValue('columnId', colId, { shouldDirty: true }),
    [setValue]
  );

  const setPriority = useCallback(
    (pri: Priority) => setValue('priority', pri, { shouldDirty: true }),
    [setValue]
  );

  const setDueDate = useCallback(
    (date: string) => setValue('dueDate', date, { shouldDirty: true }),
    [setValue]
  );

  const setStartDate = useCallback(
    (date: string) => setValue('startDate', date, { shouldDirty: true }),
    [setValue]
  );

  const setCycleId = useCallback(
    (cId: string | null) => setValue('cycleId', cId, { shouldDirty: true }),
    [setValue]
  );

  const setParentId = useCallback(
    (pId: string | null) => {
      setValue('parentId', pId, { shouldDirty: true });
      setValue('parentTaskId', pId, { shouldDirty: true });
      setValue('parentItemId', pId, { shouldDirty: true });
    },
    [setValue]
  );

  const setLabels = useCallback(
    (lbls: string[]) => setValue('labels', lbls, { shouldDirty: true }),
    [setValue]
  );

  const setAssignees = useCallback(
    (ids: string[]) => {
      setValue('assigneeIds', ids, { shouldDirty: true });
      setValue('assigneeId', ids[0] ?? null, { shouldDirty: true });
    },
    [setValue]
  );

  const setAttachments = useCallback(
    (data: AttachCenterData | ((prev: AttachCenterData) => AttachCenterData)) => {
      if (typeof data === 'function') {
        const current = form.getValues('attachments') as AttachCenterData;
        setValue('attachments', data(current), { shouldDirty: true });
      } else {
        setValue('attachments', data, { shouldDirty: true });
      }
    },
    [form, setValue]
  );

  const setCreateMore = useCallback(
    (val: boolean) => setValue('createMore', val, { shouldDirty: true }),
    [setValue]
  );

  const resetToDefaults = useCallback(() => {
    reset(defaultValues);
  }, [reset, defaultValues]);

  const restoreFromDraft = useCallback(
    (draft: Partial<CreateWorkItemFormData> & { content?: string }) => {
      const parent = draft.parentId ?? draft.parentItemId ?? draft.parentTaskId ?? null;
      reset({
        title: draft.title ?? '',
        description: draft.description || draft.content || '',
        columnId: draft.columnId ?? defaultColumnId,
        priority: (draft.priority as Priority) ?? 'none',
        dueDate: draft.dueDate ?? '',
        startDate: draft.startDate ?? '',
        cycleId: draft.cycleId ?? defaultCycleId,
        parentId: parent,
        parentTaskId: parent,
        parentItemId: parent,
        labels: Array.isArray(draft.labels) ? draft.labels : [],
        assigneeId: draft.assigneeId ?? (draft.assigneeIds?.[0] ?? null),
        assigneeIds: Array.isArray(draft.assigneeIds)
          ? draft.assigneeIds
          : draft.assigneeId
            ? [draft.assigneeId]
            : [],
        attachments: draft.attachments ?? { pages: [], papers: [], files: [], links: [] },
        createMore: false,
      });
    },
    [reset, defaultColumnId, defaultCycleId]
  );

  return {
    form,
    control: form.control,
    register: form.register,
    handleSubmit: form.handleSubmit,
    errors: form.formState.errors,
    isDirty: form.formState.isDirty,
    isSubmitting: form.formState.isSubmitting,
    getValues: form.getValues,
    setValue,
    reset,
    resetToDefaults,
    restoreFromDraft,
    setColumnId,
    setPriority,
    setDueDate,
    setStartDate,
    setCycleId,
    setParentId,
    setParentTaskId: setParentId,
    setParentItemId: setParentId,
    setLabels,
    setAssignees,
    setAttachments,
    setCreateMore,
  };
}

export const useItemForm = useWorkItemForm;
export default useProject;
