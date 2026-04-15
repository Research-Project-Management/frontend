import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPost, apiPut } from "~/lib/api";

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

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
    enabled: !!projectId,
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
    onSuccess: (_, variables) => {
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
    onSuccess: (_, variables) => {
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
    onSuccess: (_, variables) => {
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
    onSuccess: (_, variables) => {
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

      // Keep workspace/project switchers and lists in sync after project removal.
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects-header"] });
      queryClient.invalidateQueries({ queryKey: ["project-header"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};
