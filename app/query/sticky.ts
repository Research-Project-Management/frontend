import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "../components/workspace/projects/stickies/types/note.type";

const API_URL = import.meta.env.VITE_API_URL;

// Fetch Stickies
export const fetchStickies = async (workspaceId: string, tags?: string[]) => {
    let url = `${API_URL}/api/workspace/${workspaceId}/stickies`;

    if (tags && tags.length > 0) {
        const queryParams = new URLSearchParams();
        queryParams.append("tags", tags.join(","));
        url += `?${queryParams.toString()}`;
    }

    const response = await fetch(url, {
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch stickies");
    }

    const data = await response.json();
    return data.stickies as Note[];
};

export const useStickies = (workspaceId: string, tags?: string[]) => {
    return useQuery({
        queryKey: ["stickies", workspaceId, tags],
        queryFn: () => fetchStickies(workspaceId, tags),
        enabled: !!workspaceId,
    });
};

// Create Sticky
export const createSticky = async ({
    workspaceId,
    title,
    content,
    color,
    position,
    tags
}: {
    workspaceId: string;
    title?: string;
    content: string;
    color?: string;
    position?: { x: number; y: number };
    tags?: string[];
}) => {
    const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/stickies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, content, color, position, tags }),
    });

    if (!response.ok) {
        throw new Error("Failed to create sticky");
    }

    return response.json();
};

export const useCreateSticky = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createSticky,
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["stickies", variables.workspaceId] });
        },
    });
};

// Update Sticky
export const updateSticky = async ({
    stickyId,
    updates
}: {
    stickyId: string;
    updates: Partial<Note>;
}) => {
    const response = await fetch(`${API_URL}/api/stickies/${stickyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        throw new Error("Failed to update sticky");
    }

    return response.json();
};

export const useUpdateSticky = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: updateSticky,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["stickies"] });
        },
    });
};

// Delete Sticky
export const deleteSticky = async (stickyId: string) => {
    const response = await fetch(`${API_URL}/api/stickies/${stickyId}`, {
        method: "DELETE",
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to delete sticky");
    }

    return true;
};

export const useDeleteSticky = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteSticky,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stickies"] });
        },
    });
};
