/**
 * storage.service.ts
 *
 * Frontend service mirroring Backend `modules/storage/`:
 *  - S3 / R2 Asset uploads (`/api/files/upload-r2`, `/api/files/page/:pageId/upload`)
 *  - Storage file & folder hierarchy (`/api/files/page/:pageId`, `/api/files/project/:projectId/folder`)
 *  - Item management (rename, move, delete)
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import { API_BASE_URL } from '@/shared/constants';

export interface EditorStorageItem {
  _id: string;
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
    const endpoint = parentId
      ? `/api/files/page/${pageId}?parentId=${parentId}`
      : `/api/files/page/${pageId}`;
    const data = await apiGet<{ files: EditorStorageItem[] }>(endpoint);
    return data.files || [];
  },

  uploadToR2: async (pageId: string, formData: FormData): Promise<{ url: string; path: string }> => {
    formData.append('pageId', pageId);
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || localStorage.getItem('accessToken')
        : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/api/files/upload-r2`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers,
    });
    if (!response.ok) throw new Error('Upload to R2 proxy failed');
    return response.json();
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
    return apiPost(`/api/files/page/${pageId}/folder`, {
      name,
      parentId: parentId ?? null,
    });
  },

  createProjectFolder: async (projectId: string, name: string, parentId?: string | null) => {
    return apiPost(`/api/files/project/${projectId}/folder`, {
      name,
      parentId: parentId ?? null,
    });
  },

  renameItem: async (itemId: string, name: string) => {
    return apiPut(`/api/files/${itemId}/rename`, { name });
  },

  permanentlyDeleteItem: async (itemId: string) => {
    return apiDelete(`/api/files/${itemId}`);
  },

  moveItem: async (itemId: string, targetFolderId: string | null) => {
    return apiPut(`/api/files/${itemId}/move`, { targetFolderId });
  },
};

export const EditorStorageService = StorageService;
