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
} from './types/search-export.types';

export const search = {
  search: async (
    projectId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultResponse> => {
    const cleanProjectId = projectId?.trim();
    const cleanPageId = options.pageId?.trim();
    const endpoint =
      (!cleanProjectId || cleanProjectId === 'personal') && cleanPageId
        ? `${PAGES_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/search`
        : `${PAGES_API_BASE}/spaces/${encodeURIComponent(cleanProjectId || cleanPageId || '')}/search`;
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
    const cleanProjectId = projectId?.trim();
    const cleanPageId = options.pageId?.trim();
    const endpoint =
      (!cleanProjectId || cleanProjectId === 'personal') && cleanPageId
        ? `${PAGES_API_BASE}/pages/${encodeURIComponent(cleanPageId)}/replace`
        : `${PAGES_API_BASE}/spaces/${encodeURIComponent(cleanProjectId || cleanPageId || '')}/replace`;
    return apiPost<BatchReplaceResultResponse>(endpoint, {
      query,
      replaceWith,
      ...options,
    });
  },
};
