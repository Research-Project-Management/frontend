'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ProjectService,
  projectKeys,
  fetchUserProjects,
  duplicateProjectApi,
  fetchTrashedProjects,
  restoreTrashedProjectApi,
  permanentDeleteProjectApi,
  fetchDefaultStatesTemplate,
  checkProjectIdentifierApi,
  type Project,
  type ProjectPermissions,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectMember,
} from '../services/project.service';

// ── Types & Context Interfaces ────────────────────────────────────────────────

interface ProjectCacheEntry {
  isArchived?: boolean;
  isFavorite?: boolean;
  project?: {
    isArchived?: boolean;
    isFavorite?: boolean;
    members?: ProjectMember[];
    [key: string]: unknown;
  };
  members?: ProjectMember[];
  [key: string]: unknown;
}


export interface CreateProjectVariables extends CreateProjectInput {}

export interface UpdateProjectVariables extends Partial<UpdateProjectInput> {
  projectId: string;
}

export interface ProjectIdVariables {
  projectId: string;
}

export interface ToggleProjectFavoriteVariables {
  projectId: string;
  isFavorite: boolean;
}

export interface AddProjectMemberVariables {
  projectId: string;
  userId: string;
  role?: string;
}

export interface UpdateProjectMemberRoleVariables {
  projectId: string;
  userId: string;
  newRole?: string;
  role?: string;
}

export interface RemoveProjectMemberVariables {
  projectId: string;
  userId: string;
}

export interface TransferProjectOwnershipVariables {
  projectId: string;
  newOwnerId: string;
}

export interface ProjectMutationContext {
  previousProject?: unknown;
  previousOverview?: unknown;
}

// ── 1. Mutation Hooks (Individual Granular Operations) ─────────────────────────

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, CreateProjectVariables>({
    mutationFn: (data: CreateProjectVariables) =>
      ProjectService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
      toast.success('Project created successfully', { id: 'project-create-success' });
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to create project', { id: 'project-create-error' });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateProjectVariables, ProjectMutationContext>({
    mutationFn: ({ projectId, ...data }: UpdateProjectVariables) =>
      ProjectService.update(projectId, data),
    onMutate: async (newProject: UpdateProjectVariables): Promise<ProjectMutationContext> => {
      await queryClient.cancelQueries({ queryKey: projectKeys.byId(newProject.projectId) });
      await queryClient.cancelQueries({ queryKey: projectKeys.overview(newProject.projectId) });

      const previousProject = queryClient.getQueryData(projectKeys.byId(newProject.projectId));
      const previousOverview = queryClient.getQueryData(projectKeys.overview(newProject.projectId));

      if (previousProject) {
        queryClient.setQueryData(projectKeys.byId(newProject.projectId), (old: ProjectCacheEntry | undefined) => ({
          ...old,
          ...newProject,
          project: old?.project ? { ...old.project, ...newProject } : undefined,
        }));
      }

      if (previousOverview) {
        queryClient.setQueryData(projectKeys.overview(newProject.projectId), (old: ProjectCacheEntry | undefined) => ({
          ...old,
          project: { ...(old?.project || {}), ...newProject },
        }));
      }

      return { previousProject, previousOverview };
    },
    onError: (error: Error, newProject: UpdateProjectVariables, context?: ProjectMutationContext) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.byId(newProject.projectId), context.previousProject);
      }
      if (context?.previousOverview) {
        queryClient.setQueryData(projectKeys.overview(newProject.projectId), context.previousOverview);
      }
      toast.error(error.message || 'Failed to update project', { id: 'project-error' });
    },
    onSettled: (_data: unknown, _error: Error | null, variables?: UpdateProjectVariables) => {
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.overview(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.header(variables.projectId) });
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
    },
  });
};

