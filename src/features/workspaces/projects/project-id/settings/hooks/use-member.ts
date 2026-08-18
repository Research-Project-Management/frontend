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
} from '@/features/workspaces/projects/shell/hooks/use-project';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getErrorMessage } from '@/shared/utils/error.util';
import type { ProjectMemberItem, ProjectRole } from '../types/member.types';
import {
  normalizeProjectMembers,
  filterAndSortProjectMembers,
  type ProjectMemberSortField,
} from '../utils/member.util';

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
  const [sortField, setSortField] = useState<ProjectMemberSortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Normalize project members
  const members: ProjectMemberItem[] = useMemo(() => {
    if (!project?.members) return [];
    return normalizeProjectMembers(project.members as any[], project.createdAt);
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

  const leadMember = useMemo(() => {
    return members.find((m) => m.userId === leadId) || null;
  }, [members, leadId]);

  const defaultAssigneeMember = useMemo(() => {
    return members.find((m) => m.userId === defaultAssigneeId) || null;
  }, [members, defaultAssigneeId]);

  // Handlers for Project Settings
  const updateSettings = useCallback(
    (newSettings: Record<string, any>) => {
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
    },
    [projectId, projectSettings, updateProjectMutation],
  );

  const setLead = useCallback(
    (userId: string | null) => {
      updateSettings({ leadId: userId });
    },
    [updateSettings],
  );

  const setDefaultAssignee = useCallback(
    (userId: string | null) => {
      updateSettings({ defaultAssigneeId: userId });
    },
    [updateSettings],
  );

  const toggleSubscriber = useCallback(
    (userId: string) => {
      const current = new Set(subscriberIds);
      if (current.has(userId)) {
        current.delete(userId);
      } else {
        current.add(userId);
      }
      updateSettings({ subscriberIds: Array.from(current) });
    },
    [subscriberIds, updateSettings],
  );

  const addMembers = useCallback(
    async (userIds: string[], role: ProjectRole | string = 'contributor') => {
      try {
        for (const userId of userIds) {
          await addMutation.mutateAsync({ projectId, userId, role });
        }
        toast.success('Member(s) added successfully');
      } catch (err: unknown) {
        toast.error(getErrorMessage(err) || 'Failed to add member');
      }
    },
    [projectId, addMutation],
  );

  const updateRole = useCallback(
    (userId: string, role: string) => {
      updateRoleMutation.mutate(
        { projectId, userId, role, newRole: role },
        {
          onSuccess: () => toast.success('Member role updated'),
          onError: (err: unknown) => toast.error(getErrorMessage(err) || 'Failed to update role'),
        },
      );
    },
    [projectId, updateRoleMutation],
  );

  const removeMember = useCallback(
    (userId: string) => {
      removeMutation.mutate(
        { projectId, userId },
        {
          onSuccess: () => toast.success('Member removed from project'),
          onError: (err: any) => toast.error(err?.message || 'Failed to remove member'),
        },
      );
    },
    [projectId, removeMutation],
  );

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    return filterAndSortProjectMembers(members, {
      search,
      roleFilter,
      sortField,
      sortAsc,
    });
  }, [members, search, roleFilter, sortField, sortAsc]);

  const toggleSort = useCallback((field: typeof sortField) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortAsc((prev) => !prev);
        return currentField;
      } else {
        setSortAsc(true);
        return field;
      }
    });
  }, []);

  // Permissions
  const isOwnerOrAdmin = useMemo(() => {
    const creatorId = project?.createdById || (project?.createdBy as any)?.id;
    const currentUserId = currentUser?.id;
    if (creatorId && currentUserId && creatorId === currentUserId) return true;
    if (workspaceRole === 'owner' || workspaceRole === 'admin') return true;
    const myMember = members.find((m) => m.userId === currentUserId);
    if (myMember?.role === 'owner' || myMember?.role === 'admin') return true;
    return false;
  }, [project, currentUser, workspaceRole, members]);

  return {
    state: {
      project,
      members,
      filteredMembers,
      workspace,
      workspaceRole,
      currentUser,
      isOwnerOrAdmin,
      leadId,
      leadMember,
      defaultAssigneeId,
      defaultAssigneeMember,
      subscriberIds,
      search,
      roleFilter,
      sortField,
      sortAsc,
      isLoading: isProjectLoading || isWorkspaceLoading,
      isError,
      isAdding: addMutation.isPending,
      isUpdatingRole: updateRoleMutation.isPending,
      isRemoving: removeMutation.isPending,
    },
    actions: {
      setLead,
      setDefaultAssignee,
      toggleSubscriber,
      addMembers,
      updateRole,
      removeMember,
      setSearch,
      setRoleFilter,
      toggleSort,
    },
  };
}
