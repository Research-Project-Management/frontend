'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ProjectService,
  projectKeys,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '../services/project.service';

// ── Types & Context Interfaces ────────────────────────────────────────────────

export interface CreateProjectVariables extends CreateProjectInput {
  workspaceId: string;
}

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

export interface ProjectMutationContext {
  previousProject?: unknown;
  previousOverview?: unknown;
}

// ── 1. Mutation Hooks (Individual Granular Operations) ─────────────────────────

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, CreateProjectVariables>({
    mutationFn: ({ workspaceId, ...data }: CreateProjectVariables) =>
      ProjectService.create(workspaceId, data),
    onSuccess: (_data: unknown, variables: CreateProjectVariables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all(variables.workspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectsHeader(variables.workspaceId) });
      queryClient.invalidateQueries({ queryKey: ['workspace', variables.workspaceId] });
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
        queryClient.setQueryData(projectKeys.byId(newProject.projectId), (old: any) => ({
          ...old,
          ...newProject,
          project: old?.project ? { ...old.project, ...newProject } : undefined,
        }));
      }

      if (previousOverview) {
        queryClient.setQueryData(projectKeys.overview(newProject.projectId), (old: any) => ({
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

      queryClient.setQueryData(projectKeys.byId(projectId), (old: any) => {
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

      queryClient.setQueryData(projectKeys.byId(projectId), (old: any) => {
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

      queryClient.setQueryData(projectKeys.byId(projectId), (old: any) => {
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

      queryClient.setQueryData(projectKeys.byId(projectId), (old: any) => {
        if (!old) return old;
        const newMember = {
          user: { id: userId, name: 'Adding...', email: '' },
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

      queryClient.setQueryData(projectKeys.byId(projectId), (old: any) => {
        if (!old) return old;
        const updateMembers = (members: any[]) =>
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

      queryClient.setQueryData(projectKeys.byId(projectId), (old: any) => {
        if (!old) return old;
        const filterMembers = (members: any[]) =>
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

// ── 2. OOP { state, actions } Pattern Hook: useProjects ───────────────────────

export interface UseProjectsState {
  readonly projects: Project[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly total: number;
}

export interface UseProjectsActions {
  refetch: () => Promise<any>;
  createProject: (data: CreateProjectInput) => Promise<any>;
  updateProject: (data: Partial<UpdateProjectInput> & { projectId: string }) => Promise<any>;
  archiveProject: (projectId: string) => Promise<any>;
  restoreProject: (projectId: string) => Promise<any>;
  toggleFavorite: (projectId: string, isFavorite: boolean) => Promise<any>;
  deleteProject: (projectId: string) => Promise<any>;
}

export interface UseProjectsReturn {
  state: UseProjectsState;
  actions: UseProjectsActions;
  // Direct getters for backward compatibility
  projects: Project[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<any>;
}

export function useProjects(workspaceId?: string): UseProjectsReturn {
  const params = useParams<{ workspaceId?: string; id?: string }>();
  const id = workspaceId || params?.workspaceId || params?.id;

  const query = useQuery({
    queryKey: projectKeys.all(id),
    queryFn: ({ signal }: { signal?: AbortSignal }) => ProjectService.getAll(id!, signal),
    enabled: !!id,
  });

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const archiveMutation = useArchiveProject();
  const restoreMutation = useRestoreProject();
  const toggleFavMutation = useToggleProjectFavorite();
  const deleteMutation = useDeleteProject();

  const pData = query.data as any;
  const projectsList: Project[] = useMemo(() => {
    return (
      pData?.projects ??
      pData?.data?.projects ??
      (Array.isArray(pData?.data) ? pData.data : Array.isArray(pData) ? pData : [])
    );
  }, [pData]);

  const state: UseProjectsState = useMemo(
    () => ({
      projects: projectsList,
      isLoading: query.isLoading,
      isError: query.isError,
      total: projectsList.length,
    }),
    [projectsList, query.isLoading, query.isError]
  );

  const actions: UseProjectsActions = useMemo(
    () => ({
      refetch: query.refetch,
      createProject: (data: CreateProjectInput) =>
        createMutation.mutateAsync({ workspaceId: id!, ...data }),
      updateProject: (data: Partial<UpdateProjectInput> & { projectId: string }) =>
        updateMutation.mutateAsync(data),
      archiveProject: (projectId: string) => archiveMutation.mutateAsync({ projectId }),
      restoreProject: (projectId: string) => restoreMutation.mutateAsync({ projectId }),
      toggleFavorite: (projectId: string, isFavorite: boolean) =>
        toggleFavMutation.mutateAsync({ projectId, isFavorite }),
      deleteProject: (projectId: string) => deleteMutation.mutateAsync({ projectId }),
    }),
    [
      id,
      query.refetch,
      createMutation,
      updateMutation,
      archiveMutation,
      restoreMutation,
      toggleFavMutation,
      deleteMutation,
    ]
  );

  return {
    state,
    actions,
    projects: projectsList,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export const useWorkspaceProjects = useProjects;

// ── 3. OOP { state, actions } Pattern Hook: useProject ────────────────────────

export interface UseProjectState {
  readonly project: Project | null;
  readonly raw: { project: Project } | Project | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export interface UseProjectActions {
  refetch: () => Promise<any>;
  update: (data: Partial<UpdateProjectInput>) => Promise<any>;
  archive: () => Promise<any>;
  restore: () => Promise<any>;
  toggleFavorite: (isFavorite: boolean) => Promise<any>;
  delete: () => Promise<any>;
  addMember: (userId: string, role?: string) => Promise<any>;
  updateMemberRole: (userId: string, role: string) => Promise<any>;
  removeMember: (userId: string) => Promise<any>;
}

export interface UseProjectReturn {
  state: UseProjectState;
  actions: UseProjectActions;
  // React query direct aliases
  data?: { project: Project } | Project;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<any>;
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
    return (query.data as any)?.project || (query.data as any)?.data || query.data;
  }, [query.data]);

  const state: UseProjectState = useMemo(
    () => ({
      project,
      raw: query.data,
      isLoading: query.isLoading,
      isError: query.isError,
    }),
    [project, query.data, query.isLoading, query.isError]
  );

  const actions: UseProjectActions = useMemo(
    () => ({
      refetch: query.refetch,
      update: (data: Partial<UpdateProjectInput>) =>
        updateMutation.mutateAsync({ projectId, ...data }),
      archive: () => archiveMutation.mutateAsync({ projectId }),
      restore: () => restoreMutation.mutateAsync({ projectId }),
      toggleFavorite: (isFavorite: boolean) =>
        toggleFavMutation.mutateAsync({ projectId, isFavorite }),
      delete: () => deleteMutation.mutateAsync({ projectId }),
      addMember: (userId: string, role?: string) =>
        addMemberMutation.mutateAsync({ projectId, userId, role }),
      updateMemberRole: (userId: string, role: string) =>
        updateRoleMutation.mutateAsync({ projectId, userId, role }),
      removeMember: (userId: string) =>
        removeMemberMutation.mutateAsync({ projectId, userId }),
    }),
    [
      projectId,
      query.refetch,
      updateMutation,
      archiveMutation,
      restoreMutation,
      toggleFavMutation,
      deleteMutation,
      addMemberMutation,
      updateRoleMutation,
      removeMemberMutation,
    ]
  );

  return {
    state,
    actions,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export const useProjectDetails = useProject;

// ── 4. OOP { state, actions } Pattern Hook: useProjectMembers ─────────────────

export interface UseProjectMembersState {
  readonly members: any[];
  readonly isLoading: boolean;
  readonly isError: boolean;
}

export interface UseProjectMembersActions {
  refetch: () => Promise<any>;
  addMember: (userId: string, role?: string) => Promise<any>;
  updateMemberRole: (userId: string, role: string) => Promise<any>;
  removeMember: (userId: string) => Promise<any>;
}

export interface UseProjectMembersReturn {
  state: UseProjectMembersState;
  actions: UseProjectMembersActions;
  members: any[];
  data: any[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<any>;
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

  const actions: UseProjectMembersActions = useMemo(
    () => ({
      refetch: query.refetch,
      addMember: (userId: string, role?: string) =>
        addMemberMutation.mutateAsync({ projectId, userId, role }),
      updateMemberRole: (userId: string, role: string) =>
        updateRoleMutation.mutateAsync({ projectId, userId, role }),
      removeMember: (userId: string) =>
        removeMemberMutation.mutateAsync({ projectId, userId }),
    }),
    [projectId, query.refetch, addMemberMutation, updateRoleMutation, removeMemberMutation]
  );

  return {
    state,
    actions,
    members,
    data: members,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
