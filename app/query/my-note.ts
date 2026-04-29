import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import type { Note } from "../components/workspace/projects/stickies/types/note.type";
import { ApiError, apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

const myNotesKey = (projectId: string | undefined, tags?: string[]) => 
  tags ? ["my-notes", projectId, tags] : ["my-notes", projectId];

const getNoteProjectId = (note: Note): string => {
  const project = (note as any).projectId;
  if (!project) return "";
  if (typeof project === "string") return project;
  return String(project._id || project);
};

const invalidateQueries = (queryClient: any, projectId: string, workspaceId?: string) => {
  queryClient.invalidateQueries({ queryKey: ["my-notes", projectId] });
  if (workspaceId) {
    queryClient.invalidateQueries({ queryKey: ["stickies", workspaceId] });
  }
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchMyNotes = async (projectId: string, _workspaceId: string, tags?: string[]) => {
  const params = new URLSearchParams();
  if (tags?.length) params.set("tags", tags.join(","));

  const data = await apiGet<{ notes: Note[] }>(`/api/project/${projectId}/notes?${params.toString()}`);
  return data.notes;
};

export const useMyNotes = (projectId: string, workspaceId: string, tags?: string[]) => {
  return useQuery({
    queryKey: myNotesKey(projectId, tags),
    queryFn: () => fetchMyNotes(projectId, workspaceId, tags),
    enabled: !!projectId && !!workspaceId && /^[0-9a-fA-F]{24}$/.test(projectId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateMyNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId, projectId, parentStickyId, title, content, color, tags,
    }: {
      workspaceId: string;
      projectId: string;
      parentStickyId?: string;
      title?: string;
      content: string;
      color?: string;
      tags?: string[];
    }) => {
      const payload = { title, content, color, tags, parentStickyId, category: "note" };
      try {
        return await apiPost<{ note: Note }>(`/api/project/${projectId}/notes`, payload);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404 || !workspaceId) throw error;
        const data = await apiPost<{ sticky: Note }>(`/api/workspace/${workspaceId}/stickies`, {
          ...payload,
          projectId,
          position: { x: 0, y: 0 },
        });
        return { note: data.sticky };
      }
    },
    onSuccess: (data, variables) => {
      const note = {
        ...data.note,
        category: "note" as const,
        projectId: getNoteProjectId(data.note) || variables.projectId,
      };
      queryClient.setQueriesData<Note[]>(
        { queryKey: myNotesKey(variables.projectId) },
        (old = []) => (old.some((n) => n._id === note._id) ? old : [note, ...old])
      );
      toast.success("Note created", { id: "note-action" });
    },
    onSettled: (_data, _error, variables) => {
      invalidateQueries(queryClient, variables.projectId, variables.workspaceId);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create note", { id: "note-error" });
    },
  });
};

export const useUpdateMyNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, updates }: { noteId: string; updates: Partial<Note>; projectId: string; workspaceId?: string }) => {
      try {
        return await apiPut(`/api/notes/${noteId}`, updates);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        return apiPut(`/api/stickies/${noteId}`, updates);
      }
    },
    onMutate: async ({ noteId, updates, projectId }) => {
      const queryKey = myNotesKey(projectId);
      await queryClient.cancelQueries({ queryKey });
      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey });
      queryClient.setQueriesData<Note[]>({ queryKey }, (old) => 
        old?.map((n) => (n._id === noteId ? { ...n, ...updates } : n)) as Note[]
      );
      return { previousNotes };
    },
    onError: (err: any, _vars, context) => {
      context?.previousNotes?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(err.message || "Failed to update note", { id: "note-error" });
    },
    onSettled: (_data, _error, variables) => {
      invalidateQueries(queryClient, variables.projectId, variables.workspaceId);
    },
  });
};

export const useDeleteMyNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId }: { noteId: string; projectId: string; workspaceId?: string }) => {
      try {
        return await apiDelete(`/api/notes/${noteId}`);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        return apiDelete(`/api/stickies/${noteId}`);
      }
    },
    onMutate: async ({ noteId, projectId }) => {
      const queryKey = myNotesKey(projectId);
      await queryClient.cancelQueries({ queryKey });
      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey });
      queryClient.setQueriesData<Note[]>({ queryKey }, (old) => old?.filter((n) => n._id !== noteId) || []);
      return { previousNotes };
    },
    onSettled: (_data, _error, variables) => {
      invalidateQueries(queryClient, variables.projectId, variables.workspaceId);
    },
    onError: (err: any, _vars, context) => {
      context?.previousNotes?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(err.message || "Failed to delete note", { id: "note-error" });
    },
  });
};

export const useReorderMyNotes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, noteIds }: { projectId: string; noteIds: string[] }) =>
      apiPut(`/api/project/${projectId}/notes/reorder`, { noteIds }),
    onMutate: async ({ projectId, noteIds }) => {
      const queryKey = myNotesKey(projectId);
      await queryClient.cancelQueries({ queryKey });
      const previousNotes = queryClient.getQueriesData<Note[]>({ queryKey });
      queryClient.setQueriesData<Note[]>({ queryKey }, (old) => {
        if (!old) return old;
        const map = new Map(old.map(n => [n._id, n]));
        const reordered = noteIds.map(id => map.get(id)).filter(Boolean) as Note[];
        return reordered.length === old.length ? reordered : old;
      });
      return { previousNotes };
    },
    onError: (err, _vars, context) => {
      context?.previousNotes?.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast.error(err.message || "Failed to save note order", { id: "note-error" });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: myNotesKey(variables.projectId) });
    },
  });
};
