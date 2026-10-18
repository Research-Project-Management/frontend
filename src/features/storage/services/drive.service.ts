/**
 * @file drive.service.ts
 * @description Frontend service mirroring backend DriveController.
 * Handles directory listing, folder creation, moving, renaming, starring, and breadcrumb path resolution.
 */

import { apiGet, apiPost, apiPut, apiDelete, getAuthToken } from '@/shared/lib/api';
import { API_BASE_URL } from '@/config/env';
import { resolveFileUrl, downloadFileUrl } from '@/shared/lib/file-client';
import type {
  StorageItem,
  StorageResponse,
  CreateFolderParams,
} from '@/features/storage/types/storage.types';

export interface FileQueryParams {
  parentId?: string | null;
  search?: string;
  sortBy?: string;
  types?: string[] | string;
  type?: string;
  limit?: number;
  page?: number;
}

export function buildQueryString(params?: FileQueryParams | string | null): string {
  if (!params) return '';
  if (typeof params === 'string') {
    return params && params !== 'null' && params !== 'root'
      ? `?parentId=${encodeURIComponent(params)}`
      : '';
  }

  const searchParams = new URLSearchParams();

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
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
): FileQueryParams | string | null | undefined {
  if (typeof scopeIdOrParams === 'object') return scopeIdOrParams;
  if (params !== undefined) return params;
  return scopeIdOrParams;
}

// ── Read Operations ──────────────────────────────────────────────────────────

