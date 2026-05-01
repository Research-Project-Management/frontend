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
      await queryClient.cancelQueries({ queryKey: ["stickies", workspaceId] });
      const previousNotes = queryClient.getQueryData<Sticky[]>(["stickies", workspaceId]);

      queryClient.setQueriesData<Sticky[]>(
        { queryKey: ["stickies", workspaceId] },
        (old) => {
          if (!old) return old;
          return old.map((n) => {
            if (n._id !== stickyId) return n;
            const updatedNote = { ...n, ...updates };

            if (updates.labels) {
              const pId = getStickyProjectId(n);
              const allLabels = queryClient.getQueryData<any[]>(["labels", workspaceId, "sticky", pId]) || [];
              updatedNote.labels = (updates.labels as any).map((labelId: string) => 
                allLabels.find((l: any) => l._id === labelId) || n.labels?.find((l: any) => l._id === labelId) || { _id: labelId, name: "...", color: "#aaa" }
              );
            }
            return updatedNote as Sticky;
          });
        }
      );

      return { previousNotes };
    },
    onError: (err, _vars, context) => {
      if (context?.previousNotes) {
        queryClient.setQueriesData({ queryKey: ["stickies", workspaceId] }, context.previousNotes);
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stickies", workspaceId] });
    },
  });
};

export const useReorderProjectStickies = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, stickyIds }: { projectId: string; stickyIds: string[] }) =>
      apiPut(`/api/project/${projectId}/stickies/reorder`, { stickyIds }),
    onMutate: async ({ projectId, stickyIds }) => {
      const queryKey = projectStickiesKey(projectId);
      await queryClient.cancelQueries({ queryKey });
      const previousStickies = queryClient.getQueriesData<Sticky[]>({ queryKey });
      queryClient.setQueriesData<Sticky[]>({ queryKey }, (old) => {
        if (!old) return old;
        const map = new Map(old.map((sticky) => [sticky._id, sticky]));
        const reordered = stickyIds.map((id) => map.get(id)).filter(Boolean) as Sticky[];
        return reordered.length === old.length ? reordered : old;
      });
      return { previousStickies };
    },
    onError: (err: any, _vars, context) => {
      context?.previousStickies?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(err.message || "Failed to save sticky order", { id: "sticky-error" });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: projectStickiesKey(variables.projectId) });
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
