/**
 * document.queries.ts
 *
 * TanStack Query Keys & Query Options for Editor Document Management.
 * Layer 4: Presentation / Data-Fetching Queries.
 */

import { queryOptions } from '@tanstack/react-query';
import { pageService, fileService } from '@/features/editor/sdk/manuscript.service';

// ── 1. Query Keys ────────────────────────────────────────────────────────────

export const pageKeys = {
  all: ['pages'] as const,
  detail: (pageId: string) => ['pages', 'detail', pageId] as const,
  files: (pageId: string) => ['pages', 'detail', pageId, 'files'] as const,
  deletedFiles: (pageId: string) => ['pages', 'detail', pageId, 'deleted-files'] as const,
};

export const editorPageKeys = pageKeys;

// ── 2. Query Options ─────────────────────────────────────────────────────────

export const pageQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.detail(pageId),
    queryFn: async () => {
      if (!pageId) throw new Error('Missing pageId');
      return await pageService.getById(pageId);
    },
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await fileService.getByPageId(pageId);
    },
  });

export const deletedFilesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.deletedFiles(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await fileService.getDeletedByPageId(pageId);
    },
  });

export const pageDetailQueryOptions = pageQuery;
export const pageFilesQueryOptions = filesQuery;
export const pageDeletedFilesQueryOptions = deletedFilesQuery;
