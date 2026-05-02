import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { toast } from "sonner";
import { useParams } from "react-router";
import type { Sticky, StickyChildLink } from "~/types/sticky";
import { useCreateLabel, useLabelsQuery } from "./label";

const stickiesKey = (workspaceId: string, labels?: string[], projectId?: string, category?: string) => 
  ["stickies", workspaceId, { labels, projectId, category }];

const projectStickiesKey = (projectId: string | undefined, labels?: string[]) =>
  labels ? ["project-stickies", projectId, labels] : ["project-stickies", projectId];

const getStickyProjectId = (sticky: Sticky) => {
  const projectId = sticky.projectId;
  return typeof projectId === "string" ? projectId : projectId?._id;
};

const invalidateAllStickies = (queryClient: any, workspaceId: string | undefined, projectId?: string) => {
  queryClient.invalidateQueries({ queryKey: ["stickies", workspaceId] });
};

// ── Fetchers ──────────────────────────────────────────────────────────────────

export const fetchStickies = async (workspaceId: string, labels?: string[], projectId?: string, category?: string) => {
  const params = new URLSearchParams();
  if (labels?.length) labels.forEach((labelId) => params.append("labels", labelId));
  if (projectId) params.append("projectId", projectId);
  if (category) params.append("category", category);

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ stickies: Sticky[] }>(`/api/workspace/${workspaceId}/stickies${queryStr}`);
  return data.stickies;
};

export const fetchProjectStickies = async (projectId: string, labels?: string[]) => {
  const params = new URLSearchParams();
  if (labels?.length) params.set("labels", labels.join(","));

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ stickies: Sticky[] }>(`/api/project/${projectId}/stickies${queryStr}`);
  return data.stickies;
};

export const fetchStickyChildren = async (stickyId: string) => {
  const data = await apiGet<{ children: StickyChildLink[] }>(`/api/stickies/${stickyId}/children`);
  return data.children;
};

// ── Query Hooks ───────────────────────────────────────────────────────────────

export const useStickies = (workspaceId: string, labels?: string[], projectId?: string, category?: string) => {
  const queryKey = stickiesKey(workspaceId, labels, projectId, category);

  return useQuery({
    queryKey,
    queryFn: () => fetchStickies(workspaceId, labels, projectId, category),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
};

export const useProjectStickies = (projectId: string, workspaceId: string, labels?: string[]) => {
  return useQuery({
    queryKey: projectStickiesKey(projectId, labels),
    queryFn: () => fetchProjectStickies(projectId, labels),
    enabled: !!projectId && !!workspaceId && /^[0-9a-fA-F]{24}$/.test(projectId),
    staleTime: 60_000,
  });
};

export const useStickyChildren = (stickyId?: string) => {
  return useQuery({
    queryKey: ["sticky-children", stickyId],
    queryFn: () => fetchStickyChildren(stickyId || ""),
    enabled: !!stickyId,
  });
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateSticky = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      workspaceId: string;
      projectId?: string;
      parentStickyId?: string;
      title?: string;
      content: string;
      color?: string;
      position?: { x: number; y: number };
      labels?: string[];
    }) => apiPost<{ sticky: Sticky }>(`/api/workspace/${variables.workspaceId}/stickies`, variables),
    onSuccess: (data, variables) => {
      invalidateAllStickies(queryClient, variables.workspaceId, variables.projectId);
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: projectStickiesKey(variables.projectId) });
      }
      toast.success(variables.projectId ? "Project sticky added" : "Sticky added", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save", { id: "sticky-error" });
    },
  });
};

export const useUpdateSticky = () => {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams();
  
  return useMutation({
    mutationFn: ({ stickyId, updates }: { stickyId: string; updates: Partial<Sticky> }) =>
      apiPut<{ sticky: Sticky }>(`/api/stickies/${stickyId}`, updates),
    
    onMutate: async ({ stickyId, updates }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["stickies"] });
      await queryClient.cancelQueries({ queryKey: ["project-stickies"] });

      // Snapshot the previous value
      const previousWorkspaceStickies = queryClient.getQueriesData({ queryKey: ["stickies"] });
      const previousProjectStickies = queryClient.getQueriesData({ queryKey: ["project-stickies"] });

      const updateStickyList = (old: Sticky[] | undefined) => {
        if (!old) return old;
        return old.map((n) => {
          if (n._id !== stickyId) return n;
          const updatedNote = { ...n, ...updates };

          // Optimistically update labels if they are being changed
          if (updates.labels) {
            // Scan ALL label queries in the cache to find the metadata for these label IDs
            const allLabelQueries = queryClient.getQueriesData<any[]>({ queryKey: ["labels"] });
            const labelMap = new Map();
            
            allLabelQueries.forEach(([_, labels]) => {
              if (Array.isArray(labels)) {
                labels.forEach(l => {
                  if (l && l._id) labelMap.set(l._id, l);
                });
              }
            });
            
            updatedNote.labels = (updates.labels as any).map((labelId: string) => 
              labelMap.get(labelId) || 
              n.labels?.find((l: any) => l._id === labelId) || 
              { _id: labelId, name: "...", color: "#aaa" }
            );
          }
          return updatedNote as Sticky;
        });
      };

      // Optimistically update all matching queries
      queryClient.setQueriesData<Sticky[]>({ queryKey: ["stickies"] }, updateStickyList);
      queryClient.setQueriesData<Sticky[]>({ queryKey: ["project-stickies"] }, updateStickyList);

      return { previousWorkspaceStickies, previousProjectStickies };
    },
    onError: (err, _vars, context) => {
      // Rollback to previous state on error
      if (context?.previousWorkspaceStickies) {
        context.previousWorkspaceStickies.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      if (context?.previousProjectStickies) {
        context.previousProjectStickies.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.error(err.message || "Failed to update sticky note", { id: "sticky-error" });
    },
    onSettled: (data) => {
      const pId = data?.sticky ? getStickyProjectId(data.sticky) : undefined;
      invalidateAllStickies(queryClient, workspaceId, pId);
      if (pId) {
        queryClient.invalidateQueries({ queryKey: projectStickiesKey(pId) });
      }
    },
  });
};

