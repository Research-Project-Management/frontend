import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note, Tag } from "../components/workspace/projects/stickies/types/note.type";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useParams } from "react-router";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StickyChildLink {
  _id: string;
  workspace: string;
  parentSticky: string;
  project: {
    _id: string;
    name: string;
    avatar?: string;
  };
  note: Note;
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const stickiesKey = (workspaceId: string | undefined, tags?: string[], projectId?: string, category?: string) => 
  ["stickies", workspaceId, tags, projectId, category] as const;

const getStickyProjectId = (note: Note): string => {
  const project = (note as any).projectId;
  if (!project) return "";
  if (typeof project === "string") return project;
  return String(project._id || project);
};

const invalidateAllStickies = (queryClient: any, workspaceId?: string, projectId?: string) => {
  queryClient.invalidateQueries({ queryKey: ["stickies", workspaceId] });
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ["my-notes", projectId] });
  }
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchStickies = async (workspaceId: string, tags?: string[], projectId?: string, category?: string) => {
  const params = new URLSearchParams();
  if (tags?.length) params.append("tags", tags.join(","));
  if (projectId) params.append("projectId", projectId);
  if (category) params.append("category", category);

  const queryStr = params.toString() ? `?${params.toString()}` : "";
  const data = await apiGet<{ stickies: Note[] }>(`/api/workspace/${workspaceId}/stickies${queryStr}`);
  return data.stickies;
};

export const fetchStickyChildren = async (stickyId: string) => {
  const data = await apiGet<{ children: StickyChildLink[] }>(`/api/stickies/${stickyId}/children`);
  return data.children;
};

export const fetchTags = async (workspaceId: string) => {
  const data = await apiGet<{ tags: Tag[] }>(`/api/workspace/${workspaceId}/tags`);
  return data.tags;
};

// ── Query Hooks ───────────────────────────────────────────────────────────────

export const useStickies = (workspaceId: string, tags?: string[], projectId?: string, category?: string) => {
  const queryKey = stickiesKey(workspaceId, tags, projectId, category);

  return useQuery({
    queryKey,
    queryFn: () => fetchStickies(workspaceId, tags, projectId, category),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
};

export const useStickyChildren = (stickyId?: string) => {
  return useQuery({
    queryKey: ["sticky-children", stickyId],
    queryFn: () => fetchStickyChildren(stickyId || ""),
    enabled: !!stickyId,
  });
};

export const useTags = (workspaceId: string) =>
  useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => fetchTags(workspaceId),
    enabled: !!workspaceId,
  });

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateSticky = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      workspaceId: string;
      title?: string;
      content: string;
      color?: string;
      position?: { x: number; y: number };
      tags?: string[];
      projectId?: string;
      category?: 'sticky' | 'note';
    }) => apiPost<{ sticky: Note }>(`/api/workspace/${variables.workspaceId}/stickies`, variables),
    onSuccess: (data, variables) => {
      invalidateAllStickies(queryClient, variables.workspaceId, variables.projectId);
      toast.success(variables.category === 'note' ? "Note added" : "Sticky added", { id: "sticky-action" });
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
    mutationFn: ({ stickyId, updates }: { stickyId: string; updates: Partial<Note> }) =>
      apiPut<{ sticky: Note }>(`/api/stickies/${stickyId}`, updates),
    
    onMutate: async ({ stickyId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ["stickies", workspaceId] });
      const previousNotes = queryClient.getQueryData<Note[]>(["stickies", workspaceId]);

      queryClient.setQueriesData<Note[]>(
        { queryKey: ["stickies", workspaceId] },
        (old) => {
          if (!old) return old;
          return old.map((n) => {
            if (n._id !== stickyId) return n;
            const updatedNote = { ...n, ...updates };

            if (updates.tags) {
              const allTags = queryClient.getQueryData<any[]>(["tags", workspaceId]) || [];
              updatedNote.tags = (updates.tags as any).map((tagId: string) => 
                allTags.find(t => t._id === tagId) || n.tags?.find(t => t._id === tagId) || { _id: tagId, name: "...", color: "#aaa" }
              );
            }
            return updatedNote as Note;
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
      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey });
      
      queryClient.setQueriesData<Note[]>({ queryKey }, (old) => 
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

export const useLinkStickyChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stickyId, childNoteId }: { stickyId: string; childNoteId: string }) =>
      apiPost<{ link: StickyChildLink }>(`/api/stickies/${stickyId}/children`, { childNoteId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sticky-children", variables.stickyId] });
      toast.success("Note linked", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to link note", { id: "sticky-error" });
    },
  });
};

export const useUnlinkStickyChild = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stickyId, noteId }: { stickyId: string; noteId: string }) =>
      apiDelete(`/api/stickies/${stickyId}/children/${noteId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sticky-children", variables.stickyId] });
      toast.success("Note unlinked", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to unlink note", { id: "sticky-error" });
    },
  });
};

export const useCreateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, name, color }: { workspaceId: string; name: string; color?: string }) =>
      apiPost<{ tag: Tag }>(`/api/workspace/${workspaceId}/tags`, { name, color }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tags", variables.workspaceId] });
      toast.success("Tag created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create tag");
    },
  });
};

export const useUpdateTag = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, name, color }: { tagId: string; name?: string; color?: string }) =>
      apiPut<{ tag: Tag }>(`/api/tags/${tagId}`, { name, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
      toast.success("Tag updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update tag");
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
      toast.success("Tag deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete tag");
    },
  });
};