export const useArchiveProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ProjectIdVariables, ProjectMutationContext>({
    mutationFn: ({ projectId }: ProjectIdVariables) => ProjectService.archive(projectId),
    onMutate: async ({ projectId }: ProjectIdVariables): Promise<ProjectMutationContext> => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all() });
      await queryClient.cancelQueries({ queryKey: projectKeys.byId(projectId) });
      const previousProject = queryClient.getQueryData(projectKeys.byId(projectId));

      queryClient.setQueryData(projectKeys.byId(projectId), (old: ProjectCacheEntry | undefined) => {
        if (!old) return old;
        return {
          ...old,
          isArchived: true,
          project: old.project ? { ...old.project, isArchived: true } : undefined,
        };
      });

      return { previousProject };
    },
    onSuccess: () => {
      toast.success('Project archived successfully', { id: 'project-archive-success' });
    },
    onError: (error: Error, { projectId }: ProjectIdVariables, context?: ProjectMutationContext) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.byId(projectId), context.previousProject);
      }
      toast.error(error.message || 'Failed to archive project', { id: 'project-archive-error' });
    },
    onSettled: (_data: unknown, _error: Error | null, variables?: ProjectIdVariables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
    },
  });
};

export const useRestoreProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ProjectIdVariables, ProjectMutationContext>({
    mutationFn: ({ projectId }: ProjectIdVariables) => ProjectService.restore(projectId),
    onMutate: async ({ projectId }: ProjectIdVariables): Promise<ProjectMutationContext> => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all() });
      await queryClient.cancelQueries({ queryKey: projectKeys.byId(projectId) });
      const previousProject = queryClient.getQueryData(projectKeys.byId(projectId));

      queryClient.setQueryData(projectKeys.byId(projectId), (old: ProjectCacheEntry | undefined) => {
        if (!old) return old;
        return {
          ...old,
          isArchived: false,
          project: old.project ? { ...old.project, isArchived: false } : undefined,
        };
      });

      return { previousProject };
    },
    onSuccess: () => {
      toast.success('Project restored to active workspace', { id: 'project-restore-success' });
    },
    onError: (error: Error, { projectId }: ProjectIdVariables, context?: ProjectMutationContext) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.byId(projectId), context.previousProject);
      }
      toast.error(error.message || 'Failed to restore project', { id: 'project-restore-error' });
    },
    onSettled: (_data: unknown, _error: Error | null, variables?: ProjectIdVariables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
    },
  });
};

