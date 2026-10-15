'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { CommentService } from '@/features/projects/project-id/work-items/api/work-item.api';
import { workItemToast } from './use-work-item-toast';

export const commentKeys = {
  item: (id: string) => ['comments', id] as const,
  workItem: (id: string) => ['work-item-comments', id] as const,
};

function invalidateCommentQueries(queryClient: QueryClient, targetId: string) {
  queryClient.invalidateQueries({ queryKey: commentKeys.item(targetId) });
  queryClient.invalidateQueries({ queryKey: commentKeys.workItem(targetId) });
  queryClient.invalidateQueries({ queryKey: ['work-items'] });
}

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

export const useAddComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, content }: { id?: string; itemId?: string; workItemId?: string; content: string }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return CommentService.addComment(targetId, content);
    },
    onSuccess: (_, vars) => {
      const targetId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      invalidateCommentQueries(queryClient, targetId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to add comment', 'comment'),
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
      invalidateCommentQueries(queryClient, targetId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to delete comment', 'comment'),
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
      invalidateCommentQueries(queryClient, targetId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to update comment', 'comment'),
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
      invalidateCommentQueries(queryClient, targetId);
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to react to comment', 'comment'),
  });
};

