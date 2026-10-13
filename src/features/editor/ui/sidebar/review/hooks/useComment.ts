'use client';

/**
 * use-comment.ts
 *
 * Real-time reactive comment management hooks wired directly to:
 * Manuscript Comments Service (`/api/v1/manuscripts/docs/:docId/comments`)
 */

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { PageComment, CommentStatus } from '@/features/editor/domain/types/comment.types';
import { commentService } from '@/features/editor/sdk/manuscript.service';
import { toast } from 'sonner';

export const commentKeys = {
  all: ['page-comments'] as const,
  byPage: (pageId: string | null, status?: CommentStatus) => ['page-comments', pageId, status] as const,
};

export const usePageComments = (
  pageId: string | null,
  status?: CommentStatus,
  queryClient?: QueryClient
) => {
  return useQuery(
    {
      queryKey: commentKeys.byPage(pageId, status),
      queryFn: async (): Promise<PageComment[]> => {
        if (!pageId) return [];
        const comments = await commentService.getComments(pageId, status);
        return comments || [];
      },
      enabled: Boolean(pageId),
    },
    queryClient
  );
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pageId,
      content,
      line,
      lineEnd,
      projectId,
    }: {
      pageId: string;
      content: string;
      line?: number | null;
      lineEnd?: number | null;
      projectId?: string;
    }) => {
      return await commentService.createComment(pageId, {
        content,
        line: line ?? undefined,
        lineEnd: lineEnd ?? undefined,
      });
    },
    onMutate: async ({ pageId, content, line, lineEnd }) => {
      await queryClient.cancelQueries({ queryKey: ['page-comments', pageId] });
      const previousData = queryClient.getQueriesData<PageComment[]>({ queryKey: ['page-comments', pageId] });

      const optimisticComment: PageComment = {
        id: `temp-${Date.now()}`,
        page: pageId,
        projectPageId: pageId,
        author: { id: 'current-user', name: 'You' },
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
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: () => {
      toast.success('Comment added', { id: 'create-comment' });
    },
  });
};

export const useUpdateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
    }) => {
      return await commentService.updateComment(pageId, commentId, {
        content,
        status: status === 'resolved' ? 'resolved' : 'open',
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
                  : c
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
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: (_data, vars) => {
      toast.success('Comment updated', { id: `comment-${vars.commentId}` });
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pageId,
      commentId,
      projectId: _projectId,
    }: {
      pageId: string;
      commentId: string;
      projectId?: string;
    }) => {
      return await commentService.deleteComment(pageId, commentId);
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
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: (_data, vars) => {
      toast.success('Comment deleted', { id: `comment-${vars.commentId}` });
    },
  });
};

export const useAddReply = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
      return await commentService.addReply(pageId, commentId, content);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
      toast.success('Reply added', { id: `reply-${variables.commentId}` });
    },
    onError: (err: Error | unknown, variables) => {
      toast.error((err as Error)?.message || 'Failed to add reply', { id: `reply-${variables.commentId}` });
    },
  });
};

export const useResolveComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pageId,
      commentId,
      resolved,
      projectId: _projectId,
    }: {
      pageId: string;
      commentId: string;
      resolved: boolean;
      projectId?: string;
    }) => {
      return await commentService.resolveComment(pageId, commentId, resolved);
    },
    onMutate: async ({ pageId, commentId, resolved }) => {
      await queryClient.cancelQueries({ queryKey: ['page-comments', pageId] });
      const previousData = queryClient.getQueriesData<PageComment[]>({ queryKey: ['page-comments', pageId] });

      queryClient.setQueriesData<PageComment[]>(
        { queryKey: ['page-comments', pageId] },
        (old) => {
          if (!old) return old;
          return old.map((c) =>
            c.id === commentId ? { ...c, status: (resolved ? 'resolved' : 'open') as CommentStatus } : c,
          );
        },
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
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.resolved ? 'Comment resolved' : 'Comment reopened', { id: `resolve-${variables.commentId}` });
    },
  });
};

export const useDeleteReply = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
      return await commentService.deleteReply(pageId, commentId, replyId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
      toast.success('Reply deleted', { id: `reply-${variables.replyId}` });
    },
    onError: (err: Error | unknown, variables) => {
      toast.error((err as Error)?.message || 'Failed to delete reply', { id: `reply-${variables.replyId}` });
    },
  });
};
