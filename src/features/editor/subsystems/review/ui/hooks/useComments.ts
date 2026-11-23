'use client';

/**
 * useComments.ts
 *
 * Reactive comment hooks wired to `/api/v1/pages/docs/:docId/comments`.
 */

import { useInfiniteQuery, useMutation, useQuery, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CommentStatus, PageComment } from '@/features/editor/domain/types/comment.types';
import { lruDocumentCache } from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { getActiveYjsProvider } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { getCachedUser } from '@/features/auth/services/auth.service';
import { useSafeQueryClient } from '@/features/editor/core/queries/safe-query-client';
import { encodeYjsAnchor } from '../../extensions/anchor';

function computeLineCharOffsets(
  text: string,
  startLine: number,
  endLine: number,
): { from: number; to: number } {
  const targetStart = Math.max(1, startLine);
  const targetEnd = Math.max(targetStart, endLine);
  let currentLine = 1;
  let from = 0;
  let idx = 0;

  while (currentLine < targetStart && idx <= text.length) {
    const nl = text.indexOf('\n', idx);
    if (nl === -1) {
      from = text.length;
      idx = text.length + 1;
      break;
    }
    idx = nl + 1;
    from = idx;
    currentLine++;
  }

  let endIdx = from;
  while (currentLine < targetEnd && endIdx <= text.length) {
    const nl = text.indexOf('\n', endIdx);
    if (nl === -1) {
      endIdx = text.length;
      break;
    }
    endIdx = nl + 1;
    currentLine++;
  }

  const finalNl = text.indexOf('\n', endIdx);
  const to = finalNl === -1 ? text.length : finalNl;
  return { from, to: Math.max(from, to) };
}

function computeLineAnchors(
  docId: string,
  line?: number | null,
  lineEnd?: number | null,
): { anchorStart?: string; anchorEnd?: string; baseDocRev?: number } {
  const baseDocRev = lruDocumentCache.getModel(docId)?.serverRev;
  const yText = getActiveYjsProvider(docId)?.yText ?? null;
  if (!yText || line == null) {
    return typeof baseDocRev === 'number' ? { baseDocRev } : {};
  }
  const { from, to } = computeLineCharOffsets(yText.toString(), line, lineEnd ?? line);
  const anchorStart = encodeYjsAnchor(yText, from);
  const anchorEnd = encodeYjsAnchor(yText, to);
  return {
    ...(anchorStart ? { anchorStart } : {}),
    ...(anchorEnd ? { anchorEnd } : {}),
    ...(typeof baseDocRev === 'number' ? { baseDocRev } : {}),
  };
}

export const commentKeys = {
  all: ['page-comments'] as const,
  byPage: (docId: string | null, status?: CommentStatus) => ['page-comments', docId, status] as const,
  resolvedInfinite: (docId: string | null, limit = 20) =>
    ['page-comments', docId, 'resolved', 'infinite', limit] as const,
};

const STALE_TIME = 30_000;
const GC_TIME = 5 * 60_000;

export const usePageComments = (
  docId: string | null,
  status?: CommentStatus,
  queryClient?: QueryClient,
) => {
  const effectiveClient = useSafeQueryClient(queryClient);
  return useQuery(
    {
      queryKey: commentKeys.byPage(docId, status),
      queryFn: async (): Promise<PageComment[]> => {
        if (!docId) return [];
        const list = await pagesService.comments.getComments(docId, status);
        return list || [];
      },
      enabled: Boolean(docId),
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
    },
    effectiveClient,
  );
};

export const useInfiniteResolvedComments = (
  docId: string | null,
  enabled: boolean,
  limit = 20,
  queryClient?: QueryClient,
) => {
  const effectiveClient = useSafeQueryClient(queryClient);
  return useInfiniteQuery(
    {
      queryKey: commentKeys.resolvedInfinite(docId, limit),
      initialPageParam: null as string | null,
      queryFn: async ({ pageParam }) => {
        if (!docId) return { comments: [], nextCursor: null, hasMore: false };
        return pagesService.comments.getCommentsPage(docId, {
          status: 'resolved',
          cursor: pageParam,
          limit,
        });
      },
      getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
      enabled: Boolean(docId) && enabled,
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
    },
    effectiveClient,
  );
};

