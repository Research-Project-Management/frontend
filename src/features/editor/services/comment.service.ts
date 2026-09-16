/**
 * comment.service.ts
 *
 * Frontend service mirroring Backend `modules/document/comment/`:
 *  - Inline comments on pages/lines
 *  - Threading & replies
 *  - Resolve / Delete
 */

import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type { PageComment } from '../types';

export const commentService = {
  getComments: async (pageId: string): Promise<PageComment[]> => {
    const data = await apiGet<{ comments: PageComment[] }>(`/api/pages/${pageId}/comments`);
    return data.comments;
  },

  createComment: async (
    pageId: string,
    payload: {
      content: string;
      line?: number;
      lineEnd?: number;
    },
  ): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(
      `/api/pages/${pageId}/comments`,
      payload,
    );
    return data.comment;
  },

  updateComment: async (
    pageId: string,
    commentId: string,
    payload: { content?: string; status?: 'open' | 'resolved' } | string,
  ): Promise<PageComment> => {
    const body = typeof payload === 'string' ? { content: payload } : payload;
    const data = await apiPatch<{ comment: PageComment }>(
      `/api/pages/${pageId}/comments/${commentId}`,
      body,
    );
    return data.comment;
  },

  deleteComment: async (pageId: string, commentId: string): Promise<void> => {
    await apiDelete(`/api/pages/${pageId}/comments/${commentId}`);
  },

  deleteReply: async (
    pageId: string,
    commentId: string,
    replyId: string,
  ): Promise<PageComment> => {
    const data = await apiDelete<{ comment: PageComment }>(
      `/api/pages/${pageId}/comments/${commentId}/replies/${replyId}`,
    );
    return data.comment;
  },

  addReply: async (
    pageId: string,
    commentId: string,
    content: string,
  ): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(
      `/api/pages/${pageId}/comments/${commentId}/reply`,
      { content },
    );
    return data.comment;
  },

  resolveComment: async (
    pageId: string,
    commentId: string,
    resolved: boolean,
  ): Promise<PageComment> => {
    const data = await apiPatch<{ comment: PageComment }>(
      `/api/pages/${pageId}/comments/${commentId}/resolve`,
      { resolved },
    );
    return data.comment;
  },
};

export const DocumentCommentService = commentService;
