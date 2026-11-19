/**
 * citations.client.ts
 *
 * Citations and bibliography sub-API: Search, resolve, validation, library sync, raw parsing.
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import type { BibEntryDto, CitationValidationDto } from './types';

/** Result of POST citations/sync-library. `conflicts` lists citekeys that already existed and were overwritten. */
export interface SyncLibraryResult {
  collectionId: string;
  syncedCount: number;
  filePath: string;
  conflicts?: string[];
}

export const citations = {
  list: async (projectId: string, limit = 500): Promise<BibEntryDto[]> => {
    if (!projectId) return [];
    try {
      return await apiGet<BibEntryDto[]>(
        `${PAGES_API_BASE}/spaces/${projectId}/citations?limit=${limit}`,
        { silent: true },
      );
    } catch {
      return [];
    }
  },

  search: async (projectId: string, query = '', limit = 20): Promise<BibEntryDto[]> => {
    return await apiGet<BibEntryDto[]>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  resolve: async (projectId: string, identifier: string): Promise<{ success: boolean; entry: BibEntryDto }> => {
    return await apiPost<{ success: boolean; entry: BibEntryDto }>(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/resolve`,
      { identifier },
    );
  },

  validate: async (projectId: string): Promise<CitationValidationDto> => {
    return await apiGet<CitationValidationDto>(`${PAGES_API_BASE}/spaces/${projectId}/citations/validate`);
  },

  refactorKey: async (
    projectId: string,
    dto: { oldKey: string; newKey: string },
  ): Promise<{
    oldKey: string;
    newKey: string;
    totalReplacements: number;
    affectedFiles: Array<{
      docId: string;
      path: string;
      count: number;
      newContent: string;
    }>;
  }> => {
    return await apiPost(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/refactor`,
      dto,
    );
  },

  upsertEntries: async (
    projectId: string,
    dto: {
      entry?: Record<string, unknown>;
      entries?: Array<Record<string, unknown>>;
      rawBibtex?: string;
      targetBibFile?: string;
      targetFilename?: string;
    },
  ): Promise<{
    filePath: string;
    docId?: string;
    syncedCount: number;
    entries: BibEntryDto[];
    formattedBibtex: string;
    conflicts?: string[];
  }> => {
    return await apiPost(
      `${PAGES_API_BASE}/spaces/${projectId}/citations/entries`,
      dto,
    );
  },

  injectBibliography: async (
    projectId: string | undefined,
    dto: {
      docId?: string;
      content?: string;
      filePath?: string;
      format?: 'latex' | 'markdown';
      styleId?: string;
      headingTitle?: string;
      bibliographyText?: string;
      citations?: Array<{
        key?: string;
        inText?: string;
        bibliography?: string;
      }>;
    },
  ): Promise<{
    nextContent: string;
    action: 'replaced' | 'appended';
    section: string;
    format: 'latex' | 'markdown';
  }> => {
    if (projectId) {
      return await apiPost(
        `${PAGES_API_BASE}/spaces/${projectId}/citations/inject-bibliography`,
        dto,
      );
    }
    return await apiPost(`${PAGES_API_BASE}/citations/format-bibitem`, dto);
  },

  syncLibrary: async (
    projectId: string,
    dto: { provider?: string; collectionId: string; collectionName?: string; targetBibFile?: string; targetFilename?: string },
  ): Promise<SyncLibraryResult> => {
    const payload = {
      ...dto,
      ...(dto.targetBibFile && !dto.targetFilename ? { targetFilename: dto.targetBibFile } : {}),
    };
    return await apiPost<SyncLibraryResult>(`${PAGES_API_BASE}/spaces/${projectId}/citations/sync-library`, payload);
  },

  listLibraryCollections: async (): Promise<Array<Record<string, unknown>>> => {
    try {
      return await apiGet<Array<Record<string, unknown>>>(`${PAGES_API_BASE}/citations/library-collections`);
    } catch {
      return [];
    }
  },

  parseRaw: async (rawBibtex: string): Promise<BibEntryDto[]> => {
    try {
      return await apiPost<BibEntryDto[]>(`${PAGES_API_BASE}/citations/parse-raw`, { rawBibtex });
    } catch {
      return [];
    }
  },
};
