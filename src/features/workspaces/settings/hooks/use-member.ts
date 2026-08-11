'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/constants';
import { AddMemberBodySchema, UpdateMemberRoleBodySchema } from '@/features/workspaces/settings/schemas/settings.schema';
import {
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
} from '@/features/workspaces/settings/services/settings.service';

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
    }) => {
      const payload = AddMemberBodySchema.parse({ userId, role });
      return addWorkspaceMember(workspaceId, payload);
    },
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
    }) => {
      const payload = UpdateMemberRoleBodySchema.parse({ role: newRole });
      return updateWorkspaceMemberRole(workspaceId, userId, payload);
    },
    onMutate: async ({ workspaceId, userId, newRole }) => {
      toast.loading('Updating member role...', { id: 'ws-member-action' });

      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all });

      const previousWorkspaceQueries = queryClient.getQueriesData({
        queryKey: queryKeys.workspaces.all,
      });

      queryClient.setQueriesData(
        { queryKey: queryKeys.workspaces.all },
        (old: any) => {
          if (!old?.workspaces) return old;
          return {
            ...old,
            workspaces: old.workspaces.map((w: any) => {
              if (w._id !== workspaceId) return w;
              return {
                ...w,
                members: w.members?.map((m: any) =>
                  m.user._id === userId ? { ...m, role: newRole } : m
                ) || []
              };
            })
          };
        }
      );

      queryClient.setQueriesData(
        { queryKey: queryKeys.workspaces.detail(workspaceId) },
        (old: any) => {
          if (!old?.workspace?.members) return old;
          return {
            ...old,
            workspace: {
              ...old.workspace,
              members: old.workspace.members.map((m: any) =>
                m.user._id === userId
                  ? { ...m, role: newRole }
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

export function useMember(workspaceId: string) {
  const [searchTerm, setSearchTerm] = useState('');
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const { workspace, isLoading, yourRole } = useWorkspace(workspaceId);

  const updateRoleMutation = useUpdateWorkspaceMemberRole();
  const removeMemberMutation = useRemoveWorkspaceMember();

  const members = workspace?.members || [];

  const existingMemberIds = useMemo<Set<string>>(
    () =>
      new Set(
        members
          .map((m: any) => m.user?._id)
          .filter((id: unknown): id is string => typeof id === 'string'),
      ),
    [members],
  );

  const filteredMembers = useMemo(
    () =>
      members.filter(
        (m: any) =>
          m.user && (m.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.user.email?.toLowerCase().includes(searchTerm.toLowerCase())),
      ),
    [members, searchTerm],
  );

  const canManage = yourRole === 'owner' || yourRole === 'admin';

  const handleUpdateRole = useCallback(
    (userId: string, newRole: string) => {
      if (!workspace) return;
      updateRoleMutation.mutate({
        workspaceId: workspace._id,
        userId,
        newRole,
      });
    },
    [updateRoleMutation, workspace],
  );

  const handleRemoveMember = useCallback(
    (userId: string) => {
      if (!workspace) return;
      removeMemberMutation.mutate({ workspaceId: workspace._id, userId }, {
        onSuccess: () => {
          setMemberToRemove(null);
        }
      });
    },
    [removeMemberMutation, workspace],
  );

  return {
    workspace,
    isLoading,
    yourRole,
    members,
    filteredMembers,
    existingMemberIds,
    canManage,
    searchTerm,
    setSearchTerm,
    addMemberOpen,
    setAddMemberOpen,
    isSearchExpanded,
    setIsSearchExpanded,
    memberToRemove,
    setMemberToRemove,
    searchInputRef,
    handleUpdateRole,
    handleRemoveMember,
    isRemovingMember: removeMemberMutation.isPending,
  };
}
