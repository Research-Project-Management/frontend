'use client';

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  useProjectDetails,
  useAddProjectMember,
  useUpdateProjectMemberRole,
  useRemoveProjectMember,
  useUpdateProject,
} from '@/features/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getErrorMessage } from "@/shared/lib/utils";
import type { ProjectMemberItem, ProjectRole } from '../types/member.types';
import {
  normalizeProjectMembers,
  filterAndSortProjectMembers,
  type ProjectMemberSortField,
} from '../utils/member.util';

export function useMembers(projectId: string) {
  const { user: currentUser } = useAuth();

  const {
    data: projectData,
    yourRole,
    permissions,
    isLoading: isProjectLoading,
    isError,
  } = useProjectDetails(projectId);

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

  // Project settings (default assignee)
  const projectSettings = useMemo(() => {
    return project?.settings || {};
  }, [project]);

  const defaultAssigneeId = projectSettings.defaultAssigneeId || null;
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
            toast.success('Project settings updated', { id: 'settings-member' });
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to update project settings', { id: 'settings-member' });
          },
        },
      );
    },
    [projectId, projectSettings, updateProjectMutation],
  );

  const setDefaultAssignee = useCallback(
    (userId: string | null) => {
      updateSettings({ defaultAssigneeId: userId });
    },
    [updateSettings],
  );

  const addMembers = useCallback(
    async (userIds: string[], role: ProjectRole | string = 'contributor') => {
      try {
        for (const userId of userIds) {
          await addMutation.mutateAsync({ projectId, userId, role });
        }
        toast.success('Member(s) added successfully', { id: 'settings-member' });
      } catch (err: unknown) {
        toast.error(getErrorMessage(err) || 'Failed to add member', { id: 'settings-member' });
      }
    },
    [projectId, addMutation],
  );

  const updateRole = useCallback(
    (userId: string, role: string) => {
      updateRoleMutation.mutate(
        { projectId, userId, role, newRole: role },
        {
          onSuccess: () => toast.success('Member role updated', { id: 'settings-member' }),
          onError: (err: unknown) => toast.error(getErrorMessage(err) || 'Failed to update role', { id: 'settings-member' }),
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
          onSuccess: () => toast.success('Member removed from project', { id: 'settings-member' }),
          onError: (err: any) => toast.error(err?.message || 'Failed to remove member', { id: 'settings-member' }),
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

  // Permissions derived authoritatively from server (SSOT & Zero-Trust)
  const isOwner = useMemo(() => {
    if (yourRole) return yourRole === 'owner';
    if (permissions) return permissions.canManageMembers;
    if (project?.yourRole) return project.yourRole === 'owner';
    return Boolean(project?.permissions?.canManageMembers);
  }, [yourRole, permissions, project]);

  return {
    state: {
      project,
      members,
      filteredMembers,
      currentUser,
      isOwner,
      isOwnerOrAdmin: isOwner,
      defaultAssigneeId,
      defaultAssigneeMember,
      search,
      roleFilter,
      sortField,
      sortAsc,
      isLoading: isProjectLoading,
      isError,
      isAdding: addMutation.isPending,
      isUpdatingRole: updateRoleMutation.isPending,
      isRemoving: removeMutation.isPending,
    },
    actions: {
      setDefaultAssignee,
      addMembers,
      updateRole,
      removeMember,
      setSearch,
      setRoleFilter,
      toggleSort,
    },
  };
}
