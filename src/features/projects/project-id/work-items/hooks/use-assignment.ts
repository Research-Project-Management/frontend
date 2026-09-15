'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AssignmentService } from '../services/assignment.service';

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
      toast.success('Joined work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to join work item'),
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
      toast.success('Left work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to leave work item'),
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
    onError: (error: Error) => toast.error(error.message || 'Failed to update assignees'),
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
      toast.success('Subscribed to notifications');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to subscribe'),
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
      toast.success('Unsubscribed from notifications');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to unsubscribe'),
  });
};
