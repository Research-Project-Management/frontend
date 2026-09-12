'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UpdateService } from '../services/update.service';

export const updateKeys = {
  all: ['item-updates'] as const,
  item: (itemId: string, projectId?: string) =>
    projectId
      ? (['item-updates', itemId, projectId] as const)
      : (['item-updates', itemId] as const),
  latest: (itemId: string, projectId?: string) =>
    projectId
      ? (['item-updates-latest', itemId, projectId] as const)
      : (['item-updates-latest', itemId] as const),
  task: (taskId: string, projectId?: string) =>
    projectId
      ? (['task-updates', taskId, projectId] as const)
      : (['task-updates', taskId] as const),
};

export const useUpdatesQuery = (itemId: string, projectId?: string) =>
  useQuery({
    queryKey: updateKeys.item(itemId, projectId),
    queryFn: () => UpdateService.getUpdates(itemId, projectId),
    enabled: Boolean(itemId),
  });

export const useItemUpdatesQuery = useUpdatesQuery;
export const useTaskUpdatesQuery = useUpdatesQuery;
export const useWorkItemUpdatesQuery = useUpdatesQuery;

export const useLatestUpdateQuery = (itemId: string, projectId?: string) =>
  useQuery({
    queryKey: updateKeys.latest(itemId, projectId),
    queryFn: () => UpdateService.getLatestUpdate(itemId, projectId),
    enabled: Boolean(itemId),
  });

export const useItemLatestUpdateQuery = useLatestUpdateQuery;
export const useTaskLatestUpdateQuery = useLatestUpdateQuery;
export const useWorkItemLatestUpdateQuery = useLatestUpdateQuery;

export const useCreateUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      taskId,
      projectId,
      data,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      taskId?: string;
      projectId?: string;
      data: { content: string; status?: string; percent?: number };
    }) => {
      const targetId = (id || itemId || workItemId || taskId) ?? '';
      return UpdateService.createUpdate(targetId, data, projectId);
    },
    onSuccess: (_, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId || vars.taskId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['item-updates', targetId] });
      queryClient.invalidateQueries({ queryKey: ['item-updates-latest', targetId] });
      queryClient.invalidateQueries({ queryKey: ['task-updates', targetId] });
      queryClient.invalidateQueries({ queryKey: ['task-updates-latest', targetId] });
      toast.success('Progress update posted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to post update'),
  });
};

export const useCreateItemUpdateMutation = useCreateUpdateMutation;
export const useCreateTaskUpdateMutation = useCreateUpdateMutation;
export const useCreateWorkItemUpdateMutation = useCreateUpdateMutation;

export const useDeleteUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      taskId,
      updateId,
      projectId,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      taskId?: string;
      updateId: string;
      projectId?: string;
    }) => {
      const targetId = (id || itemId || workItemId || taskId) ?? '';
      return UpdateService.deleteUpdate(targetId, updateId, projectId);
    },
    onSuccess: (_, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId || vars.taskId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['item-updates', targetId] });
      queryClient.invalidateQueries({ queryKey: ['item-updates-latest', targetId] });
      queryClient.invalidateQueries({ queryKey: ['task-updates', targetId] });
      queryClient.invalidateQueries({ queryKey: ['task-updates-latest', targetId] });
      toast.success('Update deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete update'),
  });
};

export const useDeleteItemUpdateMutation = useDeleteUpdateMutation;
export const useDeleteTaskUpdateMutation = useDeleteUpdateMutation;
export const useDeleteWorkItemUpdateMutation = useDeleteUpdateMutation;
