/**
 * filestore.client.ts
 *
 * Filestore binary assets & linked files sub-API: stream URLs, multipart uploads,
 * signed URLs, deletion, and cross-project/URL linked files.
 */

import {
  apiGet,
  apiPost,
  apiDelete,
  rawFetch,
} from '@/shared/lib/api';
import {
  PAGES_API_BASE,
  getPagesBaseUrl,
  resolveFilestoreCollectionRoute,
} from './base';
import { structure } from './structure.client';
import { normalizeVirtualPath, parseVirtualFolderId } from '@/features/editor/domain/document/document-naming';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import type { FileMetadataDto, ImportFromProjectPayload } from './types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';

export type { FileMetadataDto, ImportFromProjectPayload };

function getStoreContext(): { spaceId?: string; rootPageId?: string } {
  const pageState = typeof usePageStore?.getState === 'function' ? usePageStore.getState() : undefined;
  return {
    spaceId: pageState?.spaceId,
    rootPageId: pageState?.rootPageId || pageState?.parentPageId || undefined,
  };
}

export const filestore = {
  getStreamUrl: (projectIdOrPageId: string, fileId: string, pageId?: string): string => {
    const { basePath, pageQuery } = resolveFilestoreCollectionRoute(
      PAGES_API_BASE,
      projectIdOrPageId,
      pageId,
      getStoreContext(),
    );
    return `${basePath}/${encodeURIComponent(fileId)}${pageQuery ? `?${pageQuery}` : ''}`;
  },

  upload: async (
    projectIdOrPageId: string,
    file: File | Blob,
    filename?: string,
    pageId?: string,
  ): Promise<FileMetadataDto> => {
    const name = filename || (file instanceof File ? file.name : 'unnamed.bin');
    const formData = new FormData();
    formData.append('file', file, name);
    const { basePath, pageQuery } = resolveFilestoreCollectionRoute(
      getPagesBaseUrl(),
      projectIdOrPageId,
      pageId,
      getStoreContext(),
    );
    const res = await rawFetch(
      `${basePath}?name=${encodeURIComponent(name)}${pageQuery ? `&${pageQuery}` : ''}`,
      'POST',
      formData,
    );
    if (!res.ok) {
      let message = res.statusText || `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as {
          message?: string;
          error?: { message?: string };
        };
        message = errBody?.error?.message || errBody?.message || message;
      } catch {
        // Non-JSON response fallback
      }
      throw new Error(`File upload failed: ${message}`);
    }
    return (await res.json()) as FileMetadataDto;
  },

  getSignedUrl: async (
    projectIdOrPageId: string,
    fileId: string,
    expiresIn = 3600,
    pageId?: string,
  ): Promise<{ signedUrl: string | null }> => {
    try {
      const { basePath } = resolveFilestoreCollectionRoute(
        PAGES_API_BASE,
        projectIdOrPageId,
        pageId,
        getStoreContext(),
      );
      return await apiGet<{ signedUrl: string | null }>(
        `${basePath}/${encodeURIComponent(fileId)}/signed-url?expiresIn=${expiresIn}`,
      );
    } catch {
      return { signedUrl: null };
    }
  },

  delete: async (projectIdOrPageId: string, fileId: string, pageId?: string): Promise<void> => {
    const { basePath } = resolveFilestoreCollectionRoute(
      PAGES_API_BASE,
      projectIdOrPageId,
      pageId,
      getStoreContext(),
    );
    return await apiDelete(`${basePath}/${encodeURIComponent(fileId)}`);
  },

  importFromProject: async (
    projectIdOrPageId: string,
    payload: ImportFromProjectPayload,
  ): Promise<{ file: Record<string, unknown> }> => {
    return await apiPost<{ file: Record<string, unknown> }>(
      `${PAGES_API_BASE}/spaces/${projectIdOrPageId}/files/import-from-project`,
      payload,
    );
  },

  uploadPageFile: async (
    pageId: string,
    file: File,
    parentId?: string | null,
    onProgress?: (progress: number) => void,
    projectId?: string,
  ): Promise<EditorStorageItem> => {
    const targetPageId = pageId || projectId || '';
    const storeSpaceId =
      typeof usePageStore?.getState === 'function' ? usePageStore.getState().spaceId?.trim() : '';
    const resolvedSpaceId = projectId?.trim() || storeSpaceId || '';
    let effectiveName = file.name;
    if (parentId && !file.name.includes('/')) {
      const virtualFolder = parseVirtualFolderId(parentId);
      if (virtualFolder) {
        effectiveName = `${virtualFolder}/${file.name}`;
      } else if (targetPageId) {
        const folderNode = await structure.getNodeById(targetPageId, parentId).catch(() => null);
        const folderPath = normalizeVirtualPath(folderNode?.path || folderNode?.name || '');
        if (folderPath) {
          effectiveName = `${folderPath}/${file.name}`;
        }
      }
    }
    const uploaded = await filestore.upload(
      resolvedSpaceId || targetPageId,
      file,
      effectiveName,
      pageId || undefined,
    );
    onProgress?.(100);
    const id = uploaded.id || '';
    const filename = uploaded.name || uploaded.filename || effectiveName;
    const normalizedPath = normalizeVirtualPath(uploaded.path || filename) || filename;
    const itemSpaceId = uploaded.spaceId ?? resolvedSpaceId ?? uploaded.projectId ?? null;
    const itemPageId = uploaded.pageId ?? pageId ?? projectId ?? null;
    return {
      id,
      nodeId: uploaded.nodeId ?? id,
      spaceId: itemSpaceId,
      pageId: itemPageId,
      projectId: uploaded.projectId ?? resolvedSpaceId ?? pageId ?? null,
      filename,
      path: normalizedPath,
      size: uploaded.sizeBytes ?? file.size,
      mimeType: uploaded.mimeType || file.type,
      isFolder: false,
      nodeType: 'FILE',
      docId: uploaded.docId ?? null,
      fileId: uploaded.fileId ?? id,
      isRootDoc: false,
      parentId: parentId || null,
      url: filestore.getStreamUrl(
        itemSpaceId || targetPageId,
        id,
        itemPageId || undefined,
      ),
    };
  },
};

export interface LinkedFileDto {
  id: string;
  name: string;
  provider: string;
  sourceProjectId?: string;
  sourceFileId?: string;
  sourceUrl?: string;
  lastSyncedAt?: string;
  [key: string]: unknown;
}

export interface CreateLinkedFilePayload {
  name: string;
  provider: string;
  sourceProjectId?: string;
  sourceFileId?: string;
  sourceUrl?: string;
  [key: string]: unknown;
}

export const linkedFiles = {
  list: async (projectId: string): Promise<LinkedFileDto[]> => {
    const res = await apiGet<LinkedFileDto[] | { linkedFiles?: LinkedFileDto[] }>(
      `${PAGES_API_BASE}/spaces/${projectId}/linked-files`,
    );
    return Array.isArray(res) ? res : res?.linkedFiles || [];
  },

  create: async (projectId: string, payload: CreateLinkedFilePayload): Promise<LinkedFileDto> => {
    return apiPost<LinkedFileDto>(
      `${PAGES_API_BASE}/spaces/${projectId}/linked-files`,
      payload,
    );
  },

  refresh: async (projectId: string, linkId: string): Promise<LinkedFileDto> => {
    return apiPost<LinkedFileDto>(
      `${PAGES_API_BASE}/spaces/${projectId}/linked-files/${linkId}/refresh`,
      {},
    );
  },

  refreshAll: async (projectId: string): Promise<{ refreshedCount: number; [key: string]: unknown }> => {
    return apiPost<{ refreshedCount: number; [key: string]: unknown }>(
      `${PAGES_API_BASE}/spaces/${projectId}/linked-files/refresh-all`,
      {},
    );
  },

  delete: async (projectId: string, linkId: string): Promise<void> => {
    await apiDelete<void>(
      `${PAGES_API_BASE}/spaces/${projectId}/linked-files/${linkId}`,
    );
  },
};
