import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PageComment } from "../types/page";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";

// ── Fetch + real-time subscription ────────────────────────────────────────────

export const usePageComments = (pageId: string | null) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !pageId) return;
    socket.emit("join:page", pageId);

    const onCreated = ({ comment }: { comment: PageComment }) => {
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.some((c) => c._id === comment._id) ? old : [comment, ...old],
      );
    };
    const onUpdated = ({ comment }: { comment: PageComment }) => {
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.map((c) => (c._id === comment._id ? comment : c)),
      );
    };
    const onDeleted = ({ commentId }: { commentId: string }) => {
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.filter((c) => c._id !== commentId),
      );
    };
    const onReplyChanged = ({ comment }: { comment: PageComment }) => {
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.map((c) => (c._id === comment._id ? comment : c)),
      );
    };

    socket.on("comment:created", onCreated);
    socket.on("comment:updated", onUpdated);
    socket.on("comment:deleted", onDeleted);
    socket.on("reply:added", onReplyChanged);
    socket.on("reply:removed", onReplyChanged);

    return () => {
      socket.emit("leave:page", pageId);
      socket.off("comment:created", onCreated);
      socket.off("comment:updated", onUpdated);
      socket.off("comment:deleted", onDeleted);
      socket.off("reply:added", onReplyChanged);
      socket.off("reply:removed", onReplyChanged);
    };
  }, [socket, pageId, queryClient]);

  return useQuery({
    queryKey: ["page-comments", pageId],
    queryFn: async () => {
      const data = await apiGet<{ comments: PageComment[] }>(`/api/pages/${pageId}/comments`);
      return data.comments;
    },
    enabled: !!pageId,
  });
};

// ── Create ─────────────────────────────────────────────────────────────────────

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, content, line, lineEnd }: {
      pageId: string; content: string; line?: number | null; lineEnd?: number | null;
    }) => {
      const data = await apiPost<{ comment: PageComment }>(
        `/api/pages/${pageId}/comments`,
        { content, line: line ?? null, lineEnd: lineEnd ?? null },
      );
      return data.comment;
    },
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ["page-comments", pageId] });
    },
  });
};

// ── Update (status / content) ─────────────────────────────────────────────────

export const useUpdateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, commentId, status, content }: {
      pageId: string; commentId: string; status?: "open" | "resolved"; content?: string;
    }) => {
      const data = await apiPut<{ comment: PageComment }>(
        `/api/pages/${pageId}/comments/${commentId}`,
        { status, content },
      );
      return data.comment;
    },
    onMutate: async ({ pageId, commentId, status, content }) => {
      await queryClient.cancelQueries({ queryKey: ["page-comments", pageId] });
      const snapshot = queryClient.getQueryData<PageComment[]>(["page-comments", pageId]);
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.map((c) =>
          c._id === commentId
            ? { ...c, ...(status !== undefined && { status }), ...(content !== undefined && { content }) }
            : c,
        ),
      );
      return { snapshot };
    },
    onError: (_err, { pageId }, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(["page-comments", pageId], ctx.snapshot);
    },
    onSettled: (_, _err, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ["page-comments", pageId] });
    },
  });
};

// ── Delete ─────────────────────────────────────────────────────────────────────

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, commentId }: { pageId: string; commentId: string }) =>
      apiDelete(`/api/pages/${pageId}/comments/${commentId}`),
    onMutate: async ({ pageId, commentId }) => {
      await queryClient.cancelQueries({ queryKey: ["page-comments", pageId] });
      const snapshot = queryClient.getQueryData<PageComment[]>(["page-comments", pageId]);
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.filter((c) => c._id !== commentId),
      );
      return { snapshot };
    },
    onError: (_err, { pageId }, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(["page-comments", pageId], ctx.snapshot);
    },
    onSettled: (_, _err, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ["page-comments", pageId] });
    },
  });
};

// ── Add reply ─────────────────────────────────────────────────────────────────

export const useAddReply = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, commentId, content }: {
      pageId: string; commentId: string; content: string;
    }) => {
      const data = await apiPost<{ comment: PageComment }>(
        `/api/pages/${pageId}/comments/${commentId}/replies`,
        { content },
      );
      return data.comment;
    },
    onSuccess: (updatedComment, { pageId }) => {
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.map((c) => (c._id === updatedComment._id ? updatedComment : c)),
      );
    },
    onSettled: (_, _err, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ["page-comments", pageId] });
    },
  });
};

// ── Delete reply ──────────────────────────────────────────────────────────────

export const useDeleteReply = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, commentId, replyId }: {
      pageId: string; commentId: string; replyId: string;
    }) => {
      const data = await apiPost<{ comment: PageComment }>(
        `/api/pages/${pageId}/comments/${commentId}/replies/${replyId}`,
      );
      return data.comment;
    },
    onMutate: async ({ pageId, commentId, replyId }) => {
      await queryClient.cancelQueries({ queryKey: ["page-comments", pageId] });
      const snapshot = queryClient.getQueryData<PageComment[]>(["page-comments", pageId]);
      queryClient.setQueryData<PageComment[]>(["page-comments", pageId], (old = []) =>
        old.map((c) =>
          c._id === commentId
            ? { ...c, replies: c.replies.filter((r) => r._id !== replyId) }
            : c,
        ),
      );
      return { snapshot };
    },
    onError: (_err, { pageId }, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(["page-comments", pageId], ctx.snapshot);
    },
    onSettled: (_, _err, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ["page-comments", pageId] });
    },
  });
};
