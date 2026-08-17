'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiDelete, apiGet, apiPost, apiPut } from "@/shared/lib/api";
import { toast } from "sonner";

import type { Project } from "../types/project.types";
export type { Project };

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchProject = (projectId: string) =>
  apiGet<{ project: Project } | Project>(`/api/project/${projectId}`);

export const fetchProjectsByWorkspaceId = (workspaceIdOrUrl: string, signal?: AbortSignal) =>
  apiGet(`/api/workspace/${workspaceIdOrUrl}/projects`, { signal });

// ── Queries ───────────────────────────────────────────────────────────────────

export const useProject = (projectId: string, options?: { enabled?: boolean }) =>
  useQuery<{ project: Project } | Project>({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
    enabled: (options?.enabled ?? true) && !!projectId,
  });

// Alias — consolidates the old useProjectDetails (which called the same endpoint)
export const useProjectDetails = useProject;

export const useProjects = (workspaceId?: string) => {
  const params = useParams<{ workspaceId?: string; id?: string }>();
  const id = workspaceId || params?.workspaceId || params?.id;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["projects", id],
    queryFn: ({ signal }) => fetchProjectsByWorkspaceId(id!, signal),
    enabled: !!id,
  });

  const pData = data as any;
  const projectsList =
    pData?.projects ??
    pData?.data?.projects ??
    (Array.isArray(pData?.data) ? pData.data : Array.isArray(pData) ? pData : []);

  return {
    projects: projectsList as Project[],
    isLoading,
    isError,
  };
};

export const useWorkspaceProjects = useProjects;

// ── Create Project ────────────────────────────────────────────────────────────

export const createProject = (
  workspaceId: string,
  data: {
    name: string;
    avatar?: string;
    description?: string;
    modules?: string[];
    identifier?: string;
    isPrivate?: boolean;
    timezone?: string;
  }
) => apiPost<{ project?: Project; data?: Project } | Project>(`/api/workspace/${workspaceId}/projects`, data);

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      ...data
    }: {
      workspaceId: string;
      name: string;
      avatar?: string;
      description?: string;
      modules?: string[];
      identifier?: string;
      isPrivate?: boolean;
      timezone?: string;
    }) => createProject(workspaceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["projects-header", variables.workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspace", variables.workspaceId] });
      toast.success("Project created successfully", { id: "project-create-success" });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create project", { id: "project-create-error" });
    },
  });
};

// ── Member Management ─────────────────────────────────────────────────────────

export const fetchProjectMembers = (projectId: string) =>
  apiGet<{ members: any[] }>(`/api/project/${projectId}/members`);

export const useProjectMembers = (projectId: string) =>
  useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await fetchProjectMembers(projectId);
      return res.members || [];
    },
    enabled: Boolean(projectId),
  });

export const useAddProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId, role }: { projectId: string; userId: string; role?: string }) =>
      apiPost(`/api/project/${projectId}/members`, { userId, role: role || 'contributor' }),
    onMutate: async ({ projectId, userId, role }) => {
      await queryClient.cancelQueries({ queryKey: ["project", projectId] });
      const previousProject = queryClient.getQueryData(["project", projectId]);

      queryClient.setQueryData(["project", projectId], (old: any) => {
        if (!old) return old;
        const newMember = {
          user: { id: userId, _id: userId, name: "Adding...", email: "" },
          role: role || "contributor",
          joinedAt: new Date().toISOString(),
        };
        return {
          ...old,
          project: old.project ? {
            ...old.project,
            members: [...(old.project.members || []), newMember]
          } : {
            ...old,
            members: [...(old.members || []), newMember]
          }
        };
      });

      return { previousProject };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(["project", variables.projectId], context.previousProject);
      }
      toast.error(error.message || "Failed to add member", { id: "p-member-error" });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-members", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
  });
};

