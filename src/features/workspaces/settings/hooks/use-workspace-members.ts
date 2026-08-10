'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/constants';

import {
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
} from '../services/member.service';

// ── useAddWorkspaceMember ─────────────────────────────────────────────────────

export const useAddWorkspaceMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      role = 'member',
    }: {
      workspaceId: string;
      userId: string;
      role?: string;
    }) => addWorkspaceMember(workspaceId, userId, role),
    onMutate: () => {
      toast.loading('Adding member...', { id: 'ws-member-action' });
    },
    onSuccess: (data, variables) => {
      const res = data as any;
      if (res?.workspace) {
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(variables.workspaceId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      toast.success('Member added', { id: 'ws-member-action' });
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to add member', {
        id: 'ws-member-action',
      });
    },
  });
};

// ── useUpdateWorkspaceMemberRole ──────────────────────────────────────────────

export const useUpdateWorkspaceMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      newRole,
    }: {
      workspaceId: string;
      userId: string;
      newRole: string;
    }) => updateWorkspaceMemberRole(workspaceId, userId, newRole),
    onMutate: async ({ workspaceId, userId, newRole }) => {
      toast.loading('Updating member role...', { id: 'ws-member-action' });

      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all });

      const previousWorkspaceQueries = queryClient.getQueriesData({
        queryKey: queryKeys.workspaces.all,
      });

      const rolesData: any = queryClient.getQueryData(['roles', workspaceId]);
      const roles = Array.isArray(rolesData)
        ? rolesData
        : rolesData?.roles ?? [];
      const roleObject = roles.find(
        (r: any) => r.name.toLowerCase() === newRole.toLowerCase(),
      );

      queryClient.setQueriesData(
        { queryKey: ['workspace'] },
        (old: any) => {
          if (!old?.workspace?.members) return old;
          return {
            ...old,
            workspace: {
              ...old.workspace,
              members: old.workspace.members.map((m: any) =>
                m.user._id === userId
                  ? { ...m, role: roleObject ? { ...roleObject } : newRole }
                  : m,
              ),
            },
          };
        },
      );

      return { previousWorkspaceQueries };
    },
    onError: (error: any, _variables, context) => {
      context?.previousWorkspaceQueries?.forEach(
        ([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        },
      );
      toast.error(error.message ?? 'Failed to update member role', {
        id: 'ws-member-action',
      });
    },
    onSuccess: (data, variables) => {
      const res = data as any;
      if (res?.workspace) {
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(variables.workspaceId) });
      }
      toast.success('Member role updated', { id: 'ws-member-action' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
};

// ── useRemoveWorkspaceMember ──────────────────────────────────────────────────

export const useRemoveWorkspaceMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
    }: {
      workspaceId: string;
      userId: string;
    }) => removeWorkspaceMember(workspaceId, userId),
    onMutate: () => {
      toast.loading('Removing member...', { id: 'ws-member-action' });
    },
    onSuccess: (data, variables) => {
      const res = data as any;
      if (res?.workspace) {
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(variables.workspaceId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      toast.success('Member removed', { id: 'ws-member-action' });
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to remove member', {
        id: 'ws-member-action',
      });
    },
  });
};
