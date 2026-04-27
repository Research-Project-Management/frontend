import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Note } from "../components/workspace/projects/stickies/types/note.type";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";
import { useUser } from "~/hooks/useUser";
import { toast } from "sonner";

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

// ── Query with real-time ──────────────────────────────────────────────────────

export const useStickies = (workspaceId: string, tags?: string[], projectId?: string, category?: string) => {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const { user } = useUser();

  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const categoryRef = useRef(category);
  categoryRef.current = category;
  const userIdRef = useRef(user?._id);
  userIdRef.current = user?._id;

  useEffect(() => {
    if (!socket || !workspaceId) return;
    socket.emit("join:workspace", workspaceId);

    const onCreated = ({ sticky }: { sticky: Note }) => {
      // Logic: Nếu là note và không phải của mình -> bỏ qua
      if (sticky.category === 'note' && sticky.author?._id !== userIdRef.current) return;

      // Nếu filter category là 'note' mà sticky này là 'sticky' -> bỏ qua
      if (categoryRef.current && sticky.category !== categoryRef.current) return;
      if (projectIdRef.current && sticky.projectId !== projectIdRef.current) return;

      queryClient.invalidateQueries({ queryKey: ["stickies", workspaceId] });
    };

    const onUpdated = ({ sticky }: { sticky: Note }) => {
      // Nếu là note và không phải của mình -> bỏ qua
      if (sticky.category === 'note' && sticky.author?._id !== userIdRef.current) return;

      queryClient.setQueriesData<Note[]>(
        { queryKey: ["stickies", workspaceId] },
        (old = []) => old.map((s) => (s._id === sticky._id ? sticky : s)),
      );
    };

    const onDeleted = ({ stickyId }: { stickyId: string }) => {
      // Xóa thì khó check author trừ khi Backend gửi kèm. 
      // Nhưng invalidate là an toàn nhất.
      queryClient.invalidateQueries({ queryKey: ["stickies", workspaceId] });
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
    queryKey: ["stickies", workspaceId, tags, projectId, category],
    queryFn: () => fetchStickies(workspaceId, tags, projectId, category),
    enabled: !!workspaceId,
  });
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateSticky = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId, title, content, color, position, tags, projectId, category
    }: {
      workspaceId: string;
      title?: string;
      content: string;
      color?: string;
      position?: { x: number; y: number };
      tags?: string[];
      projectId?: string;
      category?: 'sticky' | 'note';
    }) => apiPost(`/api/workspace/${workspaceId}/stickies`, { title, content, color, position, tags, projectId, category }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stickies", variables.workspaceId] });
      toast.success(variables.category === 'note' ? "Note added" : "Sticky added", { id: "sticky-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save", { id: "sticky-error" });
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
