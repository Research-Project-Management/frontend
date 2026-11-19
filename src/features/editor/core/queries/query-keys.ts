/**
 * query-keys.ts
 *
 * Canonical TanStack Query Keys and File-Tree Invalidation Utilities for Editor Document Management.
 */

import type { QueryClient } from '@tanstack/react-query';

export const pageKeys = {
  all: ['pages'] as const,
  bootstrap: (targetId: string, fileId?: string | null, isProjectRoute?: boolean) =>
    isProjectRoute
      ? (['pages', 'bootstrap', 'project', targetId, fileId || 'root'] as const)
      : (['pages', 'bootstrap', targetId, fileId || 'root'] as const),
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

export const DOCUMENT_QUERY_STALE_TIME = 30_000;
export const DOCUMENT_PAGE_LOCAL_FIRST_STALE_TIME = Infinity;
export const DOCUMENT_QUERY_GC_TIME = 5 * 60_000;

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
    queryClient.invalidateQueries({ queryKey: ['pages', 'bootstrap'] });
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
