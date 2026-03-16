import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut, apiDelete } from "~/lib/api";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchAllWorkspaces = () => apiGet(`/api/workspace`);

// NOTE: workspaceId param có thể là workspace._id (ObjectId) HOẶC workspace.url (string)
// FE đang dùng workspace.url trong URL routing
export const fetchWorkspaceById = (workspaceIdOrUrl: string) =>
  apiGet(`/api/workspace/${workspaceIdOrUrl}`);

export const fetchProjectsByWorkspaceId = (workspaceIdOrUrl: string) =>
  apiGet(`/api/workspace/${workspaceIdOrUrl}/projects`);

// ── Queries ───────────────────────────────────────────────────────────────────

export const useWorkspaces = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchAllWorkspaces,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: false,
    select: (data: any) => {
      const workspaces = (data?.workspaces || []) as any[];
      const uniqueWorkspaces = Array.from(
        new Map(workspaces.map((w) => [w._id, w])).values(),
      ) as any[];
      return { workspaces: uniqueWorkspaces };
    },
  });

  return { workspaces: (data?.workspaces || []) as any[], isLoading, error };
};

// workspaceUrl: Truyền vào workspace.url (NOT _id) từ URL params
export const useWorkspace = (workspaceUrl: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace", workspaceUrl],
    queryFn: () => fetchWorkspaceById(workspaceUrl),
    enabled: !!workspaceUrl,
  });

  return { workspace: data?.workspace, yourRole: data?.yourRole, isLoading, error };
};

// ── Workspace Member Management ───────────────────────────────────────────────

export const useAddWorkspaceMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userId, role = "member" }: { workspaceId: string; userId: string; role?: string }) =>
      apiPut(`/api/workspace/${workspaceId}/add-member`, { userId, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};

export const useUpdateWorkspaceMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userId, newRole }: { workspaceId: string; userId: string; newRole: string }) =>
      apiPut(`/api/workspace/${workspaceId}/update-member-role`, { userId, newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};

export const useRemoveWorkspaceMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId: string }) =>
      apiPut(`/api/workspace/${workspaceId}/remove-member`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};

// ── Workspace CRUD ────────────────────────────────────────────────────────────

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: Partial<{ name: string; avatar?: string | null; companySize?: string; timezone?: string; url?: string }>;
    }) => apiPut(`/api/workspace/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/workspace/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};
