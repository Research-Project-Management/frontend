/**
 * suggestion.service.ts
 *
 * Frontend service mirroring Backend `modules/document/suggestion/`:
 *  - Track changes / Suggestions (pending, accepted, rejected)
 *  - Accept, Reject, Accept-All, Reject-All
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import type { PageSuggestion, SuggestionStatus, SuggestionType } from '../types';

export interface CreateSuggestionPayload {
  pageId: string;
  type: SuggestionType;
  originalText?: string;
  suggestedText?: string;
  fromLine: number;
  fromColumn?: number;
  toLine: number;
  toColumn?: number;
  description?: string;
}

export const suggestionService = {
  getSuggestions: async (
    pageId: string,
    status?: SuggestionStatus,
  ): Promise<PageSuggestion[]> => {
    const queryStr = status ? `?status=${status}` : '';
    const data = await apiGet<{ suggestions: PageSuggestion[] }>(
      `/api/pages/${pageId}/suggestions${queryStr}`,
    );
    return data.suggestions;
  },

  createSuggestion: async (payload: CreateSuggestionPayload): Promise<PageSuggestion> => {
    const { pageId, ...body } = payload;
    const data = await apiPost<{ suggestion: PageSuggestion }>(
      `/api/pages/${pageId}/suggestions`,
      body,
    );
    return data.suggestion;
  },

  acceptSuggestion: async (
    pageId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion; page: any }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion; page: any }>(
      `/api/pages/${pageId}/suggestions/${suggestionId}/accept`,
      {},
    );
  },

  rejectSuggestion: async (
    pageId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion }>(
      `/api/pages/${pageId}/suggestions/${suggestionId}/reject`,
      {},
    );
  },

  acceptAllSuggestions: async (
    pageId: string,
  ): Promise<{ ok: boolean; acceptedCount: number; page?: any }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: any }>(
      `/api/pages/${pageId}/suggestions/accept-all`,
      {},
    );
  },

  rejectAllSuggestions: async (
    pageId: string,
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `/api/pages/${pageId}/suggestions/reject-all`,
      {},
    );
  },
};

export const DocumentSuggestionService = suggestionService;
