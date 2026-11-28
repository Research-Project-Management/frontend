/**
 * document.queries.ts
 *
 * TanStack Query Keys & Query Options for Editor Document Management.
 * Server-authoritative with hot RAM LRU cache.
 */

import { queryOptions } from '@tanstack/react-query';
import {
  pagesService,
  mapStructureNodesToPageFiles,
} from '@/features/editor/sdk/pages.service';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  extractProjectId,
  extractDocumentContentString,
  type Page,
} from '@/features/editor/domain/types/core.types';
import {
  pageKeys,
  storageKeys,
  invalidateFileTreeQueries,
  DOCUMENT_QUERY_STALE_TIME,
  DOCUMENT_PAGE_LOCAL_FIRST_STALE_TIME,
  DOCUMENT_QUERY_GC_TIME,
  type InvalidateFileTreeOptions,
} from './query-keys';
import {
  registerEditorBootstrapPromise,
  waitForEditorBootstrap,
  normalizeBootstrapActivePage,
  hydrateEditorBootstrap,
  editorBootstrapQuery,
} from './bootstrap.queries';

export {
  pageKeys,
  storageKeys,
  invalidateFileTreeQueries,
  registerEditorBootstrapPromise,
  waitForEditorBootstrap,
  hydrateEditorBootstrap,
  editorBootstrapQuery,
};
export type { InvalidateFileTreeOptions };

function buildPageFromRamModel(params: {
  id: string;
  content: string;
  filePath: string;
  projectId?: string;
  spaceId?: string;
  rev?: number;
  hash?: string | null;
  updatedAt?: string;
}): Page {
  const leafTitle = params.filePath.split('/').pop() || params.filePath || 'main.tex';
  return {
    id: params.id,
    title: leafTitle,
    path: params.filePath,
    content: params.content,
    projectId: params.projectId || params.spaceId || params.id,
    ...(params.spaceId ? { spaceId: params.spaceId } : {}),
    ...(params.rev !== undefined ? { rev: params.rev } : {}),
    ...(params.hash !== undefined ? { hash: params.hash } : {}),
    updatedAt: params.updatedAt || new Date().toISOString(),
  } as Page;
}

/**
 * Resolves a document from hot RAM cache or authoritative server (`GET /docs/:id`).
 */
export async function resolveDocumentLocalFirst(
  pageId: string,
  options?: { fallbackPath?: string },
): Promise<Page> {
  if (!pageId) throw new Error('Missing pageId');

  const pendingBoot = waitForEditorBootstrap(pageId);
  if (pendingBoot) {
    const boot = await pendingBoot;
    if (boot?.activeDoc?.page?.id === pageId) {
      return normalizeBootstrapActivePage(boot);
    }
  }

  // Tier 1: Hot RAM LRU Cache
  const ramModel = lruDocumentCache.getModel(pageId);
  if (ramModel && ramModel.isAuthoritative !== false) {
    return buildPageFromRamModel({
      id: pageId,
      content: ramModel.content,
      filePath: ramModel.filePath || options?.fallbackPath || 'main.tex',
      projectId: ramModel.projectId,
      spaceId: ramModel.spaceId,
      rev: ramModel.serverRev,
      hash: ramModel.hash,
      updatedAt: ramModel.serverUpdatedAt,
    });
  }

  // Tier 2: Server Authoritative Fetch
  const page = await pagesService.docs.getById(pageId);
  if (page?.id) {
    const textContent = extractDocumentContentString(page.content);
    const resolvedProjectId = extractProjectId(page.projectId) || page.spaceId || page.id;
    const filePath = page.path || page.title || options?.fallbackPath || 'main.tex';

    if (!lruDocumentCache.isDirty(page.id)) {
      lruDocumentCache.registerModel(page.id, {
        content: textContent,
        filePath,
        projectId: resolvedProjectId,
        ...(page.spaceId ? { spaceId: page.spaceId } : {}),
        ...(typeof page.rev === 'number' ? { serverRev: page.rev } : {}),
        ...(page.hash !== undefined ? { hash: page.hash } : {}),
        ...(page.updatedAt ? { serverUpdatedAt: page.updatedAt } : {}),
        isAuthoritative: true,
      });
    }
  }
  return page;
}

export const pageQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.detail(pageId),
    queryFn: async () => resolveDocumentLocalFirst(pageId),
    staleTime: DOCUMENT_PAGE_LOCAL_FIRST_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      const pendingBoot = waitForEditorBootstrap(pageId);
      if (pendingBoot) {
        const boot = await pendingBoot;
        if (boot?.tree) {
          return mapStructureNodesToPageFiles(boot.tree, boot.workspace.rootDocId);
        }
      }
      return pagesService.docs.getFiles(pageId);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });

export const deletedFilesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.deletedFiles(pageId),
    queryFn: async () => {
      if (!pageId) return [];
      return await pagesService.docs.getDeletedFiles(pageId);
    },
    staleTime: DOCUMENT_QUERY_STALE_TIME,
    gcTime: DOCUMENT_QUERY_GC_TIME,
  });
