import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPut,
} from "~/lib/api";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecentItem = {
  type: "page" | "project" | "file";
  id: string;
  name: string;
  icon: string;
  project?: { _id: string; name: string; avatar?: string };
  author: { _id: string; name: string; avatar?: string; email: string };
  lastEdited: string;
};

export type Activity = {
  type: "page_update" | "file_upload" | "task_update";
  user: { _id: string; name: string; avatar?: string; email: string };
  content: string;
  time: string;
  itemId: string;
  project?: { _id: string; name: string };
};

export type DeleteWorkspaceResult = {
  alreadyDeleted: boolean;
  workspaceId: string;
};

type WorkspacesQueryData =
  | { workspaces?: Array<{ _id?: string }> }
  | Array<{ _id?: string }>
  | undefined;

type WorkspaceDetailQueryData =
  | { workspace?: { _id?: string; url?: string } }
  | { _id?: string; url?: string }
  | undefined;

type WorkspacePatch = Partial<{
  _id: string;
  url: string;
  name: string;
  avatar: string | null;
  companySize: string;
  timezone: string;
}>;

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchAllWorkspaces = (signal?: AbortSignal) =>
  apiGet(`/api/workspace`, { signal });

export const fetchWorkspaceById = (
  workspaceIdOrUrl: string,
  signal?: AbortSignal,
) => apiGet(`/api/workspace/${workspaceIdOrUrl}`, { signal });

export const fetchProjectsByWorkspaceId = (
  workspaceIdOrUrl: string,
  signal?: AbortSignal,
) => apiGet(`/api/workspace/${workspaceIdOrUrl}/projects`, { signal });

// ── Helpers ───────────────────────────────────────────────────────────────────

const removeWorkspaceFromWorkspacesData = (
  current: WorkspacesQueryData,
  workspaceId: string,
) => {
  if (Array.isArray(current)) {
    return current.filter((workspace) => workspace?._id !== workspaceId);
  }

  if (Array.isArray(current?.workspaces)) {
    return {
      ...current,
      workspaces: current.workspaces.filter(
        (workspace) => workspace?._id !== workspaceId,
      ),
    };
  }

  return current;
};

const mergeWorkspace = (current: any, patch: WorkspacePatch) => ({
  ...current,
  ...patch,
});

const syncWorkspaceIntoWorkspacesData = (
  current: WorkspacesQueryData,
  workspacePatch: WorkspacePatch,
) => {
  if (!workspacePatch._id) return current;

  if (Array.isArray(current)) {
    return current.map((workspace) =>
      workspace?._id === workspacePatch._id
        ? mergeWorkspace(workspace, workspacePatch)
        : workspace,
    );
  }

  if (Array.isArray(current?.workspaces)) {
    return {
      ...current,
      workspaces: current.workspaces.map((workspace) =>
        workspace?._id === workspacePatch._id
          ? mergeWorkspace(workspace, workspacePatch)
          : workspace,
      ),
    };
  }

  return current;
};

export const removeWorkspaceFromWorkspacesCache = (
  queryClient: QueryClient,
  workspaceId: string,
) => {
  queryClient.setQueriesData(
    { queryKey: ["workspaces"] },
    (current: WorkspacesQueryData) =>
      removeWorkspaceFromWorkspacesData(current, workspaceId),
  );
};

export const syncWorkspaceIntoCaches = (
  queryClient: QueryClient,
  workspacePatch: WorkspacePatch,
) => {
  if (!workspacePatch._id) return;

  queryClient.setQueriesData(
    { queryKey: ["workspaces"] },
    (current: WorkspacesQueryData) =>
      syncWorkspaceIntoWorkspacesData(current, workspacePatch),
  );

  queryClient.setQueriesData(
    { queryKey: ["workspace"] },
    (current: WorkspaceDetailQueryData) => {
      if (!current) return current;

      if ("workspace" in current && current.workspace?._id === workspacePatch._id) {
        return {
          ...current,
          workspace: mergeWorkspace(current.workspace, workspacePatch),
        };
      }

      if ("_id" in current && current._id === workspacePatch._id) {
        return mergeWorkspace(current, workspacePatch);
      }

      return current;
    },
  );
};

export const deleteWorkspaceById = async (
  workspaceId: string,
): Promise<DeleteWorkspaceResult> => {
  try {
    await apiDelete(`/api/workspace/${workspaceId}`);
    return { workspaceId, alreadyDeleted: false };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { workspaceId, alreadyDeleted: true };
    }

    throw error;
  }
};

// ── Queries ───────────────────────────────────────────────────────────────────

export const useWorkspaces = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspaces"],
    queryFn: ({ signal }) => fetchAllWorkspaces(signal),
    staleTime: 1000 * 60 * 5, // 5 minutes
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

export const useWorkspace = (workspaceUrl: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace", workspaceUrl],
    queryFn: ({ signal }) => fetchWorkspaceById(workspaceUrl, signal),
    enabled: !!workspaceUrl,
  });

  return { workspace: data?.workspace, yourRole: data?.yourRole, isLoading, error };
};

