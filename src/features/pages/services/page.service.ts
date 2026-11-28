import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/shared/lib/api';
import { PAGES_API_BASE } from '@/features/editor/sdk/pages/base';
import type {
  Page,
  PageStatus,
  CreatePageInput,
  CreatePageResponse,
} from '../types/page.types';

export const PageService = {
  list: async (
    spaceId: string,
    status?: string,
    search?: string,
  ): Promise<Page[]> => {
    const targetScope = !spaceId ? 'personal' : spaceId;
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search && search.trim()) params.search = search.trim();
    const res = await apiGet<{ pages: Page[]; total?: number; isEmpty?: boolean }>(
      `${PAGES_API_BASE}/spaces/${targetScope}/docs`,
      { params },
    );
    return res?.pages ?? [];
  },

  create: async (input: CreatePageInput) => {
    const res = await apiPost<{
      page: Page;
      mainFile?: { id: string; [key: string]: unknown } | string | null;
    }>(`${PAGES_API_BASE}/spaces/${input.spaceId}/docs`, {
      title: input.title,
      content: input.content,
      status: input.status,
      labelIds: input.labelIds,
      templateType: input.templateType,
    });
    const mainFile = res.mainFile || null;
    const mainFileId =
      typeof mainFile === 'object' && mainFile !== null
        ? mainFile.id || null
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

  delete: (pageId: string) => apiDelete<void>(`${PAGES_API_BASE}/docs/${pageId}`),

  getTrash: async (spaceId: string): Promise<Page[]> => {
    const targetScope = !spaceId ? 'personal' : spaceId;
    const res = await apiGet<{ pages: Page[]; total?: number }>(
      `${PAGES_API_BASE}/spaces/${targetScope}/trash`,
    );
    return res?.pages ?? [];
  },

  restore: (pageId: string) =>
    apiPost<{ success: boolean; page?: Page }>(`${PAGES_API_BASE}/docs/${pageId}/restore`, {}),

  purge: (pageId: string) =>
    apiDelete<{ success: boolean; purgedPageId: string }>(
      `${PAGES_API_BASE}/docs/${pageId}/permanent`,
    ),

  duplicate: async (pageId: string) => {
    const res = await apiPost<{
      page: Page;
      mainFile?: { id: string; [key: string]: unknown } | string | null;
      rootPageId?: string;
      mainFileId?: string | null;
    }>(`${PAGES_API_BASE}/docs/${pageId}/duplicate`, {});
    return res;
  },

  update: async (
    pageId: string,
    data: {
      title?: string;
      status?: PageStatus;
      description?: string;
    },
  ) => {
    const res = await apiPatch<{ page: Page }>(`${PAGES_API_BASE}/docs/${pageId}/metadata`, data);
    return res.page;
  },

  updateTitle: async (pageId: string, title: string) => {
    return PageService.update(pageId, { title });
  },
};

export const getPageLabels = (spaceId: string, pageId: string) =>
  apiGet<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `${PAGES_API_BASE}/spaces/${spaceId}/docs/${pageId}/labels`
  );

export const assignPageLabels = (spaceId: string, pageId: string, labelIds: string[]) =>
  apiPost<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `${PAGES_API_BASE}/spaces/${spaceId}/docs/${pageId}/labels`,
    { labelIds }
  );

export const replacePageLabels = (spaceId: string, pageId: string, labelIds: string[]) =>
  apiPut<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `${PAGES_API_BASE}/spaces/${spaceId}/docs/${pageId}/labels`,
    { labelIds }
  );

export const removePageLabel = (spaceId: string, pageId: string, labelId: string) =>
  apiDelete<{ labels: Array<{ id: string; name: string; color: string }> }>(
    `${PAGES_API_BASE}/spaces/${spaceId}/docs/${pageId}/labels/${labelId}`
  );
