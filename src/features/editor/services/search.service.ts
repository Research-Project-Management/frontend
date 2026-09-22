/**
 * search.service.ts
 *
 * Frontend service for Document Search & Batch Replace:
 *  - Project-wide and page-hierarchy text search
 *  - Atomic cross-file batch replace
 */

import { apiPost } from '@/shared/lib/api';

export interface SearchMatchEntry {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
  snippet: string;
}

export interface FileSearchResult {
  fileId: string;
  fileName: string;
  isMainFile: boolean;
  totalMatches: number;
  matches: SearchMatchEntry[];
}

export interface SearchResultResponse {
  query: string;
  totalFiles: number;
  totalMatches: number;
  results: FileSearchResult[];
  truncated: boolean;
}

export interface BatchReplaceResultResponse {
  query: string;
  replaceWith: string;
  totalFilesAffected: number;
  totalOccurrencesReplaced: number;
  affectedFileIds: string[];
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileIds?: string[];
  maxResults?: number;
}

export interface BatchReplaceOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileIds?: string[];
}

export const documentSearchService = {
  search: async (
    targetId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultResponse> => {
    return apiPost<SearchResultResponse>(
      `/api/projects/${targetId}/documents/search`,
      {
        query,
        ...options,
      },
    );
  },

  batchReplace: async (
    targetId: string,
    query: string,
    replaceWith: string,
    options: BatchReplaceOptions = {},
  ): Promise<BatchReplaceResultResponse> => {
    return apiPost<BatchReplaceResultResponse>(
      `/api/projects/${targetId}/documents/replace`,
      {
        query,
        replaceWith,
        ...options,
      },
    );
  },
};
