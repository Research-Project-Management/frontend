import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { toast } from "sonner";
import type { Label } from "~/types/sticky";

// ── Constants ────────────────────────────────────────────────────────────────

export const AVAILABLE_LABEL_COLORS = [
  { name: "green_subtle", color: "#baf3db" }, { name: "yellow_subtle", color: "#f8e6a0" }, { name: "orange_subtle", color: "#fedec8" }, { name: "red_subtle", color: "#ffd5d2" }, { name: "purple_subtle", color: "#dfd8fd" },
  { name: "green", color: "#4bce97" }, { name: "yellow", color: "#f5cd47" }, { name: "orange", color: "#fea362" }, { name: "red", color: "#f87168" }, { name: "purple", color: "#9f8fef" },
  { name: "green_bold", color: "#1f845a" }, { name: "yellow_bold", color: "#946f00" }, { name: "orange_bold", color: "#c25100" }, { name: "red_bold", color: "#c9372c" }, { name: "purple_bold", color: "#6e5dc6" },
  { name: "blue_subtle", color: "#cce0ff" }, { name: "sky_subtle", color: "#c6edfb" }, { name: "lime_subtle", color: "#d3f1a7" }, { name: "pink_subtle", color: "#fdd0ec" }, { name: "grey_subtle", color: "#dcdfe4" },
  { name: "blue", color: "#579dff" }, { name: "sky", color: "#60c6d2" }, { name: "lime", color: "#94c748" }, { name: "pink", color: "#e774bb" }, { name: "grey", color: "#8590a2" },
  { name: "blue_bold", color: "#0c66e4" }, { name: "sky_bold", color: "#1d7f8c" }, { name: "lime_bold", color: "#5b7f24" }, { name: "pink_bold", color: "#ae4787" }, { name: "grey_bold", color: "#44546f" },
];

export const DEFAULT_LABEL_COLOR = "#4bce97";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchLabels = async (workspaceId: string, type?: string, projectId?: string) => {
  const params = new URLSearchParams();
  if (type) params.append("type", type);
  if (projectId) params.append("projectId", projectId);
  
  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ labels?: Label[]; tags?: Label[] }>(`/api/workspace/${workspaceId}/labels${queryStr}`);
  return data.labels ?? data.tags ?? [];
};

// ── Query Hooks ───────────────────────────────────────────────────────────────

export const useLabelsQuery = (workspaceId: string, type?: string, projectId?: string) =>
  useQuery({
    queryKey: ["labels", workspaceId, type, projectId],
    queryFn: () => fetchLabels(workspaceId, type, projectId),
    enabled: !!workspaceId,
    staleTime: 0,
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ 
      workspaceId, 
      name, 
      color, 
      type, 
      projectId 
    }: { 
      workspaceId: string; 
      name: string; 
      color?: string; 
      type?: string;
      projectId?: string;
    }) =>
      apiPost<{ label?: Label; tag?: Label }>(`/api/workspace/${workspaceId}/labels`, { name, color, type, projectId }),
    onMutate: async (newLabel) => {
      await queryClient.cancelQueries({ queryKey: ["labels"] });
      const previousLabels = queryClient.getQueryData(["labels"]);

      queryClient.setQueriesData({ queryKey: ["labels"] }, (old: any) => {
        const optimisticLabel = {
          _id: "temp-id-" + Math.random(),
          ...newLabel,
          createdAt: new Date().toISOString(),
        };
        if (!Array.isArray(old)) return [optimisticLabel];
        return [...old, optimisticLabel];
      });

      return { previousLabels };
    },
    onError: (error: any, __, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(["labels"], context.previousLabels);
      }
      toast.error(error.message || "Failed to create label");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
};

export const useUpdateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ labelId, name, color }: { labelId: string; name?: string; color?: string }) =>
      apiPut<{ label?: Label; tag?: Label }>(`/api/labels/${labelId}`, { name, color }),
    onMutate: async (updatedLabel) => {
      // Cancel refetches
      await queryClient.cancelQueries({ queryKey: ["labels"] });

      // Snapshot
      const previousLabels = queryClient.getQueryData(["labels"]);

      // Optimistically update
      queryClient.setQueriesData({ queryKey: ["labels"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((label: Label) =>
          label._id === updatedLabel.labelId ? { ...label, ...updatedLabel } : label
        );
      });

      return { previousLabels };
    },
    onError: (error: any, __, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(["labels"], context.previousLabels);
      }
      toast.error(error.message || "Failed to update label");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
};

export const useDeleteLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => apiDelete(`/api/labels/${labelId}`),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: ["labels"] });
      const previousLabels = queryClient.getQueryData(["labels"]);

      queryClient.setQueriesData({ queryKey: ["labels"] }, (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.filter((label: Label) => label._id !== labelId);
      });

      return { previousLabels };
    },
    onError: (error: any, __, context) => {
      if (context?.previousLabels) {
        queryClient.setQueryData(["labels"], context.previousLabels);
      }
      toast.error(error.message || "Failed to delete label");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
    },
  });
};
