/**
 * citations.api.ts
 *
 * Citations and bibliography sub-API: Search, resolve, validation, library sync, raw parsing.
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type { BibEntryDto, CitationValidationDto } from './types';

export const citations = {
  search: async (projectId: string, query = '', limit = 20): Promise<BibEntryDto[]> => {
    return await apiGet<BibEntryDto[]>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  resolve: async (projectId: string, identifier: string): Promise<{ success: boolean; entry: BibEntryDto }> => {
    return await apiPost<{ success: boolean; entry: BibEntryDto }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/resolve`,
      { identifier },
    );
  },

  validate: async (projectId: string): Promise<CitationValidationDto> => {
    return await apiGet<CitationValidationDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/validate`);
  },

  syncLibrary: async (
    projectId: string,
    dto: { provider: string; collectionId: string; collectionName?: string; targetBibFile?: string },
  ) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/sync-library`, dto);
  },

  listLibraryCollections: async (): Promise<any[]> => {
    try {
      return await apiGet<any[]>(`${MANUSCRIPTS_API_BASE}/citations/library-collections`);
    } catch {
      return [];
    }
  },

  parseRaw: async (rawBibtex: string): Promise<BibEntryDto[]> => {
    try {
      return await apiPost<BibEntryDto[]>(`${MANUSCRIPTS_API_BASE}/citations/parse-raw`, { rawBibtex });
    } catch {
      return [];
    }
  },
};
