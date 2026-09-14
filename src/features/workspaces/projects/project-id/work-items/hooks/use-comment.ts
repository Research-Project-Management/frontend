'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CommentService } from '../services/comment.service';

export const commentKeys = {
  item: (id: string) => ['comments', id] as const,
  workItem: (id: string) => ['work-item-comments', id] as const,
};

export const useComments = (id: string) =>
  useQuery({
    queryKey: commentKeys.item(id),
    queryFn: async () => {
      const res = await CommentService.getComments(id);
      if (Array.isArray(res)) return res;
      if (res && 'comments' in res && Array.isArray(res.comments)) return res.comments;
      if (res && 'data' in res && Array.isArray(res.data)) return res.data;
      return [];
    },
    enabled: Boolean(id),
  });

export const useWorkItemComments = useComments;

export const useAddComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, content }: { id?: string; itemId?: string; workItemId?: string; content: string }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return CommentService.addComment(targetId, content);
    },
    onSuccess: (_, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-item-comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add comment'),
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, commentId }: { id?: string; itemId?: string; workItemId?: string; commentId: string }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return CommentService.deleteComment(targetId, commentId);
    },
    onSuccess: (_, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-item-comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete comment'),
  });
};

export const useUpdateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      commentId,
      content,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      commentId: string;
      content: string;
    }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return CommentService.updateComment(targetId, commentId, content);
    },
    onSuccess: (_, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-item-comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update comment'),
  });
};

export const useReactComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      commentId,
      emoji,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      commentId: string;
      emoji: string;
    }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return CommentService.reactComment(targetId, commentId, emoji);
    },
    onSuccess: (_, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-item-comments', targetId] });
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to react to comment'),
  });
};
