import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "../components/workspace/projects/stickies/types/note.type";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";

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

  useEffect(() => {
    if (!socket || !workspaceId) return;
    socket.emit("join:workspace", workspaceId);

    const qKey = ["stickies", workspaceId, tags];

    const onCreated = ({ sticky }: { sticky: Note }) => {
      queryClient.setQueryData<Note[]>(qKey, (old = []) =>
        old.some((s) => s._id === sticky._id) ? old : [sticky, ...old],
      );
    };
    const onUpdated = ({ sticky }: { sticky: Note }) => {
      queryClient.setQueryData<Note[]>(qKey, (old = []) =>
        old.map((s) => (s._id === sticky._id ? sticky : s)),
      );
    };
    const onDeleted = ({ stickyId }: { stickyId: string }) => {
      queryClient.setQueryData<Note[]>(qKey, (old = []) =>
        old.filter((s) => s._id !== stickyId),
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
  }, [socket, workspaceId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

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
    },
  });
};

export const useUpdateSticky = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stickyId, updates }: { stickyId: string; updates: Partial<Note> }) =>
      apiPut(`/api/stickies/${stickyId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
    },
  });
};

export const useDeleteSticky = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stickyId: string) => apiDelete(`/api/stickies/${stickyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stickies"] });
    },
  });
};
