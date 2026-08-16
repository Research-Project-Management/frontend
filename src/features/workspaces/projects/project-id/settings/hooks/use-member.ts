'use client';

import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  useProjectDetails,
  useAddProjectMember,
  useUpdateProjectMemberRole,
  useRemoveProjectMember,
  useUpdateProject,
} from '@/features/workspaces/projects/shell';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useAuth } from '@/features/auth';
import type { ProjectMemberItem, ProjectRole } from '../types/member.types';

export function useMembers(projectId: string) {
  const { workspaceId: workspaceUrl } = useParams() as { workspaceId: string };
  const { user: currentUser } = useAuth();
  
  const { data: projectData, isLoading: isProjectLoading, isError } = useProjectDetails(projectId);
  const { workspace, yourRole: workspaceRole, isLoading: isWorkspaceLoading } = useWorkspace(workspaceUrl);
  
  const project = useMemo(() => {
    return (projectData as any)?.project || projectData || null;
  }, [projectData]);

  // Mutations
  const addMutation = useAddProjectMember();
  const updateRoleMutation = useUpdateProjectMemberRole();
  const removeMutation = useRemoveProjectMember();
  const updateProjectMutation = useUpdateProject();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'displayName' | 'email' | 'role' | 'date'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Normalize project members
  const members: ProjectMemberItem[] = useMemo(() => {
    if (!project?.members) return [];
    return (project.members as any[]).map((m) => {
      const u = m.user || {};
      const uId = u.id || u._id || m.userId || '';
      return {
        id: m.id || uId,
        userId: uId,
        user: {
          id: uId,
          _id: uId,
          name: u.name || 'Unknown User',
          email: u.email || '',
          avatar: u.avatar || '',
        },
        role: m.role || 'member',
        joinedAt: m.joinedAt || project.createdAt || new Date().toISOString(),
      };
    });
  }, [project]);

  // Project settings (lead, assignee, subscribers)
  const projectSettings = useMemo(() => {
    return project?.settings || {};
  }, [project]);

  const leadId = projectSettings.leadId || null;
  const defaultAssigneeId = projectSettings.defaultAssigneeId || null;
  const subscriberIds: string[] = useMemo(() => {
    return projectSettings.subscriberIds || [];
  }, [projectSettings]);

  // Lead, Assignee, Subscribers members
  const leadMember = useMemo(() => {
    return members.find((m) => m.userId === leadId) || null;
  }, [members, leadId]);

  const defaultAssigneeMember = useMemo(() => {
    return members.find((m) => m.userId === defaultAssigneeId) || null;
  }, [members, defaultAssigneeId]);

  // Handlers for Project Settings
  const updateSettings = useCallback((newSettings: Record<string, any>) => {
    const merged = {
      ...projectSettings,
      ...newSettings,
    };
    updateProjectMutation.mutate(
      { projectId, settings: merged } as any,
      {
        onSuccess: () => {
          toast.success('Project settings updated');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update project settings');
        },
      },
    );
  }, [projectId, projectSettings, updateProjectMutation]);

  const setLead = useCallback((userId: string | null) => {
    updateSettings({ leadId: userId });
  }, [updateSettings]);

  const setDefaultAssignee = useCallback((userId: string | null) => {
    updateSettings({ defaultAssigneeId: userId });
  }, [updateSettings]);

  const toggleSubscriber = useCallback((userId: string) => {
    const current = new Set(subscriberIds);
    if (current.has(userId)) {
      current.delete(userId);
    } else {
      current.add(userId);
    }
    updateSettings({ subscriberIds: Array.from(current) });
  }, [subscriberIds, updateSettings]);

  // Handlers for Members
  const addMembers = useCallback(async (userIds: string[], role: ProjectRole = 'member') => {
    try {
      for (const userId of userIds) {
        await addMutation.mutateAsync({ projectId, userId, role });
      }
      toast.success('Member(s) added successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add member');
    }
  }, [projectId, addMutation]);

  const updateRole = useCallback((userId: string, role: string) => {
    updateRoleMutation.mutate(
      { projectId, userId, newRole: role },
      {
        onSuccess: () => toast.success('Member role updated'),
        onError: (err: any) => toast.error(err?.message || 'Failed to update role'),
      },
    );
  }, [projectId, updateRoleMutation]);

  const removeMember = useCallback((userId: string) => {
    removeMutation.mutate(
      { projectId, userId },
      {
        onSuccess: () => toast.success('Member removed from project'),
        onError: (err: any) => toast.error(err?.message || 'Failed to remove member'),
      },
    );
  }, [projectId, removeMutation]);

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    let list = members.filter((m) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.user.name.toLowerCase().includes(q) ||
        (m.user.email || '').toLowerCase().includes(q);
      
      const matchRole = !roleFilter || m.role.toLowerCase() === roleFilter.toLowerCase();

      return matchSearch && matchRole;
    });

    list.sort((a, b) => {
      let valA = '';
      let valB = '';
      if (sortField === 'name') {
        valA = a.user.name.toLowerCase();
        valB = b.user.name.toLowerCase();
      } else if (sortField === 'displayName') {
        valA = (a.user.email?.split('@')[0] || a.user.name).toLowerCase();
        valB = (b.user.email?.split('@')[0] || b.user.name).toLowerCase();
      } else if (sortField === 'email') {
        valA = (a.user.email || '').toLowerCase();
        valB = (b.user.email || '').toLowerCase();
      } else if (sortField === 'role') {
        valA = a.role.toLowerCase();
        valB = b.role.toLowerCase();
      } else if (sortField === 'date') {
        valA = a.joinedAt;
        valB = b.joinedAt;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [members, search, roleFilter, sortField, sortAsc]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Permissions
  const isOwnerOrAdmin = useMemo(() => {
    const creatorId = project?.createdById || (project?.createdBy as any)?.id || (project?.createdBy as any)?._id;
    const currentUserId = currentUser?.id || (currentUser as any)?._id;
    if (creatorId && currentUserId && creatorId === currentUserId) return true;
    if (workspaceRole === 'owner' || workspaceRole === 'admin') return true;
    const myMember = members.find((m) => m.userId === currentUserId);
    if (myMember?.role === 'owner' || myMember?.role === 'admin') return true;
    return false;
  }, [project, currentUser, workspaceRole, members]);

  return {
    project,
    members,
    filteredMembers,
    workspace,
    workspaceRole,
    currentUser,
    isOwnerOrAdmin,
    isLoading: isProjectLoading || isWorkspaceLoading,
    isError,
    // Project Settings
    leadId,
    leadMember,
    setLead,
    defaultAssigneeId,
    defaultAssigneeMember,
    setDefaultAssignee,
    subscriberIds,
    toggleSubscriber,
    // Member actions
    addMembers,
    updateRole,
    removeMember,
    isAdding: addMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemoving: removeMutation.isPending,
    // Search & Filter
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    sortField,
    sortAsc,
    toggleSort,
  };
}
