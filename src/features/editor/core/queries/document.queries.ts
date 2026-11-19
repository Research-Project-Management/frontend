/**
 * document.queries.ts
 *
 * TanStack Query Keys & Query Options for Editor Document Management.
 * Layer 4: Presentation / Data-Fetching Queries.
 */

import { queryOptions } from '@tanstack/react-query';
import {
  pagesService,
  mapStructureNodesToPageFiles,
} from '@/features/editor/sdk/pages.service';
import {
  unsyncedEditsStore,
  syncedDocCacheStore,
} from '@/features/editor/domain/offline-storage';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { useConnectivityStore } from '@/features/editor/core/store/connectivity.store';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
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
import {
  synthesizeOfflineEditorBootstrap,
  fetchOfflinePageFilesFallback,
} from './offline-bootstrap';

export {
  pageKeys,
  storageKeys,
  invalidateFileTreeQueries,
  registerEditorBootstrapPromise,
  waitForEditorBootstrap,
  hydrateEditorBootstrap,
  editorBootstrapQuery,
  synthesizeOfflineEditorBootstrap,
};
export type { InvalidateFileTreeOptions };

function buildPageFromSnapshotData(params: {
  id: string;
  content: string;
  filePath: string;
  title?: string;
  projectId?: string;
  spaceId?: string;
  rev?: number;
  hash?: string | null;
  updatedAt?: string | number;
}): Page {
  const leafTitle =
    params.title ||
    params.filePath.split('/').pop() ||
    params.filePath ||
    'main.tex';
  const isoUpdated =
    typeof params.updatedAt === 'number'
      ? new Date(params.updatedAt).toISOString()
      : params.updatedAt || new Date().toISOString();
  return {
    id: params.id,
    title: leafTitle,
    path: params.filePath,
    content: params.content,
    projectId: params.projectId || params.spaceId || params.id,
    ...(params.spaceId ? { spaceId: params.spaceId } : {}),
    ...(params.rev !== undefined ? { rev: params.rev } : {}),
    ...(params.hash !== undefined ? { hash: params.hash } : {}),
    updatedAt: isoUpdated,
  } as Page;
}

