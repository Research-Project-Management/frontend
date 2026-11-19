/**
 * search.client.ts
 *
 * Full-text project search and atomic batch replace sub-API.
 */

import { apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import type {
  SearchOptions,
  SearchResultResponse,
  BatchReplaceOptions,
  BatchReplaceResultResponse,
} from './types';

export const search = {
  search: async (
    projectId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultResponse> => {
    const cleanPageId = options.pageId?.trim();
    const endpoint =
      !projectId && cleanPageId
        ? `${PAGES_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/search`
        : `${PAGES_API_BASE}/spaces/${projectId}/search`;
    return apiPost<SearchResultResponse>(endpoint, {
      query,
      ...options,
    });
  },

  batchReplace: async (
    projectId: string,
    query: string,
    replaceWith: string,
    options: BatchReplaceOptions = {},
  ): Promise<BatchReplaceResultResponse> => {
    const cleanPageId = options.pageId?.trim();
    const endpoint =
      !projectId && cleanPageId
        ? `${PAGES_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/replace`
        : `${PAGES_API_BASE}/spaces/${projectId}/replace`;
    return apiPost<BatchReplaceResultResponse>(endpoint, {
      query,
      replaceWith,
      ...options,
    });
  },
};
