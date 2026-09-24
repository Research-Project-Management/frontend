'use client';

/**
 * use-comment.ts
 *
 * Clean Presentational Comment Hooks:
 * - In-memory reactive comment management for UI preview
 * - Decoupled from legacy backend endpoints
 */

import { useState } from 'react';
import type { PageComment, CommentReply, CommentStatus } from '../types';
import { toast } from 'sonner';

export const commentKeys = {
  all: ['page-comments'] as const,
  byPage: (pageId: string | null, _status?: CommentStatus) => ['page-comments', pageId] as const,
};

let sessionComments: PageComment[] = [];
const commentListeners = new Set<() => void>();

function notifyCommentListeners() {
  commentListeners.forEach((fn) => fn());
}

export const usePageComments = (_pageId: string | null, status?: CommentStatus) => {
  const [, setTick] = useState(0);

  useState(() => {
    const listener = () => setTick((t) => t + 1);
    commentListeners.add(listener);
    return () => {
      commentListeners.delete(listener);
    };
  });

  const filtered = status
    ? sessionComments.filter((c) => c.status === status)
    : sessionComments;

  return {
    data: filtered,
    isLoading: false,
    error: null,
  };
};

export const useCreateComment = () => {
  return {
    mutate: (
      {
        pageId,
        content,
        line,
        lineEnd,
      }: {
        pageId: string;
        content: string;
        line?: number | null;
        lineEnd?: number | null;
      },
      opts?: { onSuccess?: () => void; onError?: (err: any) => void },
    ) => {
      const newComment: PageComment = {
        id: `comment-${Date.now()}`,
        page: pageId,
        projectPageId: pageId,
        content,
        line: line ?? null,
        lineEnd: lineEnd ?? null,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: {
          id: 'me',
          name: 'Researcher',
        },
        replies: [],
      };
      sessionComments = [newComment, ...sessionComments];
      notifyCommentListeners();
      toast.success('Comment added');
      opts?.onSuccess?.();
    },
    isPending: false,
  };
};

export const useUpdateComment = () => {
  return {
    mutate: (
      {
        commentId,
        content,
        status,
      }: {
        pageId: string;
        commentId: string;
        content?: string;
        status?: CommentStatus;
      },
      opts?: { onSuccess?: () => void; onError?: (err: any) => void },
    ) => {
      sessionComments = sessionComments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            content: content !== undefined ? content : c.content,
            status: status || c.status,
            updatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      notifyCommentListeners();
      toast.success('Comment updated');
      opts?.onSuccess?.();
    },
    isPending: false,
  };
};

export const useDeleteComment = () => {
  return {
    mutate: (
      { commentId }: { pageId: string; commentId: string },
      opts?: { onSuccess?: () => void; onError?: (err: any) => void },
    ) => {
      sessionComments = sessionComments.filter((c) => c.id !== commentId);
      notifyCommentListeners();
      toast.success('Comment deleted');
      opts?.onSuccess?.();
    },
    isPending: false,
  };
};

export const useAddReply = () => {
  return {
    mutate: (
      {
        commentId,
        content,
      }: {
        pageId: string;
        commentId: string;
        content: string;
      },
      opts?: { onSuccess?: () => void; onError?: (err: any) => void },
    ) => {
      const newReply: CommentReply = {
        id: `reply-${Date.now()}`,
        content,
        createdAt: new Date().toISOString(),
        author: {
          id: 'me',
          name: 'Researcher',
        },
      };
      sessionComments = sessionComments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: [...(c.replies || []), newReply],
          };
        }
        return c;
      });
      notifyCommentListeners();
      toast.success('Reply added');
      opts?.onSuccess?.();
    },
    isPending: false,
  };
};

export const useResolveComment = () => {
  return {
    mutate: (
      {
        commentId,
        resolved,
      }: {
        pageId: string;
        commentId: string;
        resolved: boolean;
      },
      opts?: { onSuccess?: () => void; onError?: (err: any) => void },
    ) => {
      sessionComments = sessionComments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              status: resolved ? ('resolved' as CommentStatus) : ('open' as CommentStatus),
              updatedAt: new Date().toISOString(),
            }
          : c,
      );
      notifyCommentListeners();
      toast.success(resolved ? 'Comment resolved' : 'Comment re-opened');
      opts?.onSuccess?.();
    },
    isPending: false,
  };
};

export const useDeleteReply = () => {
  return {
    mutate: (
      {
        commentId,
        replyId,
      }: {
        pageId: string;
        commentId: string;
        replyId: string;
      },
      opts?: { onSuccess?: () => void; onError?: (err: any) => void },
    ) => {
      sessionComments = sessionComments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== replyId),
          };
        }
        return c;
      });
      notifyCommentListeners();
      toast.success('Reply deleted');
      opts?.onSuccess?.();
    },
    isPending: false,
  };
};
