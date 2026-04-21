import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "../components/workspace/projects/stickies/types/note.type";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";
import { toast } from "sonner";

// ── Fetch ─────────────────────────────────────────────────────────────────────

export const fetchStickies = async (workspaceId: string, tags?: string[]) => {
  const params = tags?.length ? `?tags=${tags.join(",")}` : "";
  const data = await apiGet<{ stickies: Note[] }>(`/api/workspace/${workspaceId}/stickies${params}`);
  return data.stickies;
};

// ── Query with real-time ──────────────────────────────────────────────────────

export const useStickies = (workspaceId: string, tags?: string[]) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  // Keep a stable ref to the tags array so socket handlers always see the latest value
  // without needing tags in the useEffect dependency array (which would re-subscribe on every change).
  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  useEffect(() => {
    if (!socket || !workspaceId) return;
    socket.emit("join:workspace", workspaceId);

    const onCreated = ({ sticky }: { sticky: Note }) => {
      const qKey = ["stickies", workspaceId, tagsRef.current];
      queryClient.setQueryData<Note[]>(qKey, (old = []) =>
        old.some((s) => s._id === sticky._id) ? old : [sticky, ...old],
      );
    };
    const onUpdated = ({ sticky }: { sticky: Note }) => {
      // Update ALL matching stickies queries for this workspace (regardless of tag filter)
      queryClient.setQueriesData<Note[]>(
        { queryKey: ["stickies", workspaceId] },
        (old = []) => old.map((s) => (s._id === sticky._id ? sticky : s)),
      );
    };
    const onDeleted = ({ stickyId }: { stickyId: string }) => {
      queryClient.setQueriesData<Note[]>(
        { queryKey: ["stickies", workspaceId] },
        (old = []) => old.filter((s) => s._id !== stickyId),
      );
    };

    socket.on("sticky:created", onCreated);
    socket.on("sticky:updated", onUpdated);
    socket.on("sticky:deleted", onDeleted);

    return () => {
      socket.emit("leave:workspace", workspaceId);
      socket.off("sticky:created", onCreated);
      socket.off("sticky:updated", onUpdated);
      socket.off("sticky:deleted", onDeleted);
    };
  }, [socket, workspaceId, queryClient]);

  return useQuery({
    queryKey: ["stickies", workspaceId, tags],
    queryFn: () => fetchStickies(workspaceId, tags),
    enabled: !!workspaceId,
  });
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateSticky = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId, title, content, color, position, tags,
    }: {
      workspaceId: string;
      title?: string;
      content: string;
      color?: string;
      position?: { x: number; y: number };
      tags?: string[];
    }) => apiPost(`/api/workspace/${workspaceId}/stickies`, { title, content, color, position, tags }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stickies", variables.workspaceId] });
      toast.success("Note added", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create sticky note", { id: "sticky-error" });
    },
  });
};

export const useUpdateSticky = () => {
  return useMutation({
    mutationFn: ({ stickyId, updates }: { stickyId: string; updates: Partial<Note> }) =>
      apiPut(`/api/stickies/${stickyId}`, updates),
    // No invalidateQueries here — the socket "sticky:updated" event already
    // updates the cache via setQueriesData. Calling invalidateQueries would
    // trigger a redundant network refetch and a second full re-render,
    // which is the main source of the 200-400ms "message handler" violations.
    onError: (error: any) => {
      toast.error(error.message || "Failed to update sticky note", { id: "sticky-error" });
    },
  });
};

export const useDeleteSticky = () => {
  return useMutation({
    mutationFn: (stickyId: string) => apiDelete(`/api/stickies/${stickyId}`),
    // Socket "sticky:deleted" handles the cache update.
    onSuccess: () => {
      toast.success("Note removed", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete sticky note", { id: "sticky-error" });
    },
  });
};
