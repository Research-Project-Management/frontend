'use client';

/**
 * use-comment.ts
 *
 * Frontend hooks mirroring Backend `modules/document/comment/`:
 *  - usePageComments
 *  - useCreateComment
 *  - useUpdateComment
 *  - useDeleteComment
 *  - useAddReply
 *  - useResolveComment
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commentService } from '../services/comment.service';
import type { PageComment } from '../types';

export const commentKeys = {
  all: ['page-comments'] as const,
  byPage: (pageId: string | null) => ['page-comments', pageId] as const,
};

export const usePageComments = (pageId: string | null) => {
  return useQuery({
    queryKey: commentKeys.byPage(pageId),
    queryFn: () => (pageId ? commentService.getComments(pageId) : Promise.resolve([])),
    enabled: !!pageId,
  });
};

export const useCreateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pageId,
      content,
      line,
      lineEnd,
    }: {
      pageId: string;
      content: string;
      line?: number | null;
      lineEnd?: number | null;
    }) => commentService.createComment(pageId, {
      content,
      line: line ?? undefined,
      lineEnd: lineEnd ?? undefined,
    }),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
    },
  });
};

export const useUpdateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pageId,
      commentId,
      content,
      status,
    }: {
      pageId: string;
      commentId: string;
      content?: string;
      status?: 'open' | 'resolved';
    }) => commentService.updateComment(pageId, commentId, { content, status }),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
    },
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, commentId }: { pageId: string; commentId: string }) =>
      commentService.deleteComment(pageId, commentId),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
    },
  });
};

export const useAddReply = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pageId,
      commentId,
      content,
    }: {
      pageId: string;
      commentId: string;
      content: string;
    }) => commentService.addReply(pageId, commentId, content),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
    },
  });
};

export const useResolveComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pageId,
      commentId,
      resolved,
    }: {
      pageId: string;
      commentId: string;
      resolved: boolean;
    }) => commentService.resolveComment(pageId, commentId, resolved),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
    },
  });
};

export const useDeleteReply = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pageId,
      commentId,
      replyId,
    }: {
      pageId: string;
      commentId: string;
      replyId: string;
    }) => commentService.deleteReply(pageId, commentId, replyId),
    onSuccess: (_, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
    },
  });
};
