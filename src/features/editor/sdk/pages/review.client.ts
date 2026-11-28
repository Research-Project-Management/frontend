/**
 * review.client.ts
 *
 * Review & track changes, inline comment threads, and suggestions sub-APIs.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import type {
  ReviewStatus,
  ReviewRoundInfo,
  ReviewStatusResponse,
  ProjectReviewOverviewResponseDto,
  ProjectReviewFileOverviewDto,
  CreateSuggestionPayload,
} from './types/review.types';
import type { Page } from '@/features/editor/domain/types/core.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';

export type {
  ReviewStatus,
  ReviewRoundInfo,
  ReviewStatusResponse,
  ProjectReviewOverviewResponseDto,
  ProjectReviewFileOverviewDto,
};

export const comments = {
  getComments: async (docId: string, status?: string): Promise<PageComment[]> => {
    if (!docId) return [];
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await apiGet<{ comments: PageComment[] }>(
        `${PAGES_API_BASE}/docs/${docId}/comments${query}`,
        { silent: true },
      );
      return data.comments || [];
    } catch {
      return [];
    }
  },

  getCommentsPage: async (
    docId: string,
    options?: { status?: string; cursor?: string | null; limit?: number },
  ): Promise<{
    comments: PageComment[];
    nextCursor: string | null;
    hasMore: boolean;
  }> => {
    if (!docId) return { comments: [], nextCursor: null, hasMore: false };
    try {
      const params = new URLSearchParams();
      if (options?.status) params.set('status', options.status);
      if (options?.cursor) params.set('cursor', options.cursor);
      params.set('limit', String(options?.limit ?? 20));
      const data = await apiGet<{
        comments: PageComment[];
        nextCursor?: string | null;
        hasMore?: boolean;
      }>(`${PAGES_API_BASE}/docs/${docId}/comments?${params.toString()}`, { silent: true });
      return {
        comments: data.comments || [],
        nextCursor: data.nextCursor ?? null,
        hasMore: Boolean(data.hasMore),
      };
    } catch {
      return { comments: [], nextCursor: null, hasMore: false };
    }
  },

  createComment: async (
    docId: string,
    payload: {
      content: string;
      line?: number;
      lineEnd?: number;
      anchorStart?: string;
      anchorEnd?: string;
      baseDocRev?: number;
      spaceId?: string;
    },
  ): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(`${PAGES_API_BASE}/docs/${docId}/comments`, payload);
    return data.comment;
  },

  updateComment: async (
    docId: string,
    commentId: string,
    payload: { content?: string; status?: 'open' | 'resolved' } | string,
  ): Promise<PageComment> => {
    const body = typeof payload === 'string' ? { content: payload } : payload;
    const data = await apiPatch<{ comment: PageComment }>(
      `${PAGES_API_BASE}/docs/${docId}/comments/${commentId}`,
      body,
    );
    return data.comment;
  },

  deleteComment: async (docId: string, commentId: string): Promise<void> => {
    await apiDelete(`${PAGES_API_BASE}/docs/${docId}/comments/${commentId}`);
  },

  deleteReply: async (docId: string, commentId: string, replyId: string): Promise<PageComment> => {
    const data = await apiDelete<{ comment: PageComment }>(
      `${PAGES_API_BASE}/docs/${docId}/comments/${commentId}/replies/${replyId}`,
    );
    return data.comment;
  },

  addReply: async (docId: string, commentId: string, content: string): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(
      `${PAGES_API_BASE}/docs/${docId}/comments/${commentId}/replies`,
      { content },
    );
    return data.comment;
  },

  updateReply: async (
    docId: string,
    commentId: string,
    replyId: string,
    content: string,
  ): Promise<PageComment> => {
    const data = await apiPatch<{ comment: PageComment }>(
      `${PAGES_API_BASE}/docs/${docId}/comments/${commentId}/replies/${replyId}`,
      { content },
    );
    return data.comment;
  },

  resolveComment: async (docId: string, commentId: string, resolved: boolean): Promise<PageComment> => {
    const data = await apiPatch<{ comment: PageComment }>(
      `${PAGES_API_BASE}/docs/${docId}/comments/${commentId}/resolve`,
      { resolved },
    );
    return data.comment;
  },
};

export const suggestions = {
  getSuggestions: async (docId: string, status?: SuggestionStatus): Promise<PageSuggestion[]> => {
    if (!docId) return [];
    try {
      const queryStr = status ? `?status=${status}` : '';
      const data = await apiGet<{ suggestions: PageSuggestion[] }>(
        `${PAGES_API_BASE}/docs/${docId}/suggestions${queryStr}`,
        { silent: true },
      );
      return data.suggestions || [];
    } catch {
      return [];
    }
  },

  createSuggestion: async (payload: CreateSuggestionPayload): Promise<PageSuggestion> => {
    const {
      pageId,
      idempotencyKey,
      silent,
      headers,
      ...body
    } = payload;
    const resolvedHeaders: Record<string, string> = {
      ...(headers ?? {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
    const resolvedIdempotencyKey =
      idempotencyKey || resolvedHeaders['Idempotency-Key'] || resolvedHeaders['idempotency-key'];
    const hasRequestOptions =
      Object.keys(resolvedHeaders).length > 0 || silent !== undefined || Boolean(resolvedIdempotencyKey);
    const data = hasRequestOptions
      ? await apiPost<{ suggestion: PageSuggestion }>(
          `${PAGES_API_BASE}/docs/${pageId}/suggestions`,
          body,
          {
            ...(Object.keys(resolvedHeaders).length > 0 ? { headers: resolvedHeaders } : {}),
            ...(resolvedIdempotencyKey ? { idempotencyKey: resolvedIdempotencyKey } : {}),
            ...(silent !== undefined ? { silent } : {}),
          },
        )
      : await apiPost<{ suggestion: PageSuggestion }>(
          `${PAGES_API_BASE}/docs/${pageId}/suggestions`,
          body,
        );
    return data.suggestion;
  },

  acceptSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion; page: Page }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion; page: Page }>(
      `${PAGES_API_BASE}/docs/${docId}/suggestions/${suggestionId}/accept`,
      {},
    );
  },

  rejectSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion }>(
      `${PAGES_API_BASE}/docs/${docId}/suggestions/${suggestionId}/reject`,
      {},
    );
  },

  acceptAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; acceptedCount: number; page?: Page }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: Page }>(
      `${PAGES_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'accept' },
    );
  },

  rejectAllSuggestions: async (docId: string): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${PAGES_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'reject' },
    );
  },

  acceptSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; acceptedCount: number; page?: Page }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: Page }>(
      `${PAGES_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'accept', suggestionIds },
    );
  },

  rejectSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${PAGES_API_BASE}/docs/${docId}/suggestions/batch-resolve`,
      { action: 'reject', suggestionIds },
    );
  },

  batchResolve: async (
    docId: string,
    payload: { action: 'accept' | 'reject'; suggestionIds?: string[] },
  ): Promise<{
    ok: boolean;
    action: 'accept' | 'reject';
    resolvedCount: number;
    acceptedCount: number;
    rejectedCount: number;
    page?: Page;
  }> => {
    return await apiPost(`${PAGES_API_BASE}/docs/${docId}/suggestions/batch-resolve`, payload);
  },
};

export const review = {
  getReviewStatus: async (_spaceId: string, docId: string): Promise<ReviewStatusResponse> => {
    return await apiGet<ReviewStatusResponse>(`${PAGES_API_BASE}/docs/${docId}/review-status`);
  },

  getProjectOverview: async (
    targetId: string,
    options?: { isPageScope?: boolean },
  ): Promise<ProjectReviewOverviewResponseDto | null> => {
    if (!targetId) return null;
    const segment = options?.isPageScope ? 'pages' : 'spaces';
    try {
      return await apiGet<ProjectReviewOverviewResponseDto>(
        `${PAGES_API_BASE}/${segment}/${targetId}/review-overview`,
        { silent: true },
      );
    } catch {
      return null;
    }
  },

  updateReviewStatus: async (
    _spaceId: string,
    docId: string,
    payload: { status: ReviewStatus; notes?: string; deadline?: string },
  ): Promise<ReviewStatusResponse> => {
    return await apiPost<ReviewStatusResponse>(
      `${PAGES_API_BASE}/docs/${docId}/review-status`,
      payload,
    );
  },
};
