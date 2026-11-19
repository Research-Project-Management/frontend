/**
 * review.client.ts
 *
 * Review & track changes, inline comment threads, suggestions, and SSE collaboration stream sub-APIs.
 */

import { apiGet, apiPost, apiPatch, apiDelete, getAuthToken } from '@/shared/lib/api';
import { PAGES_API_BASE, getPagesBaseUrl } from './base';
import type {
  ReviewStatus,
  ReviewRoundInfo,
  ReviewStatusResponse,
  ProjectReviewOverviewResponseDto,
  ProjectReviewFileOverviewDto,
  CreateSuggestionPayload,
  CollaborationEvent,
} from './types';
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

  createComment: async (
    docId: string,
    payload: { content: string; line?: number; lineEnd?: number; spaceId?: string },
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
      `${PAGES_API_BASE}/docs/${docId}/comments/${commentId}/reply`,
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
    const { pageId, idempotencyKey, ...body } = payload;
    const data = idempotencyKey
      ? await apiPost<{ suggestion: PageSuggestion }>(
          `${PAGES_API_BASE}/docs/${pageId}/suggestions`,
          body,
          { idempotencyKey },
        )
      : await apiPost<{ suggestion: PageSuggestion }>(`${PAGES_API_BASE}/docs/${pageId}/suggestions`, body);
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
  getReviews: async (projectId: string, docId: string) => {
    return await apiGet<{ changes: unknown[]; threads: unknown[] }>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review`,
    );
  },

  getThreads: async (projectId: string, docId: string) => {
    return await apiGet<unknown[]>(`${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/threads`);
  },

  getChanges: async (projectId: string, docId: string) => {
    return await apiGet<unknown[]>(`${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/changes`);
  },

  recordChange: async (
    projectId: string,
    docId: string,
    payload: {
      type: 'insert' | 'delete';
      text: string;
      startLine?: number;
      startCol?: number;
      endLine?: number;
      endCol?: number;
      range?: { startLine: number; startCol: number; endLine: number; endCol: number };
    },
  ) => {
    return await apiPost<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/changes`,
      payload,
    );
  },

  batchResolveChanges: async (
    projectId: string,
    docId: string,
    payload: {
      action: 'accept_all' | 'reject_all' | 'accept_selected' | 'reject_selected';
      changeIds?: string[];
    },
  ) => {
    return await apiPost<{ resolvedCount: number; action: string }>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/changes/batch`,
      payload,
    );
  },

  createCommentThread: async (
    projectId: string,
    docId: string,
    payload: {
      startLine?: number;
      startCol?: number;
      endLine?: number;
      endCol?: number;
      quote?: string;
      content: string;
      range?: { startLine: number; startCol: number; endLine: number; endCol: number };
      [key: string]: unknown;
    },
  ) => {
    return await apiPost<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/threads`,
      payload,
    );
  },

  addCommentReply: async (projectId: string, docId: string, threadId: string, content: string) => {
    return await apiPost<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/threads/${threadId}/replies`,
      { content },
    );
  },

  resolveCommentThread: async (projectId: string, docId: string, threadId: string, resolved: boolean) => {
    return await apiPatch<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/threads/${threadId}/resolve`,
      { resolve: Boolean(resolved) },
    );
  },

  acceptChange: async (projectId: string, docId: string, changeId: string) => {
    return await apiPost<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/changes/${changeId}/accept`,
      {},
    );
  },

  rejectChange: async (projectId: string, docId: string, changeId: string) => {
    return await apiPost<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review/changes/${changeId}/reject`,
      {},
    );
  },

  getReviewStatus: async (projectId: string, docId: string): Promise<ReviewStatusResponse> => {
    const endpoint = projectId
      ? `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review-status`
      : `${PAGES_API_BASE}/pages/${docId}/review-status`;
    return await apiGet<ReviewStatusResponse>(endpoint);
  },

  getProjectOverview: async (
    scopeId: string,
    options?: { isPageScope?: boolean },
  ): Promise<ProjectReviewOverviewResponseDto | null> => {
    if (!scopeId) return null;
    const segment = options?.isPageScope ? 'pages' : 'spaces';
    try {
      return await apiGet<ProjectReviewOverviewResponseDto>(
        `${PAGES_API_BASE}/${segment}/${scopeId}/review-overview`,
        { silent: true },
      );
    } catch {
      return null;
    }
  },

  updateReviewStatus: async (
    projectId: string,
    docId: string,
    payload: { status: ReviewStatus; notes?: string; deadline?: string },
  ): Promise<ReviewStatusResponse> => {
    const endpoint = projectId
      ? `${PAGES_API_BASE}/spaces/${projectId}/docs/${docId}/review-status`
      : `${PAGES_API_BASE}/pages/${docId}/review-status`;
    return await apiPost<ReviewStatusResponse>(endpoint, payload);
  },
};

export const collaborationService = {
  createCollaborationStream: (
    projectId: string | null | undefined,
    pageId: string,
    onEvent: (event: CollaborationEvent) => void,
  ): (() => void) => {
    const base = getPagesBaseUrl().replace(/\/$/, '');
    const url = projectId
      ? `${base}/spaces/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(pageId)}/collaboration/stream`
      : `${base}/docs/${encodeURIComponent(pageId)}/collaboration/stream`;

    const token = getAuthToken();

    if (typeof EventSource !== 'undefined') {
      const streamUrl = token
        ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : url;
      const eventSource = new EventSource(streamUrl, { withCredentials: true });
      eventSource.onmessage = (e: { data: string }) => {
        try {
          onEvent(JSON.parse(e.data) as CollaborationEvent);
        } catch (err) {
          console.error('Failed to parse SSE collaboration event', err);
        }
      };
      return () => {
        eventSource.close();
      };
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const dataLines = frame
              .split(/\r?\n/)
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trimStart());
            if (dataLines.length === 0) continue;
            try {
              onEvent(JSON.parse(dataLines.join('\n')) as CollaborationEvent);
            } catch (err) {
              console.error('Failed to parse SSE collaboration event', err);
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.debug('Collaboration SSE stream closed', err);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  },
};
