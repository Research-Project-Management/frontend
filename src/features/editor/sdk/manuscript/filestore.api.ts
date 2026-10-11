/**
 * filestore.api.ts
 *
 * Filestore binary assets sub-API: Stream URLs, multipart uploads, signed URLs, deletion.
 */

import { apiGet, apiDelete, getAuthToken } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type { FileMetadataDto } from './types';

export const filestore = {
  getStreamUrl: (projectId: string, fileId: string): string => {
    return `${MANUSCRIPTS_API_BASE}/projects/${projectId}/files/${fileId}`;
  },

  upload: async (projectId: string, file: File | Blob, filename?: string): Promise<FileMetadataDto> => {
    const name = filename || (file instanceof File ? file.name : 'unnamed.bin');
    const formData = new FormData();
    formData.append('file', file, name);
    const token = getAuthToken();
    const res = await fetch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/files?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`File upload failed: ${res.statusText}`);
    return (await res.json()) as FileMetadataDto;
  },

  getSignedUrl: async (projectId: string, fileId: string, expiresIn = 3600): Promise<{ signedUrl: string | null }> => {
    try {
      return await apiGet<{ signedUrl: string | null }>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/files/${fileId}/signed-url?expiresIn=${expiresIn}`,
      );
    } catch {
      return { signedUrl: null };
    }
  },

  delete: async (projectId: string, fileId: string): Promise<void> => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/files/${fileId}`);
  },
};