export const useCreateComment = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({
        pageId,
        content,
        line,
        lineEnd,
      }: {
        pageId: string;
        content: string;
        line?: number | null;
        lineEnd?: number | null;
        projectId?: string;
      }) => {
        const anchors = computeLineAnchors(pageId, line, lineEnd);
        return await pagesService.comments.createComment(pageId, {
          content,
          line: line ?? undefined,
          lineEnd: lineEnd ?? undefined,
          ...anchors,
        });
      },
      onMutate: async ({ pageId, content, line, lineEnd }) => {
        await queryClient.cancelQueries({ queryKey: ['page-comments', pageId] });
        const previousData = queryClient.getQueriesData<PageComment[]>({ queryKey: ['page-comments', pageId] });

        const cachedUser = getCachedUser();
        const optimisticComment: PageComment = {
          id: `temp-${Date.now()}`,
          page: pageId,
          projectPageId: pageId,
          author: {
            id: cachedUser?.id || 'current-user',
            name: cachedUser?.name || cachedUser?.email || 'You',
          },
          content,
          line: line ?? null,
          lineEnd: lineEnd ?? null,
          status: 'open',
          replies: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        queryClient.setQueriesData<PageComment[]>(
          { queryKey: ['page-comments', pageId] },
          (old) => (old ? [...old, optimisticComment] : [optimisticComment]),
        );

        return { previousData, pageId };
      },
      onError: (err: Error | unknown, _vars, context) => {
        if (context?.previousData) {
          context.previousData.forEach(([key, val]) => {
            queryClient.setQueryData(key, val);
          });
        }
        toast.error((err as Error)?.message || 'Failed to add comment', { id: 'create-comment' });
      },
      onSettled: (_data, _err, variables) => {
        queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
        if (variables.projectId) {
          queryClient.invalidateQueries({ queryKey: ['project-review-overview', variables.projectId] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        }
      },
      onSuccess: () => {
        toast.success('Comment added', { id: 'create-comment' });
      },
    },
    queryClient,
  );
};

export const useUpdateComment = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({
        pageId,
        commentId,
        content,
        status,
      }: {
        pageId: string;
        commentId: string;
        content?: string;
        status?: CommentStatus;
        projectId?: string;
      }) => {
        return await pagesService.comments.updateComment(pageId, commentId, {
          ...(content !== undefined ? { content } : {}),
          ...(status !== undefined ? { status } : {}),
        });
      },
      onMutate: async ({ pageId, commentId, content, status }) => {
        await queryClient.cancelQueries({ queryKey: ['page-comments', pageId] });
        const previousData = queryClient.getQueriesData<PageComment[]>({ queryKey: ['page-comments', pageId] });

        queryClient.setQueriesData<PageComment[]>(
          { queryKey: ['page-comments', pageId] },
          (old) =>
            old
              ? old.map((c) =>
                  c.id === commentId
                    ? {
                        ...c,
                        content: content !== undefined ? content : c.content,
                        status: status !== undefined ? status : c.status,
                        updatedAt: new Date().toISOString(),
                      }
                    : c,
                )
              : old,
        );

        return { previousData, pageId };
      },
      onError: (err: Error | unknown, vars, context) => {
        if (context?.previousData) {
          context.previousData.forEach(([key, val]) => {
            queryClient.setQueryData(key, val);
          });
        }
        toast.error((err as Error)?.message || 'Failed to update comment', { id: `comment-${vars.commentId}` });
      },
      onSettled: (_data, _err, variables) => {
        queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
        if (variables.projectId) {
          queryClient.invalidateQueries({ queryKey: ['project-review-overview', variables.projectId] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        }
      },
      onSuccess: (_data, vars) => {
        toast.success('Comment updated', { id: `comment-${vars.commentId}` });
      },
    },
    queryClient,
  );
};

