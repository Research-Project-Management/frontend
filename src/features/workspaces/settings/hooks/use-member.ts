'use client';

import { useState, useMemo, useCallback } from 'react';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/shared/constants';
import {
  AddMemberBodySchema,
  UpdateMemberRoleBodySchema,
} from '@/features/workspaces/settings/schemas/settings.schema';
import {
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
} from '@/features/workspaces/settings/services/settings.service';
import type { WorkspaceMemberItem, WorkspaceRole } from '../types/member.types';

// ── Mutations ─────────────────────────────────────────────────────────────────

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
              if (w._id !== workspaceId && w.id !== workspaceId) return w;
              return {
                ...w,
                members: w.members?.map((m: any) =>
                  m.user?._id === userId || m.user?.id === userId ? { ...m, role: newRole } : m
                ) || []
              };
            })
          };
        }
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

// ── Main useMember hook for MemberPage ────────────────────────────────────────

export function useMember(workspaceId: string) {
  const { user: currentUser } = useAuth();
  const { workspace, isLoading, yourRole } = useWorkspace(workspaceId);

  const addMemberMutation = useAddWorkspaceMember();
  const updateRoleMutation = useUpdateWorkspaceMemberRole();
  const removeMemberMutation = useRemoveWorkspaceMember();

  // Search & Filter State
  const [activeTab, setActiveTab] = useState<'people' | 'pending'>('people');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [authFilter, setAuthFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'displayName' | 'email' | 'role' | 'auth' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberItem | null>(null);

  // Normalized Members
  const rawMembers = workspace?.members || [];

  const members: WorkspaceMemberItem[] = useMemo(() => {
    return rawMembers.map((m: any) => {
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
  }, [rawMembers]);

  // Filtered & Sorted Members
  const filteredMembers = useMemo(() => {
    let result = members.filter((m) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.user.name.toLowerCase().includes(q) ||
        (m.user.displayName || '').toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q);

      const matchesRole =
        roleFilter === 'all' || m.role === roleFilter.toLowerCase();

      const matchesAuth =
        authFilter === 'all' || (m.authProvider || '').toLowerCase() === authFilter.toLowerCase();

      return matchesSearch && matchesRole && matchesAuth;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.user.name.localeCompare(b.user.name);
      } else if (sortField === 'displayName') {
        cmp = (a.user.displayName || '').localeCompare(b.user.displayName || '');
      } else if (sortField === 'email') {
        cmp = a.user.email.localeCompare(b.user.email);
      } else if (sortField === 'role') {
        cmp = a.role.localeCompare(b.role);
      } else if (sortField === 'auth') {
        cmp = (a.authProvider || '').localeCompare(b.authProvider || '');
      } else {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [members, search, roleFilter, authFilter, sortField, sortDirection]);

  // Permission Check
  const canManage = yourRole === 'owner' || yourRole === 'admin';

  // Actions
  const handleUpdateRole = useCallback(
    (userId: string, newRole: WorkspaceRole) => {
      if (!workspace) return;
      const wsId = (workspace as any).id || workspace._id;
      updateRoleMutation.mutate({
        workspaceId: wsId,
        userId,
        newRole,
      });
    },
    [updateRoleMutation, workspace]
  );

  const handleRemoveMember = useCallback(
    (userId: string) => {
      if (!workspace) return;
      const wsId = (workspace as any).id || workspace._id;
      removeMemberMutation.mutate(
        {
          workspaceId: wsId,
          userId,
        },
        {
          onSuccess: () => setMemberToRemove(null),
        }
      );
    },
    [removeMemberMutation, workspace]
  );

  const handleInviteMembers = useCallback(
    async (emails: string[], role: WorkspaceRole) => {
      if (!workspace) return;
      const wsId = (workspace as any).id || workspace._id;
      for (const email of emails) {
        if (email.trim()) {
          await addMemberMutation.mutateAsync({
            workspaceId: wsId,
            userId: email.trim(),
            role,
          });
        }
      }
      setInviteModalOpen(false);
    },
    [addMemberMutation, workspace]
  );

  const handleImportCsv = useCallback(
    async (rows: { email: string; role: WorkspaceRole }[]) => {
      if (!workspace) return;
      const wsId = (workspace as any).id || workspace._id;
      let count = 0;
      for (const row of rows) {
        if (row.email && row.email.includes('@')) {
          try {
            await addMemberMutation.mutateAsync({
              workspaceId: wsId,
              userId: row.email.trim(),
              role: row.role || 'member',
            });
            count++;
          } catch {}
        }
      }
      toast.success(`Imported ${count} members successfully`);
      setImportModalOpen(false);
    },
    [addMemberMutation, workspace]
  );

  const toggleSort = (field: 'name' | 'displayName' | 'email' | 'role' | 'auth' | 'date') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return {
    workspace,
    currentUser,
    isLoading,
    yourRole,
    canManage,
    // Tab
    activeTab,
    setActiveTab,
    // Data
    members,
    filteredMembers,
    // Filter & Sort
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    authFilter,
    setAuthFilter,
    sortField,
    sortDirection,
    toggleSort,
    // Modals
    inviteModalOpen,
    setInviteModalOpen,
    importModalOpen,
    setImportModalOpen,
    memberToRemove,
    setMemberToRemove,
    // Handlers
    handleUpdateRole,
    handleRemoveMember,
    handleInviteMembers,
    handleImportCsv,
    isInviting: addMemberMutation.isPending,
    isRemoving: removeMemberMutation.isPending,
  };
}
