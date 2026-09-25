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
      } catch (err) {
        console.error('[usePageComments] Failed to load comments:', err);
        return [];
      }
    },
    enabled: !!pageId,
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
      toast.success('Đã thêm bình luận');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể thêm bình luận');
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
      toast.success('Đã cập nhật bình luận');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể cập nhật bình luận');
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
      toast.success('Đã xóa bình luận');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể xóa bình luận');
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
      toast.success('Đã trả lời bình luận');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể gửi phản hồi');
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
      toast.success(variables.resolved ? 'Đã giải quyết bình luận' : 'Đã mở lại bình luận');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể cập nhật trạng thái');
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
      toast.success('Đã xóa phản hồi');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể xóa phản hồi');
    },
  });
};
