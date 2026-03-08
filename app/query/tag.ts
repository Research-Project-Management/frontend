import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tag } from "../components/workspace/projects/stickies/types/note.type";
import { API_URL } from "~/lib/api";

// Fetch Stickies
export const fetchTags = async (workspaceId: string) => {
    const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/tags`, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch tags");
    }

    const data = await response.json();
    return data.tags as Tag[];
};

export const useTags = (workspaceId: string) => {
    return useQuery({
        queryKey: ["tags", workspaceId],
        queryFn: () => fetchTags(workspaceId),
        enabled: !!workspaceId,
    });
};

// Create Tag
export const createTag = async ({
    workspaceId,
    name,
    color,
}: {
    workspaceId: string;
    name: string;
    color?: string;
}) => {
    const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, color }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tag");
    }

    return response.json();
};

export const useCreateTag = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createTag,
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["tags", variables.workspaceId] });
        },
    });
};

// Update Tag
export const updateTag = async ({
    tagId,
    name,
    color,
}: {
    tagId: string;
    name?: string;
    color?: string;
}) => {
    const response = await fetch(`${API_URL}/api/tags/${tagId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, color }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tag");
    }

    return response.json();
};

export const useUpdateTag = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateTag,
        onSuccess: () => {
            // Ideally we invalidate by projectId, but tagId doesn't give us that directly here easily without returning it.
            // We can invalidate all tags or just rely on refetch if we are on the page.
            queryClient.invalidateQueries({ queryKey: ["tags"] });
            queryClient.invalidateQueries({ queryKey: ["stickies"] }); // Re-fetch stickies to update colors/names
        },
    });
};

// Delete Tag
export const deleteTag = async (tagId: string) => {
    const response = await fetch(`${API_URL}/api/tags/${tagId}`, {
        method: "DELETE",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to delete tag");
    }

    return true;
};

export const useDeleteTag = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteTag,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["tags"] });
            queryClient.invalidateQueries({ queryKey: ["stickies"] });
        },
    });
};
