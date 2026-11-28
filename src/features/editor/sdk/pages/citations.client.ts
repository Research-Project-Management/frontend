/**
 * citations.client.ts
 *
 * Canonical Citations & Bibliography SDK client (4 endpoints).
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import type { BibEntryDto } from './types/search-export.types';

export interface ListCitationsResponse {
  items: BibEntryDto[];
  total: number;
}

export interface BibMutationResponse {
  filePath: string;
  docId?: string;
  entries: BibEntryDto[];
  conflicts: string[];
}

export const citations = {
  list: async (
    projectId: string,
    query = '',
    limit = 500,
  ): Promise<ListCitationsResponse> => {
    if (!projectId) return { items: [], total: 0 };
    const params = new URLSearchParams({ limit: String(limit) });
    if (query.trim()) {
      params.set('query', query.trim());
    }
    try {
      return await apiGet<ListCitationsResponse>(
        `${PAGES_API_BASE}/spaces/${projectId}/citations?${params.toString()}`,
        { silent: true },
      );
    } catch {
      return { items: [], total: 0 };
    }
  },

  upsertEntries: async (
    projectId: string,
    dto: {
      entries?: ReadonlyArray<object>;
      rawBibtex?: string;
      targetBibFile?: string;
      pageId?: string;
    },
  ): Promise<BibMutationResponse> => {
    return await apiPost<BibMutationResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/entries`,
      dto,
    );
  },

  resolve: async (
    projectId: string,
    identifier: string,
    targetBibFile?: string,
    pageId?: string,
  ): Promise<BibMutationResponse> => {
    return await apiPost<BibMutationResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/resolve`,
      {
        identifier,
        ...(targetBibFile ? { targetBibFile } : {}),
        ...(pageId ? { pageId } : {}),
      },
    );
  },

  syncLibrary: async (
    projectId: string,
    dto: { collectionId: string; targetBibFile?: string; pageId?: string },
  ): Promise<BibMutationResponse> => {
    return await apiPost<BibMutationResponse>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/sync-library`,
      dto,
    );
  },
};
