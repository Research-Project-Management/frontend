/**
 * storage.service.ts
 *
 * Frontend service mirroring Backend `modules/storage/`:
 *  - S3 / R2 Asset uploads (`/api/files/upload-r2`, `/api/files/page/:pageId/upload`)
 *  - Storage file & folder hierarchy (`/api/files/page/:pageId`, `/api/files/project/:projectId/folder`)
 *  - Item management (rename, move, delete)
 */

import { apiGet, apiPost, apiPut, apiPatch, apiDelete, getAuthToken } from "@/shared/lib/api";
import { API_BASE_URL } from '@/config/env';
import { presignUpload, completePresigned } from '@/features/storage/services/upload.service';
import { MANUSCRIPTS_API_BASE } from './manuscript.service';

export interface EditorStorageItem {
  id: string;
  filename: string;
  size?: number;
  mimeType?: string;
  isFolder: boolean;
  parentId?: string | null;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export const StorageService = {
  getPageFiles: async (pageId: string, parentId?: string | null): Promise<EditorStorageItem[]> => {
    try {
      const endpoint = parentId
        ? `${MANUSCRIPTS_API_BASE}/projects/${pageId}/structure/nodes?parentId=${parentId}`
        : `${MANUSCRIPTS_API_BASE}/projects/${pageId}/structure/nodes`;
      const nodes = await apiGet<any[]>(endpoint);
      if (Array.isArray(nodes)) {
        return nodes.map((n) => ({
          id: n.id,
          filename: n.name,
          isFolder: n.type === 'FOLDER',
          parentId: n.parentId,
          size: n.sizeBytes,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }));
      }
    } catch {
      // Fallback to legacy endpoint if project not found
    }
    const legacyEndpoint = parentId
      ? `/api/files/page/${pageId}?parentId=${parentId}`
      : `/api/files/page/${pageId}`;
    try {
      const data = await apiGet<{ files: EditorStorageItem[] }>(legacyEndpoint);
      return data.files || [];
    } catch {
      return [];
    }
  },

  uploadPageFile: async (
    pageId: string,
    file: File,
    parentId?: string | null,
    onProgress?: (progress: number) => void,
  ): Promise<EditorStorageItem> => {
    // ── 1. Attempt Direct-to-R2 Presigned Upload (Bypasses backend network/memory) ──
    try {
      const presignRes = await presignUpload({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        projectId: pageId,
      });

      const uploadUrl = presignRes?.uploadUrl || presignRes?.signedUrl;
      if (uploadUrl && presignRes?.storageKey) {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          if (onProgress) {
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100));
              }
            };
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Direct R2 upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('Direct R2 upload network error'));
          xhr.open('PUT', uploadUrl, true);
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });

        const completed = await completePresigned({
          storageKey: presignRes.storageKey,
          filename: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          projectId: pageId,
          parentId: parentId || null,
        });

        return {
          id: completed.fileId || completed.id,
          filename: completed.filename || file.name,
          size: typeof completed.size === 'number' ? completed.size : file.size,
          mimeType: completed.mimeType || file.type,
          isFolder: false,
          parentId: parentId || null,
          url: completed.url || `/api/files/${completed.fileId || completed.id}/content`,
        };
      }
    } catch (directErr) {
      console.warn(
        '[StorageService] Direct R2 presigned upload failed or unsupported, falling back to backend upload proxy:',
        directErr,
      );
    }

    // ── 2. Fallback to backend upload proxy (legacy) ──
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) {
      formData.append('parentId', parentId);
    }
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/files/page/${pageId}/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Upload failed (${response.status}): ${errText}`);
    }
    const json = (await response.json()) as any;
    const payload = json.data || json;
    const fileObj = payload.file || payload;
    return {
      id: fileObj.id || payload.id || payload.fileId,
      filename: fileObj.filename || file.name,
      size: typeof fileObj.size === 'number' ? fileObj.size : file.size,
      mimeType: fileObj.mimeType || file.type,
      isFolder: false,
      parentId: parentId || null,
      url: fileObj.url || `/api/files/${payload.fileId || fileObj.id}/content`,
    };
  },

  uploadToR2: async (pageId: string, formData: FormData): Promise<{ url: string; path: string }> => {
    formData.append('pageId', pageId);
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/files/upload-r2`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });
    if (!response.ok) throw new Error('Upload to R2 proxy failed');
    const json = (await response.json()) as any;
    const payload = json.data || json;
    const url = payload.url || payload.file?.url || payload.path || '';
    const path = payload.path || payload.url || url;
    return { url, path };
  },

  createFileRecord: async (
    pageId: string,
    params: {
      filename: string;
      size: number;
      mimeType: string;
      url: string;
      parentId?: string | null;
      fileBase64?: string;
    },
  ) => {
    return apiPost(`/api/files/page/${pageId}/upload`, params);
  },

  createPageFolder: async (pageId: string, name: string, parentId?: string | null) => {
    try {
      return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${pageId}/structure/nodes`, {
        name,
        type: 'FOLDER',
        parentId: parentId ?? null,
      });
    } catch {
      return apiPost(`/api/files/page/${pageId}/folder`, {
        name,
        parentId: parentId ?? null,
      });
    }
  },

  createProjectFolder: async (projectId: string, name: string, parentId?: string | null) => {
    try {
      return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, {
        name,
        type: 'FOLDER',
        parentId: parentId ?? null,
      });
    } catch {
      return apiPost(`/api/files/project/${projectId}/folder`, {
        name,
        parentId: parentId ?? null,
      });
    }
  },

  renameItem: async (itemId: string, name: string, projectId?: string) => {
    if (projectId) {
      try {
        return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}/rename`, { name });
      } catch {}
    }
    return apiPut(`/api/files/${itemId}/rename`, { name });
  },

  permanentlyDeleteItem: async (itemId: string, projectId?: string) => {
    if (projectId) {
      try {
        return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}`);
      } catch {}
    }
    return apiDelete(`/api/files/${itemId}`);
  },

  moveItem: async (itemId: string, targetFolderId: string | null, projectId?: string) => {
    if (projectId) {
      try {
        return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}/move`, {
          destParentId: targetFolderId,
        });
      } catch {}
    }
    return apiPut(`/api/files/${itemId}/move`, { parentId: targetFolderId });
  },
};

export const EditorStorageService = StorageService;
