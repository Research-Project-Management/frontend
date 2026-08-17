'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/constants';
import { useWorkspace } from '@/features/workspaces/shell';
import { useAuth } from '@/features/auth';
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
} from '@/features/workspaces/settings/services/settings.service';
import type { WorkspaceMemberItem, WorkspaceRole } from '../types/member.types';

export type SortField = 'name' | 'displayName' | 'email' | 'role' | 'auth' | 'date';
export type SortDirection = 'asc' | 'desc';

export function useMember(workspaceId: string) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { workspace, isLoading: isWorkspaceLoading, yourRole } = useWorkspace(workspaceId);

  const invalidateDetail = queryKeys.workspaces.detail(workspaceId);
  const invalidateAll = queryKeys.workspaces.all;

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
            if (w._id !== workspaceId && w.id !== workspaceId) return w;
            return {
              ...w,
              members: w.members?.map((m: any) =>
                m.user?._id === userId || m.user?.id === userId ? { ...m, role: newRole } : m,
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
    return raw.map((m: any) => {
      const u = m.user || {};
      const auth = u.authProvider || u.provider || (u.email?.endsWith('@gmail.com') ? 'Google' : 'Email');
      return {
        id: m.id || m._id || u.id || u._id || '',
        userId: u.id || u._id || m.userId || '',
        role: (m.role || 'member').toLowerCase() as WorkspaceRole,
        createdAt: m.createdAt || m.joinedAt || new Date().toISOString(),
        authProvider: auth,
        user: {
          id: u.id || u._id || '',
          _id: u._id || u.id || '',
          name: u.name || u.fullName || u.email?.split('@')[0] || 'Unknown User',
          email: u.email || '',
          avatar: u.avatar || null,
          displayName: u.displayName || u.name?.toLowerCase().replace(/\s+/g, '') || u.email?.split('@')[0] || '',
          authProvider: auth,
        },
      };
    });
  }, [membersQuery.data, workspace?.members]);

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = members.filter((m) => {
      const matchesSearch =
        !q ||
        m.user.name.toLowerCase().includes(q) ||
        (m.user.displayName || '').toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q);

      const matchesRole = roleFilter.length === 0 || roleFilter.includes(m.role);

      return matchesSearch && matchesRole;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.user.name.localeCompare(b.user.name);
          break;
        case 'displayName':
          cmp = (a.user.displayName || '').localeCompare(b.user.displayName || '');
          break;
        case 'email':
          cmp = a.user.email.localeCompare(b.user.email);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'auth':
          cmp = (a.authProvider || '').localeCompare(b.authProvider || '');
          break;
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDirection === 'asc' ? cmp : -cmp;
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

  const handleUpdateRole = useCallback(
    (userId: string, newRole: WorkspaceRole) => {
      updateRoleMutation.mutate({ userId, newRole });
    },
    [updateRoleMutation],
  );

  const handleRemoveMember = useCallback(
    (userId: string) => {
      removeMutation.mutate(userId, {
        onSuccess: () => setMemberToRemove(null),
      });
    },
    [removeMutation],
  );

  const handleLeave = useCallback(() => {
    leaveMutation.mutate();
  }, [leaveMutation]);

  const handleInviteMembers = useCallback(
    async (emails: string[], role: WorkspaceRole) => {
      for (const email of emails) {
        const trimmed = email.trim();
        if (trimmed) {
          await addMutation.mutateAsync({ userId: trimmed, role });
        }
      }
      setInviteModalOpen(false);
    },
    [addMutation],
  );

  const handleImportCsv = useCallback(
    async (rows: { email: string; role: WorkspaceRole }[]) => {
      let count = 0;
      for (const { email, role } of rows) {
        if (email?.includes('@')) {
          try {
            await addMutation.mutateAsync({ userId: email.trim(), role: role || 'member' });
            count++;
          } catch {}
        }
      }
      toast.success(`Imported ${count} members successfully`);
      setImportModalOpen(false);
    },
    [addMutation],
  );

  return {
    state: {
      workspace,
      currentUser,
      yourRole,
      canManage,
      members,
      filteredMembers,
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
      isInviting: addMutation.isPending,
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
      handleImportCsv,
    },
  };
}
