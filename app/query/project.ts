import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "~/lib/api";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Project = {
  _id: string;
  name: string;
  description: string;
  avatar?: string;
  isActive: boolean;
  modules: string[];
  workspace: string;
  members: {
    user: { _id: string; name: string; email: string; avatar?: string };
    role: string;
    joinedAt: string;
  }[];
  createdBy: { _id: string; name: string; email: string; avatar?: string };
  createdAt: string;
  updatedAt: string;
};

export type ProjectOverviewData = {
  project: Project;
  stats: {
    files: { count: number; totalSize: number; recent: any[] };
    tasks: { total: number; completed: number; pending: number; inProgress: number };
    members: number;
  };
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchProject = (projectId: string) =>
  apiGet(`/api/project/${projectId}`);

export const fetchProjectOverview = (projectId: string) =>
  apiGet<ProjectOverviewData>(`/api/project/${projectId}/overview`);

// ── Queries ───────────────────────────────────────────────────────────────────

export const useProject = (projectId: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
    enabled: (options?.enabled ?? true) && !!projectId,
  });

export const useProjectOverview = (projectId: string) =>
  useQuery<ProjectOverviewData>({
    queryKey: ["project-overview", projectId],
    queryFn: () => fetchProjectOverview(projectId),
    enabled: !!projectId,
  });

// Alias — consolidates the old useProjectDetails (which called the same endpoint)
export const useProjectDetails = useProject;

// ── Member Management ─────────────────────────────────────────────────────────

export const useAddProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId, role }: { projectId: string; userId: string; role?: string }) =>
      apiPut(`/api/project/${projectId}/add-member`, { userId, role }),
    onMutate: async ({ projectId, userId, role }) => {
      await queryClient.cancelQueries({ queryKey: ["project", projectId] });
      const previousProject = queryClient.getQueryData(["project", projectId]);

      queryClient.setQueryData(["project", projectId], (old: any) => {
        if (!old) return old;
        const newMember = {
          user: { _id: userId, name: "Adding...", email: "" },
          role: role || "member",
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
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
  });
};

export const useUpdateProjectMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId, newRole }: { projectId: string; userId: string; newRole: string }) =>
      apiPut(`/api/project/${projectId}/update-member-role`, { userId, newRole }),
    onMutate: async ({ projectId, userId, newRole }) => {
      await queryClient.cancelQueries({ queryKey: ["project", projectId] });
      const previousProject = queryClient.getQueryData(["project", projectId]);

      queryClient.setQueryData(["project", projectId], (old: any) => {
        if (!old) return old;
        const updateMembers = (members: any[]) =>
          members.map((m) => (m.user._id === userId ? { ...m, role: newRole } : m));

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
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
  });
};

export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      apiPut(`/api/project/${projectId}/remove-member`, { userId }),
    onMutate: async ({ projectId, userId }) => {
      await queryClient.cancelQueries({ queryKey: ["project", projectId] });
      const previousProject = queryClient.getQueryData(["project", projectId]);

      queryClient.setQueryData(["project", projectId], (old: any) => {
        if (!old) return old;
        const filterMembers = (members: any[]) =>
          members.filter((m) => m.user._id !== userId);

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
      queryClient.invalidateQueries({ queryKey: ["project", variables.projectId] });
    },
  });
};

// ── Update Project ────────────────────────────────────────────────────────────

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: {
      projectId: string; name?: string; description?: string; avatar?: string; modules?: string[];
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
