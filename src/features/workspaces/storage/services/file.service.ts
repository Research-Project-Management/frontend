/**
 * @file file.service.ts
 * @description Handles API requests for workspace storage operations including listing files/folders, creating folders, uploading files, and mutating storage items (rename, move, delete).
 */

import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import { generateThumbnail } from '@/shared/utils/file';
import type { StorageItem, StorageResponse, UploadFileParams, CreateFileRecordParams, CreateFolderParams } from '@/features/workspaces/storage/types/storage.types';

// ── Read Operations (Workspace-level) ────────────────────────────────────────

export const getAllFiles = (workspaceId: string, parentId?: string | null) => {
    let url = `/api/files/workspace/${workspaceId}`;
    if (parentId !== undefined) {
      url += `?parentId=${parentId === null ? 'null' : parentId}`;
    }
    return apiGet<StorageResponse>(url);
};

export const getMyFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/my-files`);

export const getStarredFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/starred`);

export const getSharedFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/shared`);

export const getTrashedFiles = (workspaceId: string) =>
    apiGet<StorageResponse>(`/api/files/workspace/${workspaceId}/trash`);

const uploadBlobWithPresigned = async (
    blob: Blob,
    fileName: string,
    onProgress?: (progress: number) => void
): Promise<{ url: string; path: string }> => {
    try {
        const presignRes = await apiPost<{ signedUrl: string; path: string; url: string }>("/api/files/presign", {
            filename: fileName,
            mimeType: blob.type || "application/octet-stream",
        });

        if (presignRes?.signedUrl) {
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
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
                        resolve();
                    } else {
                        reject(new Error(`Direct upload failed: ${xhr.status}`));
                    }
                };
                xhr.onerror = () => reject(new Error("Direct upload network error"));
                xhr.open("PUT", presignRes.signedUrl, true);
                xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
                xhr.send(blob);
            });

            return { url: presignRes.url, path: presignRes.path };
        }
    } catch {
        // Fallback to proxy
    }

    return uploadBlobWithProgress(blob, fileName, onProgress);
};

const uploadBlobWithProgress = (
    blob: Blob,
    fileName: string,
    onProgress?: (progress: number) => void
): Promise<{ url: string; path: string }> => {
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
                    resolve({ url: response.url, path: response.path || response.url });
                } catch {
                    reject(new Error("Failed to parse upload response"));
                }
            } else {
                reject(new Error(`Failed to upload file. Status: ${xhr.status}`));
            }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));

        xhr.open("POST", `${API_BASE_URL}/api/files/upload-r2`, true);
        xhr.send(formData);
    });
};

export const uploadFile = async (
    file: File,
    params: UploadFileParams
) => {
    const storagePrefix = `workspace/${params.workspaceId}`;
    const timestamp = Date.now();
    const fileName = `${storagePrefix}/${timestamp}-${file.name}`;
    
    const onMainFileProgress = params.onProgress 
        ? (p: number) => params.onProgress!(Math.round(p * 0.9))
        : undefined;

    const { url: uploadPath } = await uploadBlobWithPresigned(file, fileName, onMainFileProgress);
    const uploadUrl = uploadPath.startsWith("http") ? uploadPath : `${API_BASE_URL}${uploadPath}`;

    let thumbnailUrl;
    if (file.type.startsWith("image/")) {
        const thumbnailBlob = await generateThumbnail(file);
        if (thumbnailBlob) {
            const thumbName = `workspace/${params.workspaceId}/${Date.now()}-thumb.jpg`;
            const { url: thumbPath } = await uploadBlobWithPresigned(thumbnailBlob, thumbName);
            thumbnailUrl = thumbPath.startsWith("http") ? thumbPath : `${API_BASE_URL}${thumbPath}`;
        }
    }

    await createFileRecord({
        workspaceId: params.workspaceId,
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

export const uploadGenericFile = async (file: File, workspaceId: string): Promise<string> => {
    const fileName = `avatars/${workspaceId}-${Date.now()}`;
    const { url: uploadPath } = await uploadBlobWithPresigned(file, fileName);
    return uploadPath.startsWith("http") ? uploadPath : `${API_BASE_URL}${uploadPath}`;
};

export const createFileRecord = (params: CreateFileRecordParams) => {
    return apiPost(`/api/files/workspace/${params.workspaceId}/upload`, {
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
    return apiPost(`/api/files/workspace/${params.workspaceId}/folder`, {
        name,
        parentId: params.parentId ?? null,
        ...(params.pageId ? { pageId: params.pageId } : {}),
    });
};

export const checkDuplicateFile = (
    workspaceId: string,
    filename: string,
    parentId: string | null = null,
) => {
    if (!workspaceId) {
        throw new Error("workspaceId is required for workspace storage actions");
    }

    return getAllFiles(workspaceId, parentId).then((data: any) => {
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
    apiPut(`/api/files/${itemId}/metadata`, { metaData });

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
