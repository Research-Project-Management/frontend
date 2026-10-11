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

/** Converts a 0-based absolute character offset into a 0-based line/column pair. */
export function offsetToLineCol(content: string, offset: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(offset, content.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: clamped - lineStart };
}

/** Converts absolute offsets [from, to) into the backend TextRange contract. */
export function offsetsToRange(content: string, fromIndex: number, toIndex: number): TextRangeDto {
  const a = Math.min(fromIndex, toIndex);
  const b = Math.max(fromIndex, toIndex);
  const s = offsetToLineCol(content, a);
  const e = offsetToLineCol(content, b);
  return { startLine: s.line, startCol: s.col, endLine: e.line, endCol: e.col };
}

interface RangeSource {
  range?: TextRangeDto;
  /** Full document text; required to convert fromIndex/toIndex on multi-line docs. */
  content?: string;
  fromIndex?: number;
  toIndex?: number;
  startLine?: number;
  startCol?: number;
  endLine?: number;
  endCol?: number;
}

export function resolveRange(src: RangeSource): TextRangeDto {
  if (src.range) return src.range;
  if (src.startLine !== undefined) {
    return {
      startLine: src.startLine,
      startCol: src.startCol ?? 0,
      endLine: src.endLine ?? src.startLine,
      endCol: src.endCol ?? src.startCol ?? 0,
    };
  }
  if (src.fromIndex !== undefined) {
    const to = src.toIndex ?? src.fromIndex;
    if (typeof src.content === 'string') {
      return offsetsToRange(src.content, src.fromIndex, to);
    }
    throw new Error('review: fromIndex/toIndex require `content` to compute a line/column range');
  }
  throw new Error('review: a range (range, startLine/startCol, or fromIndex+content) is required');
}

export interface RecordChangeInput {
  type: 'insert' | 'delete';
  text: string;
  range?: TextRangeDto;
  content?: string;
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
  /** Full document text used to convert fromIndex/toIndex into line/column. */
  docContent?: string;
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
    const range: TextRangeDto = resolveRange(dto);
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
    const range: TextRangeDto = resolveRange({ ...dto, content: dto.docContent });
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