export const useDeleteComment = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({
        pageId,
        commentId,
      }: {
        pageId: string;
        commentId: string;
        projectId?: string;
      }) => {
        return await pagesService.comments.deleteComment(pageId, commentId);
      },
      onMutate: async ({ pageId, commentId }) => {
        await queryClient.cancelQueries({ queryKey: ['page-comments', pageId] });
        const previousData = queryClient.getQueriesData<PageComment[]>({ queryKey: ['page-comments', pageId] });

        queryClient.setQueriesData<PageComment[]>(
          { queryKey: ['page-comments', pageId] },
          (old) => (old ? old.filter((c) => c.id !== commentId) : old),
        );

        return { previousData, pageId };
      },
      onError: (_err, vars, context) => {
        if (context?.previousData) {
          context.previousData.forEach(([key, val]) => {
            queryClient.setQueryData(key, val);
          });
        }
        toast.error('Failed to delete comment', { id: `comment-${vars.commentId}` });
      },
      onSettled: (_data, _err, vars) => {
        queryClient.invalidateQueries({ queryKey: ['page-comments', vars.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
      },
      onSuccess: (_data, vars) => {
        toast.success('Comment deleted', { id: `comment-${vars.commentId}` });
      },
    },
    queryClient,
  );
};

export const useAddReply = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({
        pageId,
        commentId,
        content,
      }: {
        pageId: string;
        commentId: string;
        content: string;
        projectId?: string;
      }) => {
        return await pagesService.comments.addReply(pageId, commentId, content);
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        toast.success('Reply added', { id: `reply-${variables.commentId}` });
      },
      onError: (err: Error | unknown, variables) => {
        toast.error((err as Error)?.message || 'Failed to add reply', { id: `reply-${variables.commentId}` });
      },
    },
    queryClient,
  );
};

export const useResolveComment = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({
        pageId,
        commentId,
        resolved,
      }: {
        pageId: string;
        commentId: string;
        resolved: boolean;
        projectId?: string;
      }) => {
        return await pagesService.comments.resolveComment(pageId, commentId, resolved);
      },
      onMutate: async ({ pageId, commentId, resolved }) => {
        await queryClient.cancelQueries({ queryKey: ['page-comments', pageId] });
        const previousData = queryClient.getQueriesData<PageComment[]>({ queryKey: ['page-comments', pageId] });

        queryClient.setQueriesData<PageComment[]>(
          { queryKey: ['page-comments', pageId] },
          (old) =>
            old
              ? old.map((c) =>
                  c.id === commentId ? { ...c, status: (resolved ? 'resolved' : 'open') as CommentStatus } : c,
                )
              : old,
        );

        return { previousData, pageId };
      },
      onError: (_err, vars, context) => {
        if (context?.previousData) {
          context.previousData.forEach(([key, val]) => {
            queryClient.setQueryData(key, val);
          });
        }
        toast.error('Failed to update status', { id: `resolve-${vars.commentId}` });
      },
      onSettled: (_data, _err, vars) => {
        queryClient.invalidateQueries({ queryKey: ['page-comments', vars.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
      },
      onSuccess: (_, variables) => {
        toast.success(variables.resolved ? 'Comment resolved' : 'Comment reopened', {
          id: `resolve-${variables.commentId}`,
        });
      },
    },
    queryClient,
  );
};

export const useDeleteReply = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({
        pageId,
        commentId,
        replyId,
      }: {
        pageId: string;
        commentId: string;
        replyId: string;
        projectId?: string;
      }) => {
        return await pagesService.comments.deleteReply(pageId, commentId, replyId);
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        toast.success('Reply deleted', { id: `reply-${variables.replyId}` });
      },
      onError: (err: Error | unknown, variables) => {
        toast.error((err as Error)?.message || 'Failed to delete reply', { id: `reply-${variables.replyId}` });
      },
    },
    queryClient,
  );
};

export const useUpdateReply = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({
        pageId,
        commentId,
        replyId,
        content,
      }: {
        pageId: string;
        commentId: string;
        replyId: string;
        content: string;
        projectId?: string;
      }) => {
        return await pagesService.comments.updateReply(pageId, commentId, replyId, content);
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        toast.success('Reply updated', { id: `reply-${variables.replyId}` });
      },
      onError: (err: Error | unknown, variables) => {
        toast.error((err as Error)?.message || 'Failed to update reply', { id: `reply-${variables.replyId}` });
      },
    },
    queryClient,
  );
};
