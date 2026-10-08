/**
 * search.api.ts
 *
 * Full-text search and atomic batch replacement sub-API across project files.
 */

import { apiPost } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type {
  SearchResultResponse,
  BatchReplaceResultResponse,
  SearchOptions,
  BatchReplaceOptions,
} from './types';

export const search = {
  search: async (
    projectId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultResponse> => {
    return apiPost<SearchResultResponse>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/search`,
      {
        query,
        ...options,
      },
    );
  },

  batchReplace: async (
    projectId: string,
    query: string,
    replaceWith: string,
    options: BatchReplaceOptions = {},
  ): Promise<BatchReplaceResultResponse> => {
    return apiPost<BatchReplaceResultResponse>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/replace`,
      {
        query,
        replaceWith,
        ...options,
      },
    );
  },
};
