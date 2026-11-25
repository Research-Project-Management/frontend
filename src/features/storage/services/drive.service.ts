/**
 * @file drive.service.ts
 * @description Frontend service for /api/v1/experiments/files endpoints.
 * Handles directory listing, folder creation, moving, renaming, starring, and breadcrumb path resolution.
 */

import { apiGet, apiPost, apiPut, apiDelete, getAuthToken } from '@/shared/lib/api';
import { logger } from '@/shared/lib/logger';
import { API_BASE_URL } from '@/config/env';
import { fetchAuthorized } from '@/shared/lib/file-client';
import type {
  StorageResponse,
  CreateFolderParams,
} from '@/features/storage/types/storage.types';

export interface FileQueryParams {
  spaceId?: string | null;
  parentId?: string | null;
  search?: string;
  sortBy?: string;
  types?: string[] | string;
  type?: string;
  limit?: number;
  page?: number;
}

export function buildQueryString(params?: FileQueryParams): string {
  if (!params) return '';

  const searchParams = new URLSearchParams();
  const effectiveSpaceId = params.spaceId;

  if (
    effectiveSpaceId &&
    effectiveSpaceId !== 'null' &&
    effectiveSpaceId !== 'personal'
  ) {
    searchParams.set('spaceId', effectiveSpaceId);
  }
  if (params.parentId && params.parentId !== 'null' && params.parentId !== 'root') {
    searchParams.set('parentId', params.parentId);
  }
  if (params.search && params.search.trim()) {
    searchParams.set('search', params.search.trim());
  }
  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }
  if (params.types) {
    const typesStr = Array.isArray(params.types) ? params.types.join(',') : params.types;
    if (typesStr) searchParams.set('types', typesStr);
  }
  if (params.type && params.type !== 'all') {
    searchParams.set('type', params.type);
  }
  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export function resolveQueryParams(
  spaceIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
): FileQueryParams | undefined {
  if (typeof spaceIdOrParams === 'object' && spaceIdOrParams !== null) {
    return spaceIdOrParams;
  }
  const spaceId =
    typeof spaceIdOrParams === 'string' && spaceIdOrParams && spaceIdOrParams !== 'null'
      ? spaceIdOrParams
      : undefined;

  if (params !== undefined) {
    if (typeof params === 'string' || params === null) {
      return {
        ...(spaceId ? { spaceId } : {}),
        ...(params ? { parentId: params } : {}),
      };
    }
    return spaceId ? { spaceId, ...params } : params;
  }

  return spaceId ? { spaceId } : undefined;
}

// ── Read Operations ──────────────────────────────────────────────────────────

export const getAllFiles = (
  spaceIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(
    `/api/v1/experiments/files/my-files${buildQueryString(resolveQueryParams(spaceIdOrParams, params))}`,
  );
};

export const getStarredFiles = (
  spaceIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(
    `/api/v1/experiments/files/starred${buildQueryString(resolveQueryParams(spaceIdOrParams, params))}`,
  );
};

export const getSharedFiles = (
  spaceIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(
    `/api/v1/experiments/files/shared${buildQueryString(resolveQueryParams(spaceIdOrParams, params))}`,
  );
};

export interface FolderPathResponse {
  path: Array<{ id: string; name: string }>;
}

export const getFolderPath = (folderId: string): Promise<FolderPathResponse> => {
  return apiGet<FolderPathResponse>(
    `/api/v1/experiments/files/folder-path?folderId=${encodeURIComponent(folderId)}`,
  ).then((res) => (res?.path ? res : { path: [] }));
};

// ── Mutation Operations ──────────────────────────────────────────────────────

export const createFolder = (name: string, params: CreateFolderParams = {}) => {
  return apiPost('/api/v1/experiments/files/folder', {
    name,
    parentId: params.parentId ?? null,
    ...(params.spaceId ? { spaceId: params.spaceId } : {}),
  });
};

export const moveItem = (itemId: string, parentId: string | null) => {
  return apiPut(`/api/v1/experiments/files/${itemId}/move`, { parentId });
};

export const batchMoveItems = (ids: string[], parentId: string | null) => {
  return apiPost('/api/v1/experiments/files/batch/move', { ids, parentId });
};

export const renameItem = (itemId: string, name: string) => {
  return apiPut(`/api/v1/experiments/files/${itemId}/rename`, { name });
};

export const toggleStarItem = (itemId: string) => {
  return apiPut(`/api/v1/experiments/files/${itemId}/star`);
};

