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

export interface TextRangeDto {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface RecordChangeInput {
  type: 'insert' | 'delete';
  text: string;
  range?: TextRangeDto;
  fromIndex?: number;
  toIndex?: number;
  startLine?: number;
  startCol?: number;
  endLine?: number;
  endCol?: number;
}

export interface CreateCommentThreadInput {
  content: string;
  quote?: string;
  selectedText?: string;
  range?: TextRangeDto;
  fromIndex?: number;
  toIndex?: number;
  startLine?: number;
  startCol?: number;
  endLine?: number;
  endCol?: number;
}

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
    dto: RecordChangeInput,
  ): Promise<TrackChangeDto> => {
    const range: TextRangeDto = dto.range || {
      startLine: dto.startLine ?? 0,
      startCol: dto.startCol ?? dto.fromIndex ?? 0,
      endLine: dto.endLine ?? dto.startLine ?? 0,
      endCol: dto.endCol ?? dto.toIndex ?? 0,
    };
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes`,
      {
        type: dto.type,
        text: dto.text,
        range,
      },
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
    dto: CreateCommentThreadInput,
  ): Promise<CommentThreadDto> => {
    const range: TextRangeDto = dto.range || {
      startLine: dto.startLine ?? 0,
      startCol: dto.startCol ?? dto.fromIndex ?? 0,
      endLine: dto.endLine ?? dto.startLine ?? 0,
      endCol: dto.endCol ?? dto.toIndex ?? 0,
    };
    return await apiPost<CommentThreadDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads`,
      {
        content: dto.content,
        quote: dto.quote || dto.selectedText,
        range,
      },
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
