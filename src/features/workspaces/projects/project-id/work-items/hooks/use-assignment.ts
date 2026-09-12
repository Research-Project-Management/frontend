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
    mutationFn: ({ id, projectId, workItemId, taskId }: { id?: string; projectId: string; workItemId?: string; taskId?: string }) => {
      const targetId = (id || workItemId || taskId) ?? '';
      return AssignmentService.join(projectId, targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Joined work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to join work item'),
  });
};

export const useJoinTaskMutation = useJoinItemMutation;
export const useJoinWorkItemMutation = useJoinItemMutation;

export const useLeaveItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, projectId, workItemId, taskId }: { id?: string; projectId: string; workItemId?: string; taskId?: string }) => {
      const targetId = (id || workItemId || taskId) ?? '';
      return AssignmentService.leave(projectId, targetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Left work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to leave work item'),
  });
};

export const useLeaveTaskMutation = useLeaveItemMutation;
export const useLeaveWorkItemMutation = useLeaveItemMutation;

export const useSetAssigneesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      projectId,
      workItemId,
      taskId,
      assigneeIds,
    }: {
      id?: string;
      projectId: string;
      workItemId?: string;
      taskId?: string;
      assigneeIds: string[];
    }) => {
      const targetId = (id || workItemId || taskId) ?? '';
      return AssignmentService.setAssignees(projectId, targetId, assigneeIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update assignees'),
  });
};
