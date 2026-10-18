'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssignmentService } from '@/features/projects/project-id/work-items/api/work-item.api';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';
import { resolveItemId } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { invalidateWorkItemRelatedQueries } from './use-work-items-query';
import { workItemToast } from './use-work-item-toast';

type ProjectItemsCache =
  | Item[]
  | ({ items?: Item[]; workItems?: Item[] } & Record<string, unknown>);

function syncItemIntoCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  targetId: string,
  serverItem: Item | undefined,
  projectId?: string,
) {
  if (targetId && serverItem) {
    const updater = (old: ProjectItemsCache | undefined): ProjectItemsCache | undefined => {
      if (!old) return old;
      const mapList = (list: Item[]) =>
        list.map((item) =>
          resolveItemId(item) === targetId ? { ...item, ...serverItem } : item,
        );
      if (Array.isArray(old)) return mapList(old);
      return {
        ...old,
        ...(Array.isArray(old.items) ? { items: mapList(old.items) } : {}),
        ...(Array.isArray(old.workItems) ? { workItems: mapList(old.workItems) } : {}),
      };
    };
    queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['work-items'] }, updater);
    queryClient.setQueriesData<ProjectItemsCache>({ queryKey: ['archived-items'] }, updater);
  }
  invalidateWorkItemRelatedQueries(queryClient, projectId);
  queryClient.invalidateQueries({ queryKey: ['your-work'] });
  if (targetId) {
    queryClient.invalidateQueries({ queryKey: ['work-item-activity', targetId] });
  }
}

export const assignmentKeys = {
  eligible: (projectId: string) => ['eligible-assignees', projectId] as const,
};

export const useEligibleAssigneesQuery = (projectId: string) =>
  useQuery({
    queryKey: assignmentKeys.eligible(projectId),
    queryFn: () => AssignmentService.getEligibleAssignees(projectId),
    enabled: Boolean(projectId),
  });

export const useJoinItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId }: { id?: string; projectId: string; workItemId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.join(projectId, targetId);
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
      workItemToast.success('Joined work item', 'assignment');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to join work item', 'assignment'),
  });
};

export const useLeaveItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId }: { id?: string; projectId: string; workItemId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.leave(projectId, targetId);
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
      workItemToast.success('Left work item', 'assignment');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to leave work item', 'assignment'),
  });
};

export const useSetAssigneesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      projectId,
      workItemId,
      assigneeIds,
    }: {
      id?: string;
      projectId: string;
      workItemId?: string;
      assigneeIds: string[];
    }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.setAssignees(projectId, targetId, assigneeIds);
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to update assignees', 'assignment'),
  });
};

export const useSubscribeItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId }: { id?: string; projectId: string; workItemId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.subscribeMe(projectId, targetId);
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
      workItemToast.success('Subscribed to notifications', 'assignment');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to subscribe', 'assignment'),
  });
};

export const useUnsubscribeItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId }: { id?: string; projectId: string; workItemId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.unsubscribeMe(projectId, targetId);
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
      workItemToast.success('Unsubscribed from notifications', 'assignment');
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to unsubscribe', 'assignment'),
  });
};

export const useAssignItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemId, id, assigneeId }: { projectId: string; workItemId?: string; id?: string; assigneeId?: string | null }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.assign(projectId, targetId, assigneeId ?? null);
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to assign item', 'assignment'),
  });
};

export const useUnassignItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemId, id }: { projectId: string; workItemId?: string; id?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.unassign(projectId, targetId);
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to unassign item', 'assignment'),
  });
};

export const useRemoveAssigneeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemId, id, targetUserId }: { projectId: string; workItemId?: string; id?: string; targetUserId?: string; userId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.removeAssignee(projectId, targetId, targetUserId || '');
    },
    onSuccess: (res, vars) => {
      const targetId = (vars.id || vars.workItemId) ?? '';
      syncItemIntoCaches(queryClient, targetId, res?.workItem || res?.item, vars.projectId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to remove assignee', 'assignment'),
  });
};

export const useBulkAssignMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemIds, assigneeId }: { projectId: string; workItemIds: string[]; assigneeId: string | null }) => {
      return AssignmentService.bulkAssign(projectId, workItemIds, assigneeId);
    },
    onSuccess: (_res, vars) => {
      invalidateWorkItemRelatedQueries(queryClient, vars.projectId);
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to bulk assign', 'bulk'),
  });
};