export const useDeleteSticky = () => {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams();
  return useMutation({
    mutationFn: (stickyId: string) => apiDelete(`/api/stickies/${stickyId}`),
    onMutate: async (stickyId) => {
      const queryKey = ["stickies", workspaceId];
      await queryClient.cancelQueries({ queryKey });
      const previousNotes = queryClient.getQueriesData<Sticky[]>({ queryKey });
      
      queryClient.setQueriesData<Sticky[]>({ queryKey }, (old) => 
        old?.filter((n) => n._id !== stickyId) || []
      );
      
      return { previousNotes };
    },
    onSuccess: () => {
      toast.success("Note removed", { id: "sticky-action" });
    },
    onError: (error: any, _vars, context) => {
      if (context?.previousNotes) {
        context.previousNotes.forEach(([key, data]) => queryClient.setQueryData(key, data));
      }
      toast.error(error.message || "Failed to delete sticky note", { id: "sticky-error" });
    },
    onSettled: () => {
      invalidateAllStickies(queryClient, workspaceId);
      queryClient.invalidateQueries({ queryKey: ["project-stickies"] });
    },
  });
};

export const useReorderStickies = () => {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams();
  
  return useMutation({
    mutationFn: (stickyIds: string[]) =>
      apiPut(`/api/workspace/${workspaceId}/stickies/reorder`, { stickyIds }),
    onMutate: async (stickyIds) => {
      const queryKey = ["stickies", workspaceId];
      await queryClient.cancelQueries({ queryKey });
      const previousNotes = queryClient.getQueriesData<Sticky[]>({ queryKey: ["stickies"] });

      const reorderFn = (old: Sticky[] | undefined) => {
        if (!old) return old;
        const map = new Map(old.map((n) => [n._id, n]));
        return stickyIds.map((id) => map.get(id)).filter(Boolean) as Sticky[];
      };

      queryClient.setQueriesData<Sticky[]>({ queryKey: ["stickies"] }, reorderFn);
      
      return { previousNotes };
    },
    onError: (err: any, _vars, context) => {
      context?.previousNotes?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(err.message || "Failed to save order", { id: "sticky-error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
    },
  });
};

export const useReorderProjectStickies = () => {
  const queryClient = useQueryClient();
  const { workspaceId } = useParams();
  
  return useMutation({
    mutationFn: ({ projectId, stickyIds }: { projectId: string; stickyIds: string[] }) =>
      apiPut(`/api/project/${projectId}/stickies/reorder`, { stickyIds }),
    onMutate: async ({ projectId, stickyIds }) => {
      await queryClient.cancelQueries({ queryKey: ["project-stickies", projectId] });
      const previousNotes = queryClient.getQueriesData<Sticky[]>({ queryKey: ["project-stickies"] });

      const reorderFn = (old: Sticky[] | undefined) => {
        if (!old) return old;
        const map = new Map(old.map((n) => [n._id, n]));
        return stickyIds.map((id) => map.get(id)).filter(Boolean) as Sticky[];
      };

      queryClient.setQueriesData<Sticky[]>({ queryKey: ["project-stickies"] }, reorderFn);
      
      return { previousNotes };
    },
    onError: (err: any, _vars, context) => {
      context?.previousNotes?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(err.message || "Failed to save order", { id: "sticky-error" });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-stickies", variables.projectId] });
    },
  });
};

export const useLinkStickyChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stickyId, childStickyId }: { stickyId: string; childStickyId: string }) =>
      apiPost<{ link: StickyChildLink }>(`/api/stickies/${stickyId}/children`, { childStickyId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sticky-children", variables.stickyId] });
      toast.success("Sticky linked", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link sticky", { id: "sticky-error" });
    },
  });
};

export const useUnlinkStickyChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stickyId, childStickyId }: { stickyId: string; childStickyId: string }) =>
      apiDelete(`/api/stickies/${stickyId}/children/${childStickyId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sticky-children", variables.stickyId] });
      toast.success("Sticky unlinked", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to unlink sticky", { id: "sticky-error" });
    },
  });
};