export const useToggleProjectFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ToggleProjectFavoriteVariables, ProjectMutationContext>({
    mutationFn: ({ projectId, isFavorite }: ToggleProjectFavoriteVariables) =>
      ProjectService.toggleFavorite(projectId, isFavorite),
    onMutate: async ({ projectId, isFavorite }: ToggleProjectFavoriteVariables): Promise<ProjectMutationContext> => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all() });
      await queryClient.cancelQueries({ queryKey: projectKeys.byId(projectId) });
      const previousProject = queryClient.getQueryData(projectKeys.byId(projectId));

      queryClient.setQueryData(projectKeys.byId(projectId), (old: ProjectCacheEntry | undefined) => {
        if (!old) return old;
        return {
          ...old,
          isFavorite,
          project: old.project ? { ...old.project, isFavorite } : undefined,
        };
      });

      return { previousProject };
    },
    onError: (error: Error, { projectId }: ToggleProjectFavoriteVariables, context?: ProjectMutationContext) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.byId(projectId), context.previousProject);
      }
      toast.error(error.message || 'Failed to update favorite', { id: 'project-favorite-error' });
    },
    onSettled: (_data: unknown, _error: Error | null, variables?: ToggleProjectFavoriteVariables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ProjectIdVariables>({
    mutationFn: ({ projectId }: ProjectIdVariables) => ProjectService.delete(projectId),
    onSuccess: (_data: unknown, variables: ProjectIdVariables) => {
      queryClient.removeQueries({ queryKey: projectKeys.byId(variables.projectId) });
      queryClient.removeQueries({ queryKey: projectKeys.overview(variables.projectId) });

      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
      queryClient.invalidateQueries({ queryKey: projectKeys.header(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('Project permanently deleted', { id: 'project-action' });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete project', { id: 'project-error' });
    },
  });
};

export const useAddProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, AddProjectMemberVariables, ProjectMutationContext>({
    mutationFn: ({ projectId, userId, role }: AddProjectMemberVariables) =>
      ProjectService.addMember(projectId, userId, role),
    onMutate: async ({ projectId, userId, role }: AddProjectMemberVariables): Promise<ProjectMutationContext> => {
      await queryClient.cancelQueries({ queryKey: projectKeys.byId(projectId) });
      const previousProject = queryClient.getQueryData(projectKeys.byId(projectId));

      queryClient.setQueryData(projectKeys.byId(projectId), (old: ProjectCacheEntry | undefined) => {
        if (!old) return old;
        const newMember: ProjectMember = {
          userId,
          user: { id: userId, name: 'Adding...', email: undefined, avatar: undefined },
          role: role || 'contributor',
          joinedAt: new Date().toISOString(),
        };
        return {
          ...old,
          project: old.project
            ? { ...old.project, members: [...(old.project.members || []), newMember] }
            : { ...old, members: [...(old.members || []), newMember] },
        };
      });

      return { previousProject };
    },
    onError: (error: Error, _variables: AddProjectMemberVariables, context?: ProjectMutationContext) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.byId(_variables.projectId), context.previousProject);
      }
      toast.error(error.message || 'Failed to add member', { id: 'p-member-error' });
    },
    onSettled: (_data: unknown, _error: Error | null, variables?: AddProjectMemberVariables) => {
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.overview(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.members(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
      }
    },
  });
};

export const useUpdateProjectMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, UpdateProjectMemberRoleVariables, ProjectMutationContext>({
    mutationFn: ({
      projectId,
      userId,
      newRole,
      role,
    }: UpdateProjectMemberRoleVariables) =>
      ProjectService.updateMemberRole(projectId, userId, role || newRole || 'contributor'),
    onMutate: async ({ projectId, userId, newRole, role }: UpdateProjectMemberRoleVariables): Promise<ProjectMutationContext> => {
      const targetRole = role || newRole;
      await queryClient.cancelQueries({ queryKey: projectKeys.byId(projectId) });
      const previousProject = queryClient.getQueryData(projectKeys.byId(projectId));

      queryClient.setQueryData(projectKeys.byId(projectId), (old: ProjectCacheEntry | undefined) => {
        if (!old) return old;
        const updateMembers = (members: ProjectMember[]) =>
          members.map((m) =>
            m.user?.id === userId || m.userId === userId
              ? { ...m, role: targetRole }
              : m
          );

        return {
          ...old,
          project: old.project
            ? { ...old.project, members: updateMembers(old.project.members || []) }
            : { ...old, members: updateMembers(old.members || []) },
        };
      });

      return { previousProject };
    },
    onError: (error: Error, variables: UpdateProjectMemberRoleVariables, context?: ProjectMutationContext) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.byId(variables.projectId), context.previousProject);
      }
      toast.error(error.message || 'Failed to update member role', { id: 'p-member-error' });
    },
    onSettled: (_data: unknown, _error: Error | null, variables?: UpdateProjectMemberRoleVariables) => {
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.overview(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.members(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
      }
    },
  });
};

