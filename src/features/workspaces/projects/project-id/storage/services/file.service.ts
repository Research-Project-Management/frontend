/**
 * @file file.service.ts
 * @description Handles API requests for workspace storage operations including listing files/folders, creating folders, uploading files, and mutating storage items (rename, move, delete).
 */

import { apiGet, apiPost, apiPut, apiDelete, getAuthToken } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import { generateThumbnail } from '@/shared/utils/file';
import type { StorageItem, StorageResponse, UploadFileParams, CreateFileRecordParams, CreateFolderParams } from '@/features/workspaces/projects/project-id/storage/types/storage.types';

export interface FileQueryParams {
  parentId?: string | null;
  search?: string;
  sortBy?: string;
  types?: string[] | string;
  type?: string;
  projectIds?: string[] | string;
  projectId?: string;
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
  if (params.projectIds) {
    const projStr = Array.isArray(params.projectIds) ? params.projectIds.join(',') : params.projectIds;
    if (projStr) searchParams.set('projectIds', projStr);
  }
  if (params.projectId && params.projectId !== 'all') {
    searchParams.set('projectId', params.projectId);
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

// ── Read Operations (Project-level) ──────────────────────────────────────────

export const getAllFiles = (projectId: string, params?: FileQueryParams | string | null) => {
  return apiGet<StorageResponse>(`/api/files/project/${projectId}${buildQueryString(params)}`);
};

export const getMyFiles = (projectId: string, params?: FileQueryParams) =>
  apiGet<StorageResponse>(`/api/files/project/${projectId}/my-files${buildQueryString(params)}`);

export const getStarredFiles = (projectId: string, params?: FileQueryParams) =>
  apiGet<StorageResponse>(`/api/files/project/${projectId}/starred${buildQueryString(params)}`);

export const getSharedFiles = (projectId: string, params?: FileQueryParams) =>
  apiGet<StorageResponse>(`/api/files/project/${projectId}/shared${buildQueryString(params)}`);

export const getTrashedFiles = (projectId: string, params?: FileQueryParams) =>
  apiGet<StorageResponse>(`/api/files/project/${projectId}/trash${buildQueryString(params)}`);

const uploadBlobWithProgress = (
    blob: Blob,
    fileName: string,
    uploadEndpoint: string,
    onProgress?: (progress: number) => void
): Promise<{ url: string }> => {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append("file", blob);
        formData.append("fileName", fileName);

        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;
        
        if (onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onProgress(percentComplete);
                }
            };
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText) as Record<string, any>;
                    const payload = response.data || response;
                    const url = payload.url || payload.file?.url || payload.path || '';
                    resolve({ url });
                } catch {
                    reject(new Error("Failed to parse upload response"));
                }
            } else {
                reject(new Error(`Failed to upload file. Status: ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));

        const targetUploadUrl =
            typeof window !== 'undefined'
                ? uploadEndpoint
                : `${API_BASE_URL}${uploadEndpoint}`;
        xhr.open("POST", targetUploadUrl, true);
        const token = getAuthToken();

        if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }
        xhr.send(formData);
    });
};

export const uploadFile = async (
    file: File,
    params: UploadFileParams
) => {
    const storagePrefix = `project/${params.projectId}`;
    const timestamp = Date.now();
    const fileName = `${storagePrefix}/${timestamp}-${file.name}`;
    
    const onMainFileProgress = params.onProgress 
        ? (p: number) => params.onProgress!(Math.round(p * 0.9))
        : undefined;

    const uploadEndpoint = `/api/files/upload-r2`;
    const { url: uploadPath } = await uploadBlobWithProgress(file, fileName, uploadEndpoint, onMainFileProgress);
    const uploadUrl = uploadPath.startsWith("http") ? uploadPath : `${API_BASE_URL}${uploadPath.startsWith('/') ? '' : '/'}${uploadPath}`;

    let thumbnailUrl;
    if (file.type.startsWith("image/")) {
        const thumbnailBlob = await generateThumbnail(file);
        if (thumbnailBlob) {
            const thumbName = `project/${params.projectId}/${Date.now()}-thumb.jpg`;
            const { url: thumbPath } = await uploadBlobWithProgress(thumbnailBlob, thumbName, uploadEndpoint);
            thumbnailUrl = thumbPath.startsWith("http") ? thumbPath : `${API_BASE_URL}${thumbPath.startsWith('/') ? '' : '/'}${thumbPath}`;
        }
    }

    await createFileRecord({
        projectId: params.projectId,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url: uploadUrl,
        thumbnail: thumbnailUrl,
        parentId: params.parentId || null,
        metaData: params.metaData,
    });

    if (params.onProgress) params.onProgress(100);
};

export const uploadGenericFile = async (file: File, projectId: string): Promise<string> => {
    const fileName = `avatars/${projectId}-${Date.now()}`;
    const { url: uploadPath } = await uploadBlobWithProgress(file, fileName, "/api/files/upload-r2");
    return uploadPath.startsWith("http") ? uploadPath : `${API_BASE_URL}${uploadPath.startsWith('/') ? '' : '/'}${uploadPath}`;
};

export const createFileRecord = (params: CreateFileRecordParams) => {
    return apiPost(`/api/files/project/${params.projectId}/upload`, {
        filename: params.filename,
        size: params.size,
        mimeType: params.mimeType,
        url: params.url,
        thumbnail: params.thumbnail,
        parentId: params.parentId ?? null,
        metaData: params.metaData,
    });
};

export const createFolder = (name: string, params: CreateFolderParams) => {
    return apiPost(`/api/files/project/${params.projectId}/folder`, {
        name,
        parentId: params.parentId ?? null,
        ...(params.pageId ? { pageId: params.pageId } : {}),
    });
};

export const checkDuplicateFile = (
    projectId: string,
    filename: string,
    parentId: string | null = null,
) => {
    if (!projectId) {
        throw new Error("projectId is required for workspace storage actions");
    }

    return getAllFiles(projectId, parentId).then((data: any) => {
        const files: StorageItem[] = data?.files || [];
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

export const toggleStarItem = (itemId: string) =>
    apiPut(`/api/files/${itemId}/star`);

export const deleteItem = (itemId: string) =>
    apiDelete(`/api/files/${itemId}`);

export const restoreItem = (itemId: string) =>
    apiPut(`/api/files/${itemId}/restore`);

export const permanentlyDeleteItem = (itemId: string) =>
    apiDelete(`/api/files/${itemId}/permanent`);

export const shareItem = (itemId: string, userId: string, permission: "view" | "edit") =>
    apiPut(`/api/files/${itemId}/share`, { userId, permission });

export const renameItem = (itemId: string, name: string) =>
    apiPut(`/api/files/${itemId}/rename`, { name });

export const moveItem = (itemId: string, parentId: string | null) =>
    apiPut(`/api/files/${itemId}/move`, { parentId });

export const updateFileMetadata = (itemId: string, metaData: Record<string, any>) =>
    apiPut(`/api/files/${itemId}`, { metaData });

export const getFileArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
        throw new Error("Failed to fetch file buffer: " + response.statusText);
    }
    return response.arrayBuffer();
};

export const getFileBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
        throw new Error("Failed to fetch file blob: " + response.statusText);
    }
    return response.blob();
};

export const getFolderPath = (folderId: string) =>
    apiGet<{ path: { id: string; name: string }[] }>(`/api/files/folder/${folderId}/path`);

