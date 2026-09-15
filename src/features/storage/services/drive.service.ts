/**
 * @file drive.service.ts
 * @description Frontend service mirroring backend DriveController.
 * Handles directory listing, folder creation, moving, renaming, starring, and breadcrumb path resolution.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
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
  if (typeof params === 'string' || params === null) {
    return `?parentId=${params === null ? 'null' : params}`;
  }

  const searchParams = new URLSearchParams();

  if (params.parentId !== undefined) {
    searchParams.set('parentId', params.parentId === null ? 'null' : params.parentId);
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
  return apiGet<StorageResponse>(`/api/files/my-files${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getHomeFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/files/my-files${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getMyFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/files/my-files${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getStarredFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/files/starred${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getSharedFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/files/shared${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const getPageFiles = (
  pageId: string,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/files/page/${pageId}${buildQueryString(params)}`);
};

export const getFileById = (id: string) => {
  return apiGet<StorageItem>(`/api/files/${id}`);
};

export interface FolderPathResponse {
  path: Array<{ id: string; name: string }>;
}

export const getFolderPath = (folderId: string): Promise<FolderPathResponse> => {
  return apiGet<any>(`/api/files/folder-path?folderId=${encodeURIComponent(folderId)}`).then((res) => {
    if (Array.isArray(res)) {
      return { path: res };
    }
    return res?.path ? res : { path: [] };
  });
};

// ── Mutation Operations ──────────────────────────────────────────────────────

export const createFolder = (name: string, params: CreateFolderParams = {}) => {
  return apiPost(`/api/files/folder`, {
    name,
    parentId: params.parentId ?? null,
    ...(params.pageId ? { pageId: params.pageId } : {}),
    ...(params.projectId ? { projectId: params.projectId } : {}),
  });
};

export const moveItem = (itemId: string, parentId: string | null) => {
  return apiPut(`/api/files/${itemId}/move`, { parentId });
};

export const renameItem = (itemId: string, name: string) => {
  return apiPut(`/api/files/${itemId}/rename`, { name });
};

export const toggleStarItem = (itemId: string) => {
  return apiPut(`/api/files/${itemId}/star`);
};

export const deleteItem = (itemId: string) => {
  return apiDelete(`/api/files/${itemId}`);
};

export const batchDeleteItems = (ids: string[]) => {
  return apiPost(`/api/files/batch/delete`, { ids });
};

export const batchStarItems = (ids: string[], starred: boolean) => {
  return apiPost(`/api/files/batch/star`, { ids, starred });
};

export const checkDuplicateFile = (
  scopeId?: string,
  filename?: string,
  parentId: string | null = null,
) => {
  return getAllFiles(scopeId, parentId).then((data: any) => {
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
  return apiPut(`/api/files/${itemId}/share`, { userId, permission });
};

export const updateFileMetadata = (itemId: string, metaData: Record<string, any>) => {
  return apiPut(`/api/files/${itemId}`, { metaData });
};