export const getAllFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/v1/storage/files/my-files${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getHomeFiles = getAllFiles;
export const getMyFiles = getAllFiles;

export const getStarredFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/v1/storage/files/starred${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getSharedFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/v1/storage/files/shared${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getPageFiles = (
  pageId: string,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/v1/storage/files/pages/${pageId}${buildQueryString(params)}`);
};

export const getFileById = (id: string) => {
  return apiGet<StorageItem>(`/api/v1/storage/files/${id}`);
};

export interface FolderPathResponse {
  path: Array<{ id: string; name: string }>;
}

export const getFolderPath = (folderId: string): Promise<FolderPathResponse> => {
  return apiGet<FolderPathResponse | Array<{ id: string; name: string }>>(`/api/v1/storage/files/folder-path?folderId=${encodeURIComponent(folderId)}`).then((res) => {
    if (Array.isArray(res)) {
      return { path: res };
    }
    return res?.path ? res : { path: [] };
  });
};

// ── Mutation Operations ──────────────────────────────────────────────────────

export const createFolder = (name: string, params: CreateFolderParams = {}) => {
  return apiPost(`/api/v1/storage/files/folder`, {
    name,
    parentId: params.parentId ?? null,
    ...(params.pageId ? { pageId: params.pageId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
  });
};

export const moveItem = (itemId: string, parentId: string | null) => {
  return apiPut(`/api/v1/storage/files/${itemId}/move`, { parentId });
};

export const batchMoveItems = (ids: string[], parentId: string | null) => {
  return apiPost(`/api/v1/storage/files/batch/move`, { ids, parentId });
};

export const renameItem = (itemId: string, name: string) => {
  return apiPut(`/api/v1/storage/files/${itemId}/rename`, { name });
};

export const toggleStarItem = (itemId: string) => {
  return apiPut(`/api/v1/storage/files/${itemId}/star`);
};

export const deleteItem = (itemId: string) => {
  return apiDelete(`/api/v1/storage/files/${itemId}`);
};

export const batchDeleteItems = (ids: string[]) => {
  return apiPost(`/api/v1/storage/files/batch/delete`, { ids });
};

export const batchStarItems = (ids: string[], starred: boolean) => {
  return apiPost(`/api/v1/storage/files/batch/star`, { ids, starred });
};

export const checkDuplicateFile = (
  scopeId?: string,
  filename?: string,
  parentId: string | null = null,
) => {
  return getAllFiles(scopeId, parentId).then((data: StorageResponse & { items?: StorageItem[] }) => {
    const files: StorageItem[] = data?.files || data?.items || [];
    const existingFile = files.find(
      (item) => !item.isFolder && item.filename === filename,
    );

    return {
      exists: !!existingFile,
      existingFile: existingFile
        ? { id: existingFile.id, filename: existingFile.filename }
        : null,
    };
  });
};

export const shareItem = (itemId: string, userId: string, permission: 'view' | 'edit') => {
  return apiPut(`/api/v1/storage/files/${itemId}/share`, { userId, permission });
};

export const updateFileMetadata = (itemId: string, metaData: Record<string, unknown>) => {
  return apiPut(`/api/v1/storage/files/${itemId}`, { metaData });
};

// ── Trash Operations ─────────────────────────────────────────────────────────

export const getTrashedFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/v1/storage/files/trash${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const moveToTrash = (itemId: string) => {
  return apiPost(`/api/v1/storage/files/${itemId}/trash`);
};

export const restoreItem = (itemId: string) => {
  return apiPut(`/api/v1/storage/files/${itemId}/restore`);
};

export const permanentlyDeleteItem = (itemId: string) => {
  return apiDelete(`/api/v1/storage/files/${itemId}/permanent`);
};

export const batchRestoreItems = (ids: string[]) => {
  return apiPost(`/api/v1/storage/files/batch/restore`, { ids });
};

export const batchPermanentlyDeleteItems = (ids: string[]) => {
  return apiPost(`/api/v1/storage/files/batch/permanent`, { ids });
};

// ── Quota Operations ─────────────────────────────────────────────────────────

export interface StorageUsageResult {
  usedBytes: number;
  maxBytes: number;
  percentage: number;
  totalBytes: number;
}

export interface StorageQuotaResponse {
  scope?: 'user' | 'project';
  projectId?: string;
  projectIdentifier?: string;
  projectName?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  totalBytes: number;
  usedBytes: number;
  projectBytes?: number;
  limitBytes?: number;
  maxBytes?: number;
  usedFormatted?: string;
  projectFormatted?: string;
  limitFormatted?: string;
  percentage: number;
  note?: string;
}

export const getStorageUsage = (scopeId?: string, projectId?: string) => {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiGet<StorageUsageResult>(`/api/v1/storage/files/usage${query}`);
};

export const getStorageQuota = (
  scopeOrOptions?: { projectId?: string } | string,
  projectIdParam?: string,
): Promise<StorageQuotaResponse> => {
  const projectId =
    typeof scopeOrOptions === 'object'
      ? scopeOrOptions?.projectId
      : projectIdParam || (typeof scopeOrOptions === 'string' ? scopeOrOptions : undefined);

  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  return apiGet<StorageQuotaResponse>(`/api/v1/storage/files/usage${query}`);
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
  return apiGet<FileVersionsResponse>(`/api/v1/storage/files/${encodeURIComponent(fileId)}/versions`);
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

    xhr.open('POST', `${API_BASE_URL}/api/v1/storage/files/${encodeURIComponent(fileId)}/versions`);
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.send(formData);
  });
};

export const revertFileVersion = (fileId: string, versionNumber: number): Promise<unknown> => {
  return apiPost(`/api/v1/storage/files/${encodeURIComponent(fileId)}/versions/${versionNumber}/revert`, {});
};

export const getVersionDownloadUrl = (fileId: string, versionNumber: number): string => {
  return `${API_BASE_URL}/api/v1/storage/files/${encodeURIComponent(fileId)}/versions/${versionNumber}/download`;
};

// ── Stream & Preview Operations ──────────────────────────────────────────────

export const resolveStreamUrl = (fileIdOrPath: string | null | undefined): string | null => {
  if (!fileIdOrPath) return null;
  if (fileIdOrPath.startsWith('http://') || fileIdOrPath.startsWith('https://')) {
    return fileIdOrPath;
  }
  if (!fileIdOrPath.includes('/') && !fileIdOrPath.includes('.')) {
    return resolveFileUrl(`/api/v1/storage/files/${encodeURIComponent(fileIdOrPath)}/content`);
  }
  return resolveFileUrl(fileIdOrPath);
};

export const fetchAuthorized = async (
  url: string,
  errorTypeOrInit: string | RequestInit = 'content',
  init?: RequestInit,
): Promise<Response> => {
  const token = getAuthToken();
  const requestInit = typeof errorTypeOrInit === 'object' ? errorTypeOrInit : init;
  const errorType = typeof errorTypeOrInit === 'string' ? errorTypeOrInit : 'content';
  const headers: Record<string, string> = {
    ...(requestInit?.headers as Record<string, string> | undefined),
  };
  if (token && !url.startsWith('blob:') && !url.startsWith('data:')) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...requestInit, credentials: 'include', headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch file ${errorType}: ${response.statusText}`);
  }
  return response;
};

export const getFileArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const res = await fetchAuthorized(url, 'buffer');
  return res.arrayBuffer();
};

export const getFileBlob = async (url: string): Promise<Blob> => {
  const res = await fetchAuthorized(url, 'blob');
  return res.blob();
};

export const downloadFile = (url: string, filename: string): void => {
  downloadFileUrl(url, filename);
};

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
      const arrayBuffer = await getFileArrayBuffer(url);
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
      console.warn('Failed to generate PDF preview:', error);
      return null;
    }
  },
};

