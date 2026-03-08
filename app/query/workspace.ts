import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL } from "~/lib/api";

export const fetchAllWorkspaces = async () => {
    const response = await fetch(
        API_URL + "/api/workspace",
        {
            credentials: "include",
        }
    );
    if (!response.ok) {
        throw new Error("Failed to fetch workspaces");
    }
    return response.json();
};

// NOTE: workspaceId param có thể là workspace._id (ObjectId) HOẶC workspace.url (string)
// FE đang dùng workspace.url trong URL routing
export const fetchWorkspaceById = async (workspaceIdOrUrl: string) => {
    const response = await fetch(API_URL + `/api/workspace/${workspaceIdOrUrl}`, {
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

export const fetchProjectsByWorkspaceId = async (workspaceIdOrUrl: string) => {
    const response = await fetch(API_URL + `/api/workspace/${workspaceIdOrUrl}/projects`, {
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    return response.json();
}

export const useWorkspaces = () => {
    const { data, isLoading, error } = useQuery({
        queryKey: ["workspaces"],
        queryFn: fetchAllWorkspaces,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnMount: false,
        select: (data) => {
            // Deduplicate workspaces by _id
            const workspaces = data?.workspaces || [];
            const uniqueWorkspaces = Array.from(
                new Map(workspaces.map((w: any) => [w._id, w])).values()
            );
            return { workspaces: uniqueWorkspaces };
        },
    });

    return {
        workspaces: data?.workspaces || [],
        isLoading,
        error,
    };
};

// workspaceUrl: Truyền vào workspace.url (NOT _id) từ URL params
export const useWorkspace = (workspaceUrl: string) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ["workspace", workspaceUrl],
        queryFn: () => fetchWorkspaceById(workspaceUrl),
        enabled: !!workspaceUrl,
    });

    return {
        workspace: data?.workspace,
        yourRole: data?.yourRole,
        isLoading,
        error,
    };
};

// Workspace Member Management Hooks
export const useAddWorkspaceMember = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ workspaceId, userId, role = "member" }: { workspaceId: string; userId: string; role?: string }) => {
            const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/add-member`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId, role }),
            });
            if (!response.ok) throw new Error("Failed to add member");
            return response.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["workspace"] });
        },
    });
};

export const useUpdateWorkspaceMemberRole = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ workspaceId, userId, newRole }: { workspaceId: string; userId: string; newRole: string }) => {
            const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/update-member-role`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId, newRole }),
            });
            if (!response.ok) throw new Error("Failed to update role");
            return response.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["workspace"] });
        },
    });
};

export const useRemoveWorkspaceMember = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ workspaceId, userId }: { workspaceId: string; userId: string }) => {
            const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/remove-member`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ userId }),
            });
            if (!response.ok) throw new Error("Failed to remove member");
            return response.json();
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["workspace"] });
        },
    });
};

//Workspace mutations (used by settings pages)
export const updateWorkspace = async ({
  id,
  data,
}: {
  id: string;
  data: Partial<{
    name: string;
    avatar?: string | null;
    companySize?: string;
    timezone?: string;
    url?: string;
  }>;
}) => {
  const response = await fetch(API_URL + `/api/workspace/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (errText) {
      try {
        const errJson = JSON.parse(errText);
        throw new Error(errJson?.error || errJson?.message || errText);
      } catch {
        throw new Error(errText);
      }
    }
    throw new Error("Failed to update workspace");
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
};

export const deleteWorkspace = async (id: string) => {
  const response = await fetch(API_URL + `/api/workspace/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    const errText = await response.text();
    if (errText) {
      try {
        const errJson = JSON.parse(errText);
        throw new Error(errJson?.error || errJson?.message || errText);
      } catch {
        throw new Error(errText);
      }
    }
    throw new Error("Failed to delete workspace");
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
};
