/**
 * suggestions.api.ts
 *
 * Review suggestions sub-API: Accept, reject, create suggestions.
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types';
import { MANUSCRIPTS_API_BASE } from './base';
import type { CreateSuggestionPayload } from './types';

export const suggestions = {
  getSuggestions: async (
    docId: string,
    status?: SuggestionStatus,
  ): Promise<PageSuggestion[]> => {
    if (!docId) return [];
    try {
      const queryStr = status ? `?status=${status}` : '';
      const data = await apiGet<{ suggestions: PageSuggestion[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions${queryStr}`,
        { silent: true },
      );
      return data.suggestions || [];
    } catch {
      return [];
    }
  },

  createSuggestion: async (payload: CreateSuggestionPayload): Promise<PageSuggestion> => {
    const { pageId, ...body } = payload;
    const data = await apiPost<{ suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${pageId}/suggestions`,
      body,
    );
    return data.suggestion;
  },

  acceptSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion; page: any }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion; page: any }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/accept`,
      {},
    );
  },

  rejectSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/reject`,
      {},
    );
  },

  acceptAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; acceptedCount: number; page?: any }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: any }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/accept-all`,
      {},
    );
  },

  rejectAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/reject-all`,
      {},
    );
  },
};
