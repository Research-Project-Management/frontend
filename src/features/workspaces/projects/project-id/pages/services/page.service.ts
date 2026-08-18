import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type { Page, CreatePageInput, CreatePageResponse } from '../types/page.types';

export const PageService = {
  getProjectPages: async (projectId: string, status?: string, search?: string) => {
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search) params.search = search;
    const res = await apiGet<{ pages: Page[] }>(`/api/project/${projectId}/pages`, { params });
    return res.pages;
  },

  create: async (input: CreatePageInput) => {
    const res = await apiPost<{ page: Page; mainFile?: { id: string; [key: string]: unknown } | string | null }>(
      `/api/project/${input.projectId}/pages`,
      { title: input.title, content: input.content, status: input.status },
    );
    const mainFile = res.mainFile || null;
    const mainFileId = typeof mainFile === 'object' && mainFile !== null
      ? (mainFile.id || null)
      : typeof mainFile === 'string'
        ? mainFile
        : null;

    return {
      page: res.page,
      mainFile,
      rootPageId: res.page.id || '',
      mainFileId,
    } satisfies CreatePageResponse;
  },

  delete: (pageId: string) => apiDelete<void>(`/api/pages/${pageId}`),

  updateTitle: async (pageId: string, title: string, oldTitle?: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { title, _oldTitle: oldTitle });
    return res.page;
  },
};
