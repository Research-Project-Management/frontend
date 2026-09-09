'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { workspaceKeys } from '@/features/workspaces/shell/services/workspace.service';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  AddMemberBodySchema,
  UpdateMemberRoleBodySchema,
} from '@/features/workspaces/settings/schemas/settings.schema';
import {
  getWorkspaceMembers,
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  leaveWorkspace,
  inviteWorkspaceMembers,
  getWorkspacePendingInvites,
  revokeWorkspaceInvite,
} from '@/features/workspaces/settings/services/settings.service';
import type {
  WorkspaceMemberItem,
  WorkspacePendingInvite,
  WorkspaceRole,
} from '../types/member.types';
import {
  normalizeWorkspaceMembers,
  filterAndSortMembers,
  type SortField,
  type SortDirection,
} from '../utils/member.util';

export type { SortField, SortDirection };

export function useMember(workspaceId: string) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { workspace, isLoading: isWorkspaceLoading, yourRole } = useWorkspace(workspaceId);

  const invalidateDetail = workspaceKeys.detail(workspaceId);
  const invalidateAll = workspaceKeys.all;

  const [activeTab, setActiveTab] = useState<'people' | 'pending'>('people');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberItem | null>(null);
  const [memberToLeave, setMemberToLeave] = useState<WorkspaceMemberItem | null>(null);

  const membersQuery = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });

  const pendingInvitesQuery = useQuery({
    queryKey: ['workspace-invitations', workspaceId],
    queryFn: () => getWorkspacePendingInvites(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ emails, role = 'member' }: { emails: string[]; role: string }) => {
      return inviteWorkspaceMembers(workspaceId, { emails, role });
    },
    onMutate: () => {
      toast.loading('Sending invitations...', { id: 'invite-action' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });

      if (data.skipped && data.skipped.length > 0) {
        toast.info(
          `${data.message}. (${data.skipped.length} email(s) already in workspace)`,
          { id: 'invite-action' },
        );
      } else {
        toast.success(data.message || 'Invitations sent successfully', {
          id: 'invite-action',
        });
      }
      setInviteModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to send invitations', {
        id: 'invite-action',
      });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId: string) =>
      revokeWorkspaceInvite(workspaceId, invitationId),
    onMutate: () => {
      toast.loading('Revoking invitation...', { id: 'revoke-invite' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations', workspaceId] });
      toast.success('Invitation cancelled', { id: 'revoke-invite' });
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to revoke invitation', {
        id: 'revoke-invite',
      });
    },
  });

  const addMutation = useMutation({
    mutationFn: ({ userId, role = 'member' }: { userId: string; role?: string }) => {
      const payload = AddMemberBodySchema.parse({ userId, role });
      return addWorkspaceMember(workspaceId, payload);
    },
    onMutate: () => {
      toast.loading('Adding member...', { id: 'member-action' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateDetail });
      queryClient.invalidateQueries({ queryKey: invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      toast.success('Member added', { id: 'member-action' });
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to add member', { id: 'member-action' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) => {
      const payload = UpdateMemberRoleBodySchema.parse({ role: newRole });
      return updateWorkspaceMemberRole(workspaceId, userId, payload);
    },
    onMutate: async ({ userId, newRole }) => {
      toast.loading('Updating member role...', { id: 'member-action' });
      await queryClient.cancelQueries({ queryKey: invalidateAll });

      const snapshot = queryClient.getQueriesData({ queryKey: invalidateAll });

      queryClient.setQueriesData({ queryKey: invalidateAll }, (old: any) => {
        if (!old?.workspaces) return old;
        return {
          ...old,
          workspaces: old.workspaces.map((w: any) => {
            if (w.id !== workspaceId) return w;
            return {
              ...w,
              members: w.members?.map((m: any) =>
                m.user?.id === userId ? { ...m, role: newRole } : m,
              ) ?? [],
            };
          }),
        };
      });

      return { snapshot };
    },
    onError: (error: any, _vars, context) => {
      context?.snapshot?.forEach(([key, data]: [any, any]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(error.message ?? 'Failed to update member role', { id: 'member-action' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateDetail });
      queryClient.invalidateQueries({ queryKey: invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      toast.success('Member role updated', { id: 'member-action' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeWorkspaceMember(workspaceId, userId),
    onMutate: () => {
      toast.loading('Removing member...', { id: 'member-action' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateDetail });
      queryClient.invalidateQueries({ queryKey: invalidateAll });
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
      toast.success('Member removed', { id: 'member-action' });
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to remove member', { id: 'member-action' });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => leaveWorkspace(workspaceId),
    onMutate: () => {
      toast.loading('Leaving workspace...', { id: 'member-action' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateAll });
      toast.success('Left workspace successfully', { id: 'member-action' });
      setMemberToLeave(null);
    },
    onError: (error: any) => {
      toast.error(error.message ?? 'Failed to leave workspace', { id: 'member-action' });
    },
  });

  const canManage = yourRole === 'owner' || yourRole === 'admin';

  const members: WorkspaceMemberItem[] = useMemo(() => {
    const raw = (membersQuery.data && membersQuery.data.length > 0 ? membersQuery.data : workspace?.members) ?? [];
    return normalizeWorkspaceMembers(raw);
  }, [membersQuery.data, workspace?.members]);

  const filteredMembers = useMemo(() => {
    return filterAndSortMembers(members, {
      search,
      roleFilter,
      sortField,
      sortDirection,
    });
  }, [members, search, roleFilter, sortField, sortDirection]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const updateRoleMutate = updateRoleMutation.mutate;
  const removeMutate = removeMutation.mutate;
  const leaveMutate = leaveMutation.mutate;
  const inviteMutateAsync = inviteMutation.mutateAsync;
  const revokeInviteMutate = revokeInviteMutation.mutate;

  const handleUpdateRole = useCallback(
    (userId: string, newRole: WorkspaceRole) => {
      updateRoleMutate({ userId, newRole });
    },
    [updateRoleMutate],
  );

  const handleRemoveMember = useCallback(
    (userId: string) => {
      removeMutate(userId, {
        onSuccess: () => setMemberToRemove(null),
      });
    },
    [removeMutate],
  );

  const handleLeave = useCallback(() => {
    leaveMutate();
  }, [leaveMutate]);

  const handleInviteMembers = useCallback(
    async (emails: string[], role: WorkspaceRole) => {
      await inviteMutateAsync({ emails, role });
    },
    [inviteMutateAsync],
  );

  const handleCancelInvite = useCallback(
    (inviteId: string) => {
      revokeInviteMutate(inviteId);
    },
    [revokeInviteMutate],
  );

  const handleImportCsv = useCallback(
    async (rows: { email: string; role: WorkspaceRole }[]) => {
      const validEmails = rows
        .map((r) => r.email?.trim())
        .filter((e) => e && e.includes('@'));

      if (validEmails.length > 0) {
        await inviteMutateAsync({
          emails: validEmails,
          role: 'member',
        });
      }
      setImportModalOpen(false);
    },
    [inviteMutateAsync],
  );

  const pendingInvites: WorkspacePendingInvite[] = useMemo(() => {
    return (pendingInvitesQuery.data as any[]) || [];
  }, [pendingInvitesQuery.data]);

  return {
    state: {
      workspace,
      currentUser,
      yourRole,
      canManage,
      members,
      filteredMembers,
      pendingInvites,
      activeTab,
      search,
      roleFilter,
      sortField,
      sortDirection,
      inviteModalOpen,
      importModalOpen,
      memberToRemove,
      memberToLeave,
      isLoading: isWorkspaceLoading || membersQuery.isLoading,
      isInvitesLoading: pendingInvitesQuery.isLoading,
      isInviting: inviteMutation.isPending,
      isRevokingInvite: revokeInviteMutation.isPending,
      isRemoving: removeMutation.isPending,
      isLeaving: leaveMutation.isPending,
    },
    actions: {
      setActiveTab,
      setSearch,
      setRoleFilter,
      handleSort,
      setInviteModalOpen,
      setImportModalOpen,
      setMemberToRemove,
      setMemberToLeave,
      handleUpdateRole,
      handleRemoveMember,
      handleLeave,
      handleLeaveWorkspace: handleLeave,
      handleInviteMembers,
      handleCancelInvite,
      handleImportCsv,
    },
  };
}
