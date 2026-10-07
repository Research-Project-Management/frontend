'use client';

/**
 * use-comment.ts
 *
 * Real-time reactive comment management hooks wired directly to:
 * Manuscript Comments Service (`/api/v1/manuscripts/docs/:docId/comments`)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PageComment, CommentStatus } from '../types';
import { commentService } from '../services/comment.service';
import { toast } from 'sonner';

export const commentKeys = {
  all: ['page-comments'] as const,
  byPage: (pageId: string | null, status?: CommentStatus) => ['page-comments', pageId, status] as const,
};

export const usePageComments = (pageId: string | null, status?: CommentStatus) => {
  return useQuery({
    queryKey: commentKeys.byPage(pageId, status),
    queryFn: async (): Promise<PageComment[]> => {
      if (!pageId) return [];
      const comments = await commentService.getComments(pageId, status);
      return comments || [];
    },
    enabled: Boolean(pageId),
  });
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
        pageId,
        userId: 'current-user',
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
    onError: (err: any, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, val]) => {
          queryClient.setQueryData(key, val);
        });
      }
      toast.error(err?.message || 'Failed to add comment');
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: () => {
      toast.success('Comment added');
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
    onError: (err: any, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, val]) => {
          queryClient.setQueryData(key, val);
        });
      }
      toast.error(err?.message || 'Failed to update comment');
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: () => {
      toast.success('Comment updated');
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
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, val]) => {
          queryClient.setQueryData(key, val);
        });
      }
      toast.error('Failed to delete comment');
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', vars.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: () => {
      toast.success('Comment deleted');
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
      toast.success('Reply added');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to add reply');
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
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([key, val]) => {
          queryClient.setQueryData(key, val);
        });
      }
      toast.error('Failed to update status');
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', vars.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
    },
    onSuccess: (_, variables) => {
      toast.success(variables.resolved ? 'Comment resolved' : 'Comment reopened');
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
      toast.success('Reply deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete reply');
    },
  });
};