/**
 * Resolves a document strictly along the Local-First hierarchy:
 * 1. RAM (`lruDocumentCache`, ~0 ms, 0 IDB, 0 HTTP)
 * 2. OfflineDB (`IndexedDB`: `unsynced_edits` + `(hash, rev)`-validated `synced_doc_cache`, ~1-2 ms, 0 HTTP)
 * 3. Server (`GET /docs/:id`, ONLY on true cache miss or `(hash, rev)` mismatch)
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

  const manifest = lruDocumentCache.getManifestEntry(pageId);

  // Tier 1: Hot RAM LRU Cache
  const ramModel = lruDocumentCache.getModel(pageId);
  if (ramModel && ramModel.isAuthoritative !== false) {
    const hashMismatch = Boolean(
      manifest?.hash && ramModel.hash && manifest.hash !== ramModel.hash,
    );
    const revNewer = Boolean(
      manifest?.rev !== undefined &&
      ramModel.serverRev !== undefined &&
      manifest.rev > ramModel.serverRev,
    );
    if (ramModel.isDirty || !manifest || (!hashMismatch && !revNewer)) {
      return buildPageFromSnapshotData({
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
  }

  // Tier 2: OfflineDB (IndexedDB)
  const [unsyncedEdit, syncedDoc] = await Promise.all([
    unsyncedEditsStore.get(pageId).catch(() => null),
    syncedDocCacheStore.get(pageId).catch(() => null),
  ]);
  const isOnline = useConnectivityStore.getState().checkIsOnline();

  if (
    unsyncedEdit &&
    typeof unsyncedEdit.content === 'string' &&
    (!syncedDoc || unsyncedEdit.savedAt >= syncedDoc.updatedAt)
  ) {
    const hasManifestConflict =
      isOnline &&
      manifest?.rev !== undefined &&
      unsyncedEdit.expectedRev !== undefined &&
      manifest.rev > unsyncedEdit.expectedRev;

    if (hasManifestConflict) {
      try {
        const serverPage = await pagesService.docs.getById(pageId);
        const remoteText = extractDocumentContentString(serverPage?.content ?? '');
        const resolvedRev = serverPage?.rev ?? manifest.rev;
        const resolvedHash = serverPage?.hash ?? manifest.hash ?? null;
        const resolvedProjectId =
          extractProjectId(serverPage?.projectId) || unsyncedEdit.projectId || syncedDoc?.projectId;
        const filePath =
          options?.fallbackPath ||
          serverPage?.path ||
          serverPage?.title ||
          syncedDoc?.filePath ||
          unsyncedEdit.title ||
          'main.tex';

        lruDocumentCache.registerModel(pageId, {
          content: unsyncedEdit.content,
          filePath,
          projectId: resolvedProjectId,
          spaceId: serverPage?.spaceId,
          serverRev: resolvedRev,
          hash: resolvedHash,
          isAuthoritative: true,
        });
        lruDocumentCache.markDirty(pageId);

        if (remoteText !== unsyncedEdit.content) {
          sessionCoordinator.recordOfflineEditConflict(pageId, unsyncedEdit.content, remoteText, {
            projectId: resolvedProjectId,
            currentRev: resolvedRev,
          });
        }

        return buildPageFromSnapshotData({
          id: pageId,
          content: unsyncedEdit.content,
          filePath,
          title: serverPage?.title || unsyncedEdit.title,
          projectId: resolvedProjectId,
          spaceId: serverPage?.spaceId,
          rev: resolvedRev,
          hash: resolvedHash,
        });
      } catch {
        // Network check failed; still restore recoverable local edit below
      }
    }

    const filePath =
      options?.fallbackPath ||
      syncedDoc?.filePath ||
      syncedDoc?.title ||
      unsyncedEdit.title ||
      'main.tex';
    const projectId = unsyncedEdit.projectId || syncedDoc?.projectId;
    const resolvedRev = unsyncedEdit.expectedRev ?? syncedDoc?.rev ?? manifest?.rev;
    const resolvedHash = syncedDoc?.hash ?? manifest?.hash ?? null;

    lruDocumentCache.registerModel(pageId, {
      content: unsyncedEdit.content,
      filePath,
      projectId,
      serverRev: resolvedRev,
      hash: resolvedHash,
      isAuthoritative: true,
    });
    lruDocumentCache.markDirty(pageId);

    return buildPageFromSnapshotData({
      id: pageId,
      content: unsyncedEdit.content,
      filePath,
      title: unsyncedEdit.title || syncedDoc?.title,
      projectId,
      rev: resolvedRev,
      hash: resolvedHash,
    });
  }

  if (
    syncedDoc &&
    typeof syncedDoc.content === 'string' &&
    (!isOnline || lruDocumentCache.isSyncedCacheFreshAgainstManifest(pageId, syncedDoc))
  ) {
    const filePath = options?.fallbackPath || syncedDoc.filePath || syncedDoc.title || 'main.tex';
    const resolvedRev = syncedDoc.rev ?? manifest?.rev;
    const resolvedHash = syncedDoc.hash ?? manifest?.hash ?? null;

    lruDocumentCache.registerModel(pageId, {
      content: syncedDoc.content,
      filePath,
      projectId: syncedDoc.projectId,
      serverRev: resolvedRev,
      hash: resolvedHash,
      isAuthoritative: true,
    });

    return buildPageFromSnapshotData({
      id: pageId,
      content: syncedDoc.content,
      filePath,
      title: syncedDoc.title,
      projectId: syncedDoc.projectId,
      rev: resolvedRev,
      hash: resolvedHash,
      updatedAt: syncedDoc.updatedAt,
    });
  }

  // Tier 3: Server Authoritative Fetch
  try {
    const page = await pagesService.docs.getById(pageId);
    if (page?.id) {
      const textContent = extractDocumentContentString(page.content);
      const resolvedProjectId =
        extractProjectId(page.projectId) || page.spaceId || page.id;
      const filePath = page.path || page.title || options?.fallbackPath || 'main.tex';
      const resolvedHash = page.hash ?? manifest?.hash ?? null;
      const resolvedRev = page.rev ?? manifest?.rev;

      if (!lruDocumentCache.isDirty(page.id)) {
        lruDocumentCache.registerModel(page.id, {
          content: textContent,
          filePath,
          projectId: resolvedProjectId,
          ...(page.spaceId ? { spaceId: page.spaceId } : {}),
          ...(typeof resolvedRev === 'number' ? { serverRev: resolvedRev } : {}),
          ...(resolvedHash !== undefined ? { hash: resolvedHash } : {}),
          ...(page.updatedAt ? { serverUpdatedAt: page.updatedAt } : {}),
          isAuthoritative: true,
        });
        if (typeof page.content === 'string' || textContent.length > 0) {
          void syncedDocCacheStore.put({
            id: page.id,
            projectId: resolvedProjectId,
            title: page.title || 'main.tex',
            content: textContent,
            filePath,
            ...(typeof resolvedRev === 'number' ? { rev: resolvedRev } : {}),
            ...(resolvedHash !== undefined ? { hash: resolvedHash } : {}),
            updatedAt: Date.now(),
          });
        }
      }
    }
    return page;
  } catch (err) {
    if (unsyncedEdit || syncedDoc) {
      const useUnsynced = Boolean(
        unsyncedEdit && (!syncedDoc || unsyncedEdit.savedAt >= syncedDoc.updatedAt),
      );
      const content = useUnsynced ? unsyncedEdit!.content : syncedDoc!.content;
      const filePath =
        options?.fallbackPath ||
        syncedDoc?.filePath ||
        syncedDoc?.title ||
        unsyncedEdit?.title ||
        'main.tex';
      const projectId = syncedDoc?.projectId || unsyncedEdit?.projectId;
      const resolvedRev = (useUnsynced ? unsyncedEdit?.expectedRev : syncedDoc?.rev) ?? manifest?.rev;
      const resolvedHash = syncedDoc?.hash ?? manifest?.hash ?? null;

      lruDocumentCache.registerModel(pageId, {
        content,
        filePath,
        projectId,
        serverRev: resolvedRev,
        hash: resolvedHash,
        isAuthoritative: true,
      });
      if (useUnsynced) {
        lruDocumentCache.markDirty(pageId);
      }

      return buildPageFromSnapshotData({
        id: pageId,
        content,
        filePath,
        title: syncedDoc?.title || unsyncedEdit?.title,
        projectId,
        rev: resolvedRev,
        hash: resolvedHash,
      });
    }
    throw err;
  }
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
      const files = await pagesService.docs.getFiles(pageId);
      if (files.length > 0) return files;

      const isOffline =
        !useConnectivityStore.getState().isOnline ||
        (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (isOffline) {
        const offlineFiles = await fetchOfflinePageFilesFallback(pageId);
        if (offlineFiles.length > 0) {
          return offlineFiles;
        }
      }
      return files;
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
