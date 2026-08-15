import { apiGet, apiPost } from '@/shared/lib/api';
import type { Page, CreatePageInput, CreatePageResponse } from '../types/page.types';

export const PageService = {
  getWorkspacePages: async (workspaceId: string, status?: string, search?: string) => {
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search) params.search = search;
    const res = await apiGet<{ pages: Page[] }>(`/api/workspace/${workspaceId}/pages`, { params });
    return res.pages;
  },

  create: async (input: CreatePageInput) => {
    const res = await apiPost<{ page: Page; mainFile?: { _id: string; [key: string]: unknown } | string | null }>(
      `/api/project/${input.projectId}/pages`,
      { title: input.title, content: input.content, status: input.status },
    );
    const mainFile = res.mainFile || null;
    const mainFileId = typeof mainFile === 'object' && mainFile !== null && '_id' in mainFile
      ? (mainFile._id as string)
      : typeof mainFile === 'string'
        ? mainFile
        : null;

    return {
      page: res.page,
      mainFile,
      rootPageId: res.page._id,
      mainFileId,
    } satisfies CreatePageResponse;
  },
};