export const useWorkspaceProjects = (workspaceId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace-projects", workspaceId],
    queryFn: ({ signal }) => fetchProjectsByWorkspaceId(workspaceId, signal),
    enabled: !!workspaceId,
  });

  return { projects: (data?.projects || []) as any[], isLoading, error };
};

export const useRecentItems = (workspaceId: string) =>
  useQuery({
    queryKey: ["workspace", workspaceId, "recent"],
    queryFn: async () => {
      const data = await apiGet<{ items: RecentItem[] }>(`/api/workspace/${workspaceId}/recent`);
      return data.items;
    },
    enabled: !!workspaceId,
  });

export const useActivityFeed = (workspaceId: string) =>
  useQuery({
    queryKey: ["workspace", workspaceId, "activity"],
    queryFn: async () => {
      const data = await apiGet<{ activities: Activity[] }>(`/api/workspace/${workspaceId}/activity`);
      return data.activities;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

// ── Workspace Member Management ───────────────────────────────────────────────

export const useAddWorkspaceMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userId, role = "member" }: { workspaceId: string; userId: string; role?: string }) =>
      apiPut(`/api/workspace/${workspaceId}/add-member`, { userId, role }),
    onMutate: () => {
      toast.loading("Adding member...", { id: "ws-member-action" });
    },
    onSuccess: (data) => {
      if (data?.workspace) {
        syncWorkspaceIntoCaches(queryClient, data.workspace);
      }
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Member added", { id: "ws-member-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to add member", { id: "ws-member-action" });
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
    }) =>
      apiPut(`/api/workspace/${workspaceId}/update-member-role`, {
        userId,
        newRole,
      }),
    onMutate: async ({ workspaceId, userId, newRole }) => {
      toast.loading("Updating member role...", { id: "ws-member-action" });

      await queryClient.cancelQueries({ queryKey: ["workspace"] });

      const previousWorkspaceQueries = queryClient.getQueriesData({
        queryKey: ["workspace"],
      });

      const rolesData: any = queryClient.getQueryData(["roles", workspaceId]);
      const roles = Array.isArray(rolesData) ? rolesData : rolesData?.roles || [];
      const roleObject = roles.find((r: any) => r.name.toLowerCase() === newRole.toLowerCase());

      queryClient.setQueriesData(
        { queryKey: ["workspace"] },
        (old: any) => {
          if (!old?.workspace?.members) return old;
          return {
            ...old,
            workspace: {
              ...old.workspace,
              members: old.workspace.members.map((m: any) =>
                m.user._id === userId 
                  ? { ...m, role: roleObject ? { ...roleObject } : newRole } 
                  : m
              ),
            },
          };
        }
      );

      return { previousWorkspaceQueries };
    },
    onError: (error: any, _variables: any, context: any) => {
      context?.previousWorkspaceQueries?.forEach(([queryKey, data]: [any, any]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(error.message || "Failed to update member role", { id: "ws-member-action" });
    },
    onSuccess: (data) => {
      if (data?.workspace) {
        syncWorkspaceIntoCaches(queryClient, data.workspace);
      }
      toast.success("Member role updated", { id: "ws-member-action" });
    },
    onSettled: (_data, _error, _variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace"],
      });
    },
  });
};

export const useRemoveWorkspaceMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId: string }) =>
      apiPut(`/api/workspace/${workspaceId}/remove-member`, { userId }),
    onMutate: () => {
      toast.loading("Removing member...", { id: "ws-member-action" });
    },
    onSuccess: (data) => {
      if (data?.workspace) {
        syncWorkspaceIntoCaches(queryClient, data.workspace);
      }
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Member removed", { id: "ws-member-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove member", { id: "ws-member-action" });
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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["workspace"] });
      await queryClient.cancelQueries({ queryKey: ["workspaces"] });

      const previousWorkspaceQueries = queryClient.getQueriesData({
        queryKey: ["workspace"],
      });
      const previousWorkspacesQueries = queryClient.getQueriesData({
        queryKey: ["workspaces"],
      });

      syncWorkspaceIntoCaches(queryClient, { _id: id, ...data });

      return {
        previousWorkspaceQueries,
        previousWorkspacesQueries,
      };
    },
    onSuccess: (data) => {
      if (data?.workspace) {
        syncWorkspaceIntoCaches(queryClient, data.workspace);
      }
    },
    onError: (error: any, _variables, context) => {
      context?.previousWorkspaceQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousWorkspacesQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(error.message || "Failed to update workspace", { id: "ws-error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkspaceById,
    onMutate: async (workspaceId: string) => {
      await queryClient.cancelQueries({ queryKey: ["workspaces"] });
      const previousWorkspaces = queryClient.getQueriesData({
        queryKey: ["workspaces"],
      });

      removeWorkspaceFromWorkspacesCache(queryClient, workspaceId);

      return { previousWorkspaces };
    },
    onError: (error: any, _workspaceId, context) => {
      context?.previousWorkspaces?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error(error.message || "Failed to delete workspace", { id: "ws-error" });
    },
    onSuccess: () => {
      toast.success("Workspace removed", { id: "ws-action" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};
