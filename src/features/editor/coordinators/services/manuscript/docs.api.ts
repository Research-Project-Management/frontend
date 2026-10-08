/**
 * docs.api.ts
 *
 * Document and file management sub-API: CRUD, title, thumbnails, incremental sync, docstore.
 */

import { apiGet, apiPut, apiPost, apiPatch, apiDelete, getAuthToken } from '@/shared/lib/api';
import type { Page, PageFile } from '@/features/editor/domain/types';
import { MANUSCRIPTS_API_BASE, getManuscriptsBaseUrl } from './base';
import type { DocstoreDocDto } from './types';

export const docs = {
  getById: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiGet<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`);
    if (!res || !res.page) {
      throw new Error(`Document ${docId} not found`);
    }
    return res.page;
  },

  updateContent: async (docId: string, content: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`, { content });
    return res.page;
  },

  updateThumbnail: async (docId: string, dataUrl: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/thumbnail`,
      { pdfThumbnail: dataUrl },
      { silent: true },
    );
    return res.page;
  },

  updateTitle: async (docId: string, title: string, _oldTitle?: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`, { title });
    return res.page;
  },

  create: async ({
    projectId,
    title,
    content,
    status = 'draft',
  }: {
    projectId: string;
    title: string;
    content?: string;
    status?: string;
  }): Promise<Page> => {
    const res = await apiPost<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs`, {
      title,
      content,
      status,
    });
    return res.page;
  },

  delete: async (docId: string): Promise<void> => {
    if (!docId) return;
    await apiDelete(`${MANUSCRIPTS_API_BASE}/docs/${docId}`);
  },

  restore: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPost<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/restore`, {});
    return res.page;
  },

  duplicate: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPost<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/duplicate`, {});
    return res.page;
  },

  getFiles: async (docId: string): Promise<PageFile[]> => {
    try {
      const res = await apiGet<{ files: PageFile[] }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/files`);
      return res.files || [];
    } catch {
      return [];
    }
  },

  syncIncremental: async (
    rootDocId: string,
    dirtyFileIds: string[],
    forceAll?: boolean,
  ): Promise<{ synced: string[] }> => {
    return await apiPost<{ synced: string[] }>(`${MANUSCRIPTS_API_BASE}/docs/${rootDocId}/sync-incremental`, {
      dirtyFileIds,
      forceAll,
    });
  },

  getProjectDocs: async (projectId: string, status?: string, search?: string): Promise<Page[]> => {
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search) params.search = search;
    try {
      const res = await apiGet<{ pages: Page[] }>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs`, { params });
      return res.pages || [];
    } catch {
      return [];
    }
  },

  getAllDocs: async (projectId: string): Promise<DocstoreDocDto[]> => {
    try {
      return await apiGet<DocstoreDocDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc`);
    } catch {
      return [];
    }
  },

  getAllDeletedDocs: async (projectId: string): Promise<DocstoreDocDto[]> => {
    try {
      return await apiGet<DocstoreDocDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc-deleted`);
    } catch {
      return [];
    }
  },

  getAllRanges: async (projectId: string): Promise<any> => {
    try {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/ranges`);
    } catch {
      return {};
    }
  },

  getDoc: async (projectId: string, docId: string, includeDeleted = false): Promise<DocstoreDocDto | null> => {
    try {
      return await apiGet<DocstoreDocDto>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}?include_deleted=${includeDeleted}`,
      );
    } catch {
      return null;
    }
  },

  getRawDoc: async (projectId: string, docId: string): Promise<string> => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${getManuscriptsBaseUrl()}/projects/${projectId}/docs/doc/${docId}/raw`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!res.ok) return '';
      return await res.text();
    } catch {
      return '';
    }
  },

  updateDocLines: async (
    projectId: string,
    docId: string,
    lines: string[],
    rev?: number,
  ): Promise<{ modified: boolean; rev: number }> => {
    return await apiPost<{ modified: boolean; rev: number }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}`,
      { lines, rev },
    );
  },

  patchDoc: async (
    projectId: string,
    docId: string,
    dto: { path?: string; deleted?: boolean },
  ): Promise<any> => {
    return await apiPatch<any>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}`, dto);
  },

  archiveDoc: async (projectId: string, docId: string): Promise<void> => {
    await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}/archive`, {});
  },

  archiveAllDocs: async (projectId: string): Promise<void> => {
    await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/archive`, {});
  },

  unarchiveAllDocs: async (projectId: string): Promise<{ unarchived: number }> => {
    return await apiPost<{ unarchived: number }>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/unarchive`, {});
  },
};