export const useUpdateProjectMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      userId,
      newRole,
      role,
    }: {
      projectId: string;
      userId: string;
      newRole?: string;
      role?: string;
    }) =>
      apiPut(`/api/project/${projectId}/members/${userId}`, {
        role: role || newRole || 'contributor',
      }),
    onMutate: async ({ projectId, userId, newRole, role }) => {
      const targetRole = role || newRole;
      await queryClient.cancelQueries({ queryKey: ["project", projectId] });
      const previousProject = queryClient.getQueryData(["project", projectId]);

      queryClient.setQueryData(["project", projectId], (old: any) => {
        if (!old) return old;
        const updateMembers = (members: any[]) =>
          members.map((m) =>
            (m.user?._id === userId || m.user?.id === userId || m.userId === userId)
              ? { ...m, role: targetRole }
              : m
          );

        return {
          ...old,
          project: old.project ? {
            ...old.project,
            members: updateMembers(old.project.members || [])
          } : {
            ...old,
            members: updateMembers(old.members || [])
          }
        };
      });

      return { previousProject };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(["project", variables.projectId], context.previousProject);
      }
      toast.error(error.message || "Failed to update member role", { id: "p-member-error" });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-members", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
  });
};

export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      apiDelete(`/api/project/${projectId}/members/${userId}`),
    onMutate: async ({ projectId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["project", projectId] });
      const previousProject = queryClient.getQueryData(["project", projectId]);

      queryClient.setQueryData(["project", projectId], (old: any) => {
        if (!old) return old;
        const filterMembers = (members: any[]) =>
          members.filter((m) => m.user?._id !== userId && m.user?.id !== userId && m.userId !== userId);

        return {
          ...old,
          project: old.project ? {
            ...old.project,
            members: filterMembers(old.project.members || [])
          } : {
            ...old,
            members: filterMembers(old.members || [])
          }
        };
      });

      return { previousProject };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(["project", variables.projectId], context.previousProject);
      }
      toast.error(error.message || "Failed to remove member", { id: "p-member-error" });
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-members", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
  });
};

// ── Update Project ────────────────────────────────────────────────────────────

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: {
      projectId: string;
      name?: string;
      description?: string;
      avatar?: string | null;
      cover?: string | null;
      identifier?: string;
      isPrivate?: boolean;
      timezone?: string;
      isArchived?: boolean;
      modules?: string[];
      subscriberIds?: string[];
    }) => apiPut(`/api/project/${projectId}`, data),
    onMutate: async (newProject) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["project", newProject.projectId] });
      await queryClient.cancelQueries({ queryKey: ["project-overview", newProject.projectId] });

      // Snapshot the previous value
      const previousProject = queryClient.getQueryData(["project", newProject.projectId]);
      const previousOverview = queryClient.getQueryData(["project-overview", newProject.projectId]);

      // Optimistically update to the new value
      if (previousProject) {
        queryClient.setQueryData(["project", newProject.projectId], (old: any) => ({
          ...old,
          ...newProject,
          // Handle the edge case where data from API might be nested
          project: old.project ? { ...old.project, ...newProject } : undefined
        }));
      }

      if (previousOverview) {
        queryClient.setQueryData(["project-overview", newProject.projectId], (old: any) => ({
          ...old,
          project: { ...old.project, ...newProject }
        }));
      }

      return { previousProject, previousOverview };
    },
    onError: (error: any, newProject, context) => {
      // Rollback to the previous value if mutation fails
      if (context?.previousProject) {
        queryClient.setQueryData(["project", newProject.projectId], context.previousProject);
      }
      if (context?.previousOverview) {
        queryClient.setQueryData(["project-overview", newProject.projectId], context.previousOverview);
      }
      toast.error(error.message || "Failed to update project", { id: "project-error" });
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success to ensure server sync
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-header", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects-header"] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId }: { projectId: string }) =>
      apiDelete(`/api/project/${projectId}`),
    onSuccess: (_data, variables) => {
      queryClient.removeQueries({ queryKey: ["project", variables.projectId] });
      queryClient.removeQueries({ queryKey: ["project-overview", variables.projectId] });

      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-header"] });
      queryClient.invalidateQueries({ queryKey: ["project-header"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Project removed", { id: "project-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete project", { id: "project-error" });
    },
  });
};
