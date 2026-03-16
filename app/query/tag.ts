import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tag } from "../components/workspace/projects/stickies/types/note.type";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchTags = async (workspaceId: string) => {
  const data = await apiGet<{ tags: Tag[] }>(`/api/workspace/${workspaceId}/tags`);
  return data.tags;
};

// ── Query ─────────────────────────────────────────────────────────────────────

export const useTags = (workspaceId: string) =>
  useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => fetchTags(workspaceId),
    enabled: !!workspaceId,
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, name, color }: { workspaceId: string; name: string; color?: string }) =>
      apiPost(`/api/workspace/${workspaceId}/tags`, { name, color }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tags", variables.workspaceId] });
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, name, color }: { tagId: string; name?: string; color?: string }) =>
      apiPut(`/api/tags/${tagId}`, { name, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
    },
  });
};

export const useDeleteTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => apiDelete(`/api/tags/${tagId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
    },
  });
};