export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, RemoveProjectMemberVariables, ProjectMutationContext>({
    mutationFn: ({ projectId, userId }: RemoveProjectMemberVariables) =>
      ProjectService.removeMember(projectId, userId),
    onMutate: async ({ projectId, userId }: RemoveProjectMemberVariables): Promise<ProjectMutationContext> => {
      await queryClient.cancelQueries({ queryKey: projectKeys.byId(projectId) });
      const previousProject = queryClient.getQueryData(projectKeys.byId(projectId));

      queryClient.setQueryData(projectKeys.byId(projectId), (old: ProjectCacheEntry | undefined) => {
        if (!old) return old;
        const filterMembers = (members: ProjectMember[]) =>
          members.filter((m) => m.user?.id !== userId && m.userId !== userId);

        return {
          ...old,
          project: old.project
            ? { ...old.project, members: filterMembers(old.project.members || []) }
            : { ...old, members: filterMembers(old.members || []) },
        };
      });

      return { previousProject };
    },
    onError: (error: Error, variables: RemoveProjectMemberVariables, context?: ProjectMutationContext) => {
      if (context?.previousProject) {
        queryClient.setQueryData(projectKeys.byId(variables.projectId), context.previousProject);
      }
      toast.error(error.message || 'Failed to remove member', { id: 'p-member-error' });
    },
    onSettled: (_data: unknown, _error: Error | null, variables?: RemoveProjectMemberVariables) => {
      if (variables?.projectId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.overview(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.members(variables.projectId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
      }
    },
  });
};

export const useTransferProjectOwnership = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, TransferProjectOwnershipVariables>({
    mutationFn: ({ projectId, newOwnerId }: TransferProjectOwnershipVariables) =>
      ProjectService.transferOwnership(projectId, newOwnerId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.overview(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.members(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.byId(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      toast.success('Project ownership transferred successfully', { id: 'p-transfer-owner' });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to transfer project ownership', { id: 'p-transfer-owner-error' });
    },
  });
};

// ── 2. OOP { state, actions } Pattern Hook: useProjects ───────────────────────

export interface UseProjectsState {
  readonly projects: Project[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly total: number;
}

export interface UseProjectsActions {
  refetch: () => Promise<unknown>;
  createProject: (data: CreateProjectInput) => Promise<unknown>;
  updateProject: (data: Partial<UpdateProjectInput> & { projectId: string }) => Promise<unknown>;
  archiveProject: (projectId: string) => Promise<unknown>;
  restoreProject: (projectId: string) => Promise<unknown>;
  toggleFavorite: (projectId: string, isFavorite: boolean) => Promise<unknown>;
  deleteProject: (projectId: string) => Promise<unknown>;
}

export interface UseProjectsReturn {
  state: UseProjectsState;
  actions: UseProjectsActions;
  // Direct getters for backward compatibility
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

export function useProjects(options?: { isArchived?: boolean }): UseProjectsReturn {
  const query = useQuery({
    queryKey: projectKeys.all(),
    queryFn: ({ signal }: { signal?: AbortSignal }) => fetchUserProjects('all', signal),
  });

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const archiveMutation = useArchiveProject();
  const restoreMutation = useRestoreProject();
  const toggleFavMutation = useToggleProjectFavorite();
  const deleteMutation = useDeleteProject();

  const pData = query.data as Record<string, unknown> | undefined;
  const projectsList: Project[] = useMemo(() => {
    if (!pData) return [];
    if (Array.isArray(pData)) return pData as Project[];
    if (Array.isArray(pData.projects)) return pData.projects as Project[];
    if (typeof pData.data === 'object' && pData.data !== null) {
      const nested = pData.data as Record<string, unknown>;
      if (Array.isArray(nested.projects)) return nested.projects as Project[];
      if (Array.isArray(nested)) return nested as Project[];
    }
    return [];
  }, [pData]);

  const state: UseProjectsState = useMemo(
    () => ({
      projects: projectsList,
      isLoading: query.isLoading,
      isError: query.isError,
      error: (query.error as Error) ?? null,
      total: projectsList.length,
    }),
    [projectsList, query.isLoading, query.isError, query.error]
  );

  const createMutAsync = createMutation.mutateAsync;
  const updateMutAsync = updateMutation.mutateAsync;
  const archiveMutAsync = archiveMutation.mutateAsync;
  const restoreMutAsync = restoreMutation.mutateAsync;
  const toggleFavMutAsync = toggleFavMutation.mutateAsync;
  const deleteMutAsync = deleteMutation.mutateAsync;
  const queryRefetch = query.refetch;

  const actions: UseProjectsActions = useMemo(
    () => ({
      refetch: queryRefetch,
      createProject: (data: CreateProjectInput) =>
        createMutAsync(data),
      updateProject: (data: Partial<UpdateProjectInput> & { projectId: string }) =>
        updateMutAsync(data),
      archiveProject: (projectId: string) => archiveMutAsync({ projectId }),
      restoreProject: (projectId: string) => restoreMutAsync({ projectId }),
      toggleFavorite: (projectId: string, isFavorite: boolean) =>
        toggleFavMutAsync({ projectId, isFavorite }),
      deleteProject: (projectId: string) => deleteMutAsync({ projectId }),
    }),
    [
      queryRefetch,
      createMutAsync,
      updateMutAsync,
      archiveMutAsync,
      restoreMutAsync,
      toggleFavMutAsync,
      deleteMutAsync,
    ]
  );

  return useMemo(
    () => ({
      state,
      actions,
      projects: projectsList,
      isLoading: query.isLoading,
      isError: query.isError,
      error: (query.error as Error) ?? null,
      refetch: query.refetch,
    }),
    [state, actions, projectsList, query.isLoading, query.isError, query.error, query.refetch]
  );
}

export const useWorkspaceProjects = useProjects;

// ── 3. OOP { state, actions } Pattern Hook: useProject ────────────────────────

export interface UseProjectState {
  readonly project: Project | null;
  readonly yourRole: string | null;
  readonly permissions: ProjectPermissions | null;
  readonly raw: { project: Project } | Project | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export interface UseProjectActions {
  refetch: () => Promise<unknown>;
  update: (data: Partial<UpdateProjectInput>) => Promise<unknown>;
  archive: () => Promise<unknown>;
  restore: () => Promise<unknown>;
  toggleFavorite: (isFavorite: boolean) => Promise<unknown>;
  delete: () => Promise<unknown>;
  addMember: (userId: string, role?: string) => Promise<unknown>;
  updateMemberRole: (userId: string, role: string) => Promise<unknown>;
  removeMember: (userId: string) => Promise<unknown>;
}

export interface UseProjectReturn {
  state: UseProjectState;
  actions: UseProjectActions;
  // React query direct aliases
  project: Project | null;
  yourRole: string | null;
  permissions: ProjectPermissions | null;
  data?: { project: Project } | Project;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

export function useProject(
  projectId: string,
  options?: { enabled?: boolean }
): UseProjectReturn {
  const query = useQuery<{ project: Project } | Project>({
    queryKey: projectKeys.byId(projectId),
    queryFn: () => ProjectService.getById(projectId),
    enabled: (options?.enabled ?? true) && !!projectId,
  });

  const updateMutation = useUpdateProject();
  const archiveMutation = useArchiveProject();
  const restoreMutation = useRestoreProject();
  const toggleFavMutation = useToggleProjectFavorite();
  const deleteMutation = useDeleteProject();
  const addMemberMutation = useAddProjectMember();
  const updateRoleMutation = useUpdateProjectMemberRole();
  const removeMemberMutation = useRemoveProjectMember();

  const project: Project | null = useMemo(() => {
    if (!query.data) return null;
    const dataObj = query.data as Record<string, unknown>;
    if ('project' in dataObj && dataObj.project) {
      return dataObj.project as Project;
    }
    if ('data' in dataObj && dataObj.data && typeof dataObj.data === 'object') {
      return dataObj.data as Project;
    }
    return query.data as unknown as Project;
  }, [query.data]);

  const yourRole = useMemo(() => {
    if (!query.data) return null;
    const dataObj = query.data as Record<string, unknown>;
    const nestedProject = dataObj.project as Record<string, unknown> | undefined;
    return (
      (dataObj.yourRole as string | null | undefined) ||
      (nestedProject?.yourRole as string | null | undefined) ||
      project?.yourRole ||
      null
    );
  }, [query.data, project]);

  const permissions = useMemo<ProjectPermissions | null>(() => {
    if (!query.data) return null;
    const dataObj = query.data as Record<string, unknown>;
    const nestedProject = dataObj.project as Record<string, unknown> | undefined;
    return (
      (dataObj.permissions as ProjectPermissions | null | undefined) ||
      (nestedProject?.permissions as ProjectPermissions | null | undefined) ||
      project?.permissions ||
      null
    );
  }, [query.data, project]);

  const state: UseProjectState = useMemo(
    () => ({
      project,
      yourRole,
      permissions,
      raw: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
    }),
    [project, yourRole, permissions, query.data, query.isLoading, query.isError]
  );

  const updateMutAsync = updateMutation.mutateAsync;
  const archiveMutAsync = archiveMutation.mutateAsync;
  const restoreMutAsync = restoreMutation.mutateAsync;
  const toggleFavMutAsync = toggleFavMutation.mutateAsync;
  const deleteMutAsync = deleteMutation.mutateAsync;
  const addMemberMutAsync = addMemberMutation.mutateAsync;
  const updateRoleMutAsync = updateRoleMutation.mutateAsync;
  const removeMemberMutAsync = removeMemberMutation.mutateAsync;
  const projectQueryRefetch = query.refetch;

  const actions: UseProjectActions = useMemo(
    () => ({
      refetch: projectQueryRefetch,
      update: (data: Partial<UpdateProjectInput>) =>
        updateMutAsync({ projectId, ...data }),
      archive: () => archiveMutAsync({ projectId }),
      restore: () => restoreMutAsync({ projectId }),
      toggleFavorite: (isFavorite: boolean) =>
        toggleFavMutAsync({ projectId, isFavorite }),
      delete: () => deleteMutAsync({ projectId }),
      addMember: (userId: string, role?: string) =>
        addMemberMutAsync({ projectId, userId, role }),
      updateMemberRole: (userId: string, role: string) =>
        updateRoleMutAsync({ projectId, userId, role }),
      removeMember: (userId: string) =>
        removeMemberMutAsync({ projectId, userId }),
    }),
    [
      projectId,
      projectQueryRefetch,
      updateMutAsync,
      archiveMutAsync,
      restoreMutAsync,
      toggleFavMutAsync,
      deleteMutAsync,
      addMemberMutAsync,
      updateRoleMutAsync,
      removeMemberMutAsync,
    ]
  );

  return useMemo(
    () => ({
      state,
      actions,
      project: state.project,
      yourRole,
      permissions,
      data: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: query.refetch,
    }),
    [state, actions, yourRole, permissions, query.data, query.isLoading, query.isError, query.refetch]
  );
}

export const useProjectDetails = useProject;

// ── 4. OOP { state, actions } Pattern Hook: useProjectMembers ─────────────────

export interface UseProjectMembersState {
  readonly members: ProjectMember[];
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export interface UseProjectMembersActions {
  refetch: () => Promise<unknown>;
  addMember: (userId: string, role?: string) => Promise<unknown>;
  updateMemberRole: (userId: string, role: string) => Promise<unknown>;
  removeMember: (userId: string) => Promise<unknown>;
}

export interface UseProjectMembersReturn {
  state: UseProjectMembersState;
  actions: UseProjectMembersActions;
  members: ProjectMember[];
  data: ProjectMember[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

export function useProjectMembers(projectId: string): UseProjectMembersReturn {
  const query = useQuery({
    queryKey: projectKeys.members(projectId),
    queryFn: async () => {
      const res = await ProjectService.getMembers(projectId);
      return res.members || [];
    },
    enabled: Boolean(projectId),
  });

  const addMemberMutation = useAddProjectMember();
  const updateRoleMutation = useUpdateProjectMemberRole();
  const removeMemberMutation = useRemoveProjectMember();

  const members = useMemo(() => query.data || [], [query.data]);

  const state: UseProjectMembersState = useMemo(
    () => ({
      members,
      isLoading: query.isLoading,
      isError: query.isError,
    }),
    [members, query.isLoading, query.isError]
  );

  const memberAddMutAsync = addMemberMutation.mutateAsync;
  const memberRoleMutAsync = updateRoleMutation.mutateAsync;
  const memberRemoveMutAsync = removeMemberMutation.mutateAsync;
  const memberQueryRefetch = query.refetch;

  const actions: UseProjectMembersActions = useMemo(
    () => ({
      refetch: memberQueryRefetch,
      addMember: (userId: string, role?: string) =>
        memberAddMutAsync({ projectId, userId, role }),
      updateMemberRole: (userId: string, role: string) =>
        memberRoleMutAsync({ projectId, userId, role }),
      removeMember: (userId: string) =>
        memberRemoveMutAsync({ projectId, userId }),
    }),
    [projectId, memberQueryRefetch, memberAddMutAsync, memberRoleMutAsync, memberRemoveMutAsync]
  );

  return useMemo(
    () => ({
      state,
      actions,
      members,
      data: members,
      isLoading: query.isLoading,
      isError: query.isError,
      refetch: query.refetch,
    }),
    [state, actions, members, query.isLoading, query.isError, query.refetch]
  );
}

// ── Duplicate Project ─────────────────────────────────────────────────────────

export const useDuplicateProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ProjectIdVariables>({
    mutationFn: ({ projectId }: ProjectIdVariables) => duplicateProjectApi(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
      toast.success('Project duplicated successfully', { id: 'project-duplicate-success' });
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to duplicate project', { id: 'project-duplicate-error' });
    },
  });
};

// ── Trash (Soft-deleted projects) ─────────────────────────────────────────────

export const trashProjectKeys = {
  all: () => ['projects', 'trash'] as const,
};

export const useTrashedProjects = () => {
  const query = useQuery({
    queryKey: trashProjectKeys.all(),
    queryFn: ({ signal }) => fetchTrashedProjects(signal),
    staleTime: 30_000,
  });

  const queryData = query.data as { projects?: Project[] } | undefined;
  const projects = queryData?.projects ?? [];
  return {
    projects,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
};

export const useRestoreTrashedProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ProjectIdVariables>({
    mutationFn: ({ projectId }: ProjectIdVariables) => restoreTrashedProjectApi(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trashProjectKeys.all() });
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader() });
      toast.success('Project restored from trash', { id: 'project-restore-trash-success' });
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to restore project from trash', {
        id: 'project-restore-trash-error',
      });
    },
  });
};

export const usePermanentDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, ProjectIdVariables>({
    mutationFn: ({ projectId }: ProjectIdVariables) => permanentDeleteProjectApi(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trashProjectKeys.all() });
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      toast.success('Project permanently deleted', { id: 'project-permanent-delete-success' });
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to permanently delete project', {
        id: 'project-permanent-delete-error',
      });
    },
  });
};

export const useDefaultStatesTemplate = () => {
  return useQuery({
    queryKey: ['projects', 'states', 'default-template'],
    queryFn: fetchDefaultStatesTemplate,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
};

export const useCheckProjectIdentifier = (
  identifier?: string,
  name?: string,
  enabled = true,
) => {
  return useQuery({
    queryKey: ['projects', 'check-identifier', identifier, name],
    queryFn: () => checkProjectIdentifierApi(identifier, name),
    enabled: enabled && (Boolean(identifier) || Boolean(name)),
    staleTime: 5000,
  });
};


