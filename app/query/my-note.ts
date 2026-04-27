import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "../components/workspace/projects/stickies/types/note.type";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";
import { useUser } from "~/hooks/useUser";
import { toast } from "sonner";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchMyNotes = async (projectId: string, tags?: string[]) => {
  const params = tags?.length ? `?tags=${tags.join(",")}` : "";
  const data = await apiGet<{ notes: Note[] }>(`/api/project/${projectId}/notes${params}`);
  return data.notes;
};

// ── Query with real-time ──────────────────────────────────────────────────────

export const useMyNotes = (projectId: string, tags?: string[]) => {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { user } = useUser();

  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const userIdRef = useRef(user?._id);
  userIdRef.current = user?._id;

  useEffect(() => {
    if (!socket || !projectId) return;
    socket.emit("join:project", projectId);

    const onCreated = ({ note }: { note: Note }) => {
      // Chỉ xử lý nếu là ghi chú của mình
      if (note.author?._id !== userIdRef.current) return;
      
      queryClient.invalidateQueries({ queryKey: ["my-notes", projectId] });
    };

    const onUpdated = ({ note }: { note: Note }) => {
      if (note.author?._id !== userIdRef.current) return;

      queryClient.setQueriesData<Note[]>(
        { queryKey: ["my-notes", projectId] },
        (old = []) => old.map((n) => (n._id === note._id ? note : n)),
      );
    };

    const onDeleted = ({ noteId }: { noteId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["my-notes", projectId] });
    };

    socket.on("note:created", onCreated);
    socket.on("note:updated", onUpdated);
    socket.on("note:deleted", onDeleted);

    return () => {
      socket.emit("leave:project", projectId);
      socket.off("note:created", onCreated);
      socket.off("note:updated", onUpdated);
      socket.off("note:deleted", onDeleted);
    };
  }, [socket, projectId, queryClient]);

  return useQuery({
    queryKey: ["my-notes", projectId, tags],
    queryFn: () => fetchMyNotes(projectId, tags),
    enabled: !!projectId,
  });
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateMyNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId, title, content, color, tags,
    }: {
      projectId: string;
      title?: string;
      content: string;
      color?: string;
      tags?: string[];
    }) => apiPost(`/api/project/${projectId}/notes`, { title, content, color, tags, category: 'note' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-notes", variables.projectId] });
      toast.success("Note created", { id: "note-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create note", { id: "note-error" });
    },
  });
};

export const useUpdateMyNote = () => {
  return useMutation({
    mutationFn: ({ noteId, updates }: { noteId: string; updates: Partial<Note> }) =>
      apiPut(`/api/notes/${noteId}`, updates),
    onError: (error: any) => {
      toast.error(error.message || "Failed to update note", { id: "note-error" });
    },
  });
};

export const useDeleteMyNote = () => {
  return useMutation({
    mutationFn: (noteId: string) => apiDelete(`/api/notes/${noteId}`),
    onSuccess: () => {
      toast.success("Note removed", { id: "note-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete note", { id: "note-error" });
    },
  });
};
