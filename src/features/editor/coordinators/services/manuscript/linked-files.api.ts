/**
 * linked-files.api.ts
 *
 * Linked external files sub-API: URL imports, Zotero, Mendeley, Dropbox, GitHub syncing.
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type { LinkedFileDto, CreateLinkedFilePayload } from './types';

export const linkedFiles = {
  list: async (projectId: string): Promise<LinkedFileDto[]> => {
    return await apiGet<LinkedFileDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files`);
  },

  create: async (projectId: string, payload: CreateLinkedFilePayload): Promise<LinkedFileDto> => {
    const body = {
      ...payload,
      provider: payload.provider || (payload.providerType ? payload.providerType.toLowerCase() : 'url'),
    };
    return await apiPost<LinkedFileDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files`, body);
  },

  refresh: async (projectId: string, fileId: string): Promise<LinkedFileDto> => {
    return await apiPost<LinkedFileDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files/${fileId}/refresh`, {});
  },

  delete: async (projectId: string, fileId: string, deleteNode = false): Promise<void> => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files/${fileId}?deleteNode=${deleteNode}`);
  },

  refreshAll: async (projectId?: string): Promise<{ refreshedCount: number }> => {
    return await apiPost<{ refreshedCount: number }>(`${MANUSCRIPTS_API_BASE}/linked-files/refresh-all`, { projectId });
  },
};
