/**
 * document.queries.ts
 *
 * TanStack Query Keys & Query Options for Editor Document Management.
 * Layer 4: Presentation / Data-Fetching Queries.
 */

import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';

// ── 1. Query Keys ────────────────────────────────────────────────────────────

export const pageKeys = {
  all: ['pages'] as const,
  detail: (pageId: string) => ['pages', 'detail', pageId] as const,
  files: (pageId: string) => ['pages', 'detail', pageId, 'files'] as const,
  deletedFiles: (pageId: string) => ['pages', 'detail', pageId, 'deleted-files'] as const,
};

export const storageKeys = {
  allFiles: ['editor-storage-files'] as const,
  storageAll: (projectId?: string | null) =>
    projectId
      ? (['editor-storage-files', projectId] as const)
      : (['editor-storage-files'] as const),
  files: (projectId?: string | null, pageIdOrProjectId?: string | null, parentId?: string | null) =>
    parentId !== undefined
      ? (['editor-storage-files', projectId, pageIdOrProjectId, parentId] as const)
      : (['editor-storage-files', projectId, pageIdOrProjectId] as const),
  rootDoc: (projectId?: string | null) =>
    projectId ? (['editor-root-doc', projectId] as const) : (['editor-root-doc'] as const),
  projects: ['projects'] as const,
};

export interface InvalidateFileTreeOptions {
  parentPageId?: string | null;
  pageId?: string | null;
  includeDeleted?: boolean;
  includeRootDoc?: boolean;
  includeProjects?: boolean;
}

const DOCUMENT_QUERY_STALE_TIME = 30_000;
const DOCUMENT_QUERY_GC_TIME = 5 * 60_000;
const INVALIDATION_DEDUP_WINDOW_MS = 50;
const recentInvalidationTimestamps = new WeakMap<QueryClient, Map<string, number>>();

/**
 * Single authority for invalidating all TanStack Query keys related to the
 * Editor & Manuscript Virtual File Tree (DRY + Hollywood Principle).
 */
export function invalidateFileTreeQueries(
  queryClient: QueryClient,
  options?: InvalidateFileTreeOptions,
): void {
  const {
    parentPageId,
    pageId,
    includeDeleted = true,
    includeRootDoc = false,
    includeProjects = true,
  } = options ?? {};

  const dedupKey = `${parentPageId ?? '*'}|${pageId ?? '*'}|${includeDeleted ? 1 : 0}|${includeRootDoc ? 1 : 0}|${includeProjects ? 1 : 0}`;
  const now = Date.now();
  let clientMap = recentInvalidationTimestamps.get(queryClient);
  if (!clientMap) {
    clientMap = new Map<string, number>();
    recentInvalidationTimestamps.set(queryClient, clientMap);
  }
  const lastInvalidatedAt = clientMap.get(dedupKey);
  if (lastInvalidatedAt !== undefined && now - lastInvalidatedAt < INVALIDATION_DEDUP_WINDOW_MS) {
    return;
  }
  clientMap.set(dedupKey, now);

  queryClient.invalidateQueries({ queryKey: storageKeys.allFiles });

  if (includeProjects) {
    queryClient.invalidateQueries({ queryKey: storageKeys.projects });
  }
  if (includeRootDoc) {
    queryClient.invalidateQueries({ queryKey: storageKeys.rootDoc() });
  }
  if (pageId) {
    queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
    if (includeDeleted) {
      queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(pageId) });
    }
  }
  if (parentPageId) {
    queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
    if (includeDeleted) {
      queryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(parentPageId) });
    }
  }
  if (!pageId && !parentPageId) {
    queryClient.invalidateQueries({ queryKey: pageKeys.all });
  }
}

// ── 2. Query Options ─────────────────────────────────────────────────────────

export const pageQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.detail(pageId),
    queryFn: async () => {
      if (!pageId) throw new Error('Missing pageId');
      return await manuscriptService.docs.getById(pageId);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await manuscriptService.docs.getFiles(pageId);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

export const deletedFilesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.deletedFiles(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await manuscriptService.docs.getDeletedFiles(pageId);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