export const deleteItem = (itemId: string) => {
  return apiDelete(`/api/v1/experiments/files/${itemId}`);
};

export const batchDeleteItems = (ids: string[]) => {
  return apiPost('/api/v1/experiments/files/batch/delete', { ids });
};

export const batchStarItems = (ids: string[], starred: boolean) => {
  return apiPost('/api/v1/experiments/files/batch/star', { ids, starred });
};

export const updateFileMetadata = (itemId: string, metaData: Record<string, unknown>) => {
  return apiPut(`/api/v1/experiments/files/${itemId}`, { metaData });
};

// ── Trash Operations ─────────────────────────────────────────────────────────

export const getTrashedFiles = (
  spaceIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(
    `/api/v1/experiments/files/trash${buildQueryString(resolveQueryParams(spaceIdOrParams, params))}`,
  );
};

export const restoreItem = (itemId: string) => {
  return apiPut(`/api/v1/experiments/files/${itemId}/restore`);
};

export const permanentlyDeleteItem = (itemId: string) => {
  return apiDelete(`/api/v1/experiments/files/${itemId}/permanent`);
};

export const batchRestoreItems = (ids: string[]) => {
  return apiPost('/api/v1/experiments/files/batch/restore', { ids });
};

export const batchPermanentlyDeleteItems = (ids: string[]) => {
  return apiPost('/api/v1/experiments/files/batch/permanent', { ids });
};

// ── Version Operations ───────────────────────────────────────────────────────

export interface FileVersionItem {
  id: string;
  versionNumber: number;
  size: number;
  changeComment: string | null;
  createdAt: string;
  isCurrent: boolean;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  } | null;
}

export interface FileVersionsResponse {
  fileId: string;
  filename: string;
  currentVersionNumber: number;
  totalVersions: number;
  versions: FileVersionItem[];
}

export const getFileVersions = (fileId: string): Promise<FileVersionsResponse> => {
  return apiGet<FileVersionsResponse>(`/api/v1/experiments/files/${encodeURIComponent(fileId)}/versions`);
};

export const uploadNewFileVersion = (
  fileId: string,
  file: File,
  changeComment?: string,
  onProgress?: (progress: number) => void,
): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    if (changeComment) {
      formData.append('changeComment', changeComment);
    }

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch {
          resolve({});
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as { message?: string };
          reject(new Error(err?.message || 'Failed to upload new version'));
        } catch {
          reject(new Error(`Upload failed: HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Connection error while uploading new version'));

    xhr.open('POST', `${API_BASE_URL}/api/v1/experiments/files/${encodeURIComponent(fileId)}/versions`);
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
};

export const revertFileVersion = (fileId: string, versionNumber: number): Promise<unknown> => {
  return apiPost(`/api/v1/experiments/files/${encodeURIComponent(fileId)}/versions/${versionNumber}/revert`, {});
};

export const getVersionDownloadUrl = (fileId: string, versionNumber: number): string => {
  return `${API_BASE_URL}/api/v1/experiments/files/${encodeURIComponent(fileId)}/versions/${versionNumber}/download`;
};

// ── Preview Operations ───────────────────────────────────────────────────────

interface PdfJsModule {
  GlobalWorkerOptions?: { workerSrc: string };
  getDocument: (params: { data: Uint8Array }) => {
    promise: Promise<{
      getPage: (pageNum: number) => Promise<{
        getViewport: (params: { scale: number }) => { width: number; height: number };
        render: (params: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      }>;
    }>;
  };
}

async function getPdfjs(): Promise<PdfJsModule | null> {
  if (typeof window === 'undefined') return null;
  try {
    const pdfModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjs = ('default' in pdfModule ? pdfModule.default : pdfModule) as unknown as PdfJsModule;
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    return pdfjs;
  } catch {
    try {
      const { pdfjs } = await import('react-pdf');
      if (pdfjs?.GlobalWorkerOptions) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
      return pdfjs as unknown as PdfJsModule;
    } catch {
      return null;
    }
  }
}

export const previewServices = {
  async generatePreview(url: string): Promise<string | null> {
    try {
      const response = await fetchAuthorized(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file buffer: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const pdfjsLib = await getPdfjs();
      if (!pdfjsLib) return null;

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
      }).promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 1 });
      const targetWidth = 280;
      const scale = targetWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise;

      return canvas.toDataURL('image/png');
    } catch (error) {
      logger.warn('[driveService] Failed to generate PDF preview', { error });
      return null;
    }
  },
};
