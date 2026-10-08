/**
 * review.api.ts
 *
 * Review & Track Changes sub-API: Tracked changes, comment threads, batch resolution.
 */

import { apiGet, apiPost, apiPatch } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type {
  DocReviewsResponseDto,
  TrackChangeDto,
  CommentThreadDto,
  CommentReplyDto,
} from './types';

export const review = {
  getDocReviews: async (projectId: string, docId: string): Promise<DocReviewsResponseDto> => {
    if (!projectId || !docId) {
      return { changes: [], threads: [] };
    }
    try {
      return await apiGet<DocReviewsResponseDto>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review`,
        { silent: true },
      );
    } catch {
      return { changes: [], threads: [] };
    }
  },

  recordChange: async (
    projectId: string,
    docId: string,
    dto: { type: 'insert' | 'delete'; text: string; fromIndex: number; toIndex: number },
  ): Promise<TrackChangeDto> => {
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes`,
      dto,
    );
  },

  acceptChange: async (projectId: string, docId: string, changeId: string): Promise<TrackChangeDto> => {
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes/${changeId}/accept`,
      {},
    );
  },

  rejectChange: async (projectId: string, docId: string, changeId: string): Promise<TrackChangeDto> => {
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes/${changeId}/reject`,
      {},
    );
  },

  batchResolveChanges: async (
    projectId: string,
    docId: string,
    action: 'accept_all' | 'reject_all',
  ): Promise<any> => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes/batch`,
      { action },
    );
  },

  createCommentThread: async (
    projectId: string,
    docId: string,
    dto: { content: string; fromIndex: number; toIndex: number; selectedText?: string },
  ): Promise<CommentThreadDto> => {
    return await apiPost<CommentThreadDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads`,
      dto,
    );
  },

  addCommentReply: async (
    projectId: string,
    docId: string,
    threadId: string,
    content: string,
  ): Promise<CommentReplyDto> => {
    return await apiPost<CommentReplyDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads/${threadId}/replies`,
      { content },
    );
  },

  resolveCommentThread: async (
    projectId: string,
    docId: string,
    threadId: string,
    resolve: boolean,
  ): Promise<CommentThreadDto> => {
    return await apiPatch<CommentThreadDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads/${threadId}/resolve`,
      { resolve },
    );
  },
};
