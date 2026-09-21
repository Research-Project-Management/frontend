import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Page, CreatePageInput, CreatePageResponse } from '../types/page.types';

export const PageService = {
  getProjectPages: async (projectId: string, status?: string, search?: string) => {
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search) params.search = search;
    const res = await apiGet<{ pages: Page[] }>(`/api/projects/${projectId}/pages`, { params });
    return res.pages;
  },

  create: async (input: CreatePageInput) => {
    const res = await apiPost<{ page: Page; mainFile?: { id: string; [key: string]: unknown } | string | null }>(
      `/api/projects/${input.projectId}/pages`,
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

  updateTitle: async (pageId: string, title: string, _oldTitle?: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { title });
    return res.page;
  },
};

export const getPageLabels = (projectId: string, pageId: string) =>
  apiGet<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `/api/projects/${projectId}/pages/${pageId}/labels`
  );

export const assignPageLabels = (projectId: string, pageId: string, labelIds: string[]) =>
  apiPost<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `/api/projects/${projectId}/pages/${pageId}/labels`,
    { labelIds }
  );

export const replacePageLabels = (projectId: string, pageId: string, labelIds: string[]) =>
  apiPut<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `/api/projects/${projectId}/pages/${pageId}/labels`,
    { labelIds }
  );

export const removePageLabel = (projectId: string, pageId: string, labelId: string) =>
  apiDelete<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `/api/projects/${projectId}/pages/${pageId}/labels/${labelId}`
  );
