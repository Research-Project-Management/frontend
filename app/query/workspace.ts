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

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchAllWorkspaces = (signal?: AbortSignal) =>
  apiGet(`/api/workspace`, { signal });

// NOTE: workspaceId param có thể là workspace._id (ObjectId) HOẶC workspace.url (string)
// FE đang dùng workspace.url trong URL routing
export const fetchWorkspaceById = (
  workspaceIdOrUrl: string,
  signal?: AbortSignal,
) => apiGet(`/api/workspace/${workspaceIdOrUrl}`, { signal });

export const fetchProjectsByWorkspaceId = (
  workspaceIdOrUrl: string,
  signal?: AbortSignal,
) => apiGet(`/api/workspace/${workspaceIdOrUrl}/projects`, { signal });

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

export type DeleteWorkspaceResult = {
  alreadyDeleted: boolean;
  workspaceId: string;
};

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
      if (current?.workspace?._id === workspacePatch._id) {
        return {
          ...current,
          workspace: mergeWorkspace(current.workspace, workspacePatch),
        };
      }

      if ((current as any)?._id === workspacePatch._id) {
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

// workspaceUrl: Truyền vào workspace.url (NOT _id) từ URL params
export const useWorkspace = (workspaceUrl: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace", workspaceUrl],
    queryFn: ({ signal }) => fetchWorkspaceById(workspaceUrl, signal),
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
    onError: (_error, _variables, context) => {
      context?.previousWorkspaceQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      context?.previousWorkspacesQueries?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSuccess: (data) => {
      if (data?.workspace) {
        syncWorkspaceIntoCaches(queryClient, data.workspace);
      }
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
    onError: (_error, _workspaceId, context) => {
      context?.previousWorkspaces?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};
