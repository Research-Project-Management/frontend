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
      try {
        const comments = await commentService.getComments(pageId, status);
        return comments || [];
      } catch {
        return [];
      }
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
    }: {
      pageId: string;
      content: string;
      line?: number | null;
      lineEnd?: number | null;
    }) => {
      return await commentService.createComment(pageId, {
        content,
        line: line ?? undefined,
        lineEnd: lineEnd ?? undefined,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
      toast.success('Comment added');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to add comment');
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
      toast.success('Comment updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update comment');
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, commentId }: { pageId: string; commentId: string }) => {
      return await commentService.deleteComment(pageId, commentId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
      toast.success('Comment deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete comment');
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
    }: {
      pageId: string;
      commentId: string;
      resolved: boolean;
    }) => {
      return await commentService.resolveComment(pageId, commentId, resolved);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-comments', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-comments'] });
      toast.success(variables.resolved ? 'Comment resolved' : 'Comment reopened');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update status');
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
