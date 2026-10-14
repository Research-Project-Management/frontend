'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AssignmentService } from '../api/work-item.api';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Joined work item', { id: 'work-item-assignment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to join work item', { id: 'work-item-assignment' }),
  });
};

export const useJoinWorkItemMutation = useJoinItemMutation;

export const useLeaveItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId }: { id?: string; projectId: string; workItemId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.leave(projectId, targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Left work item', { id: 'work-item-assignment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to leave work item', { id: 'work-item-assignment' }),
  });
};

export const useLeaveWorkItemMutation = useLeaveItemMutation;

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update assignees', { id: 'work-item-assignment' }),
  });
};

export const useSubscribeItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId }: { id?: string; projectId: string; workItemId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.subscribeMe(projectId, targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Subscribed to notifications', { id: 'work-item-assignment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to subscribe', { id: 'work-item-assignment' }),
  });
};

export const useUnsubscribeItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId }: { id?: string; projectId: string; workItemId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.unsubscribeMe(projectId, targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Unsubscribed from notifications', { id: 'work-item-assignment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to unsubscribe', { id: 'work-item-assignment' }),
  });
};

export const useAssignItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemId, id, assigneeId }: { projectId: string; workItemId?: string; id?: string; assigneeId?: string | null }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.assign(projectId, targetId, assigneeId ?? null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to assign item'),
  });
};

export const useUnassignItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemId, id }: { projectId: string; workItemId?: string; id?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.unassign(projectId, targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to unassign item'),
  });
};

export const useAddAssigneeMutation = useAssignItemMutation;

export const useRemoveAssigneeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemId, id, targetUserId }: { projectId: string; workItemId?: string; id?: string; targetUserId?: string; userId?: string }) => {
      const targetId = (id || workItemId) ?? '';
      return AssignmentService.removeAssignee(projectId, targetId, targetUserId || '');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove assignee'),
  });
};

export const useBulkAssignMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, workItemIds, assigneeId }: { projectId: string; workItemIds: string[]; assigneeId: string | null }) => {
      return AssignmentService.bulkAssign(projectId, workItemIds, assigneeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to bulk assign'),
  });
};

// Aliases for use-work-item-mutations
export const useAssignItem = useAssignItemMutation;
export const useUnassignItem = useUnassignItemMutation;
export const useJoinItem = useJoinItemMutation;
export const useLeaveItem = useLeaveItemMutation;
export const useSetAssignees = useSetAssigneesMutation;
export const useAddAssignee = useAddAssigneeMutation;
export const useRemoveAssignee = useRemoveAssigneeMutation;
export const useBulkAssign = useBulkAssignMutation;

