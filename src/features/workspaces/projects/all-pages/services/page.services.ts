import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Page } from "../schemas/page.schemas";

export const PageService = {
  getWorkspacePages: async (workspaceId: string, status?: string, search?: string) => {
    const params: Record<string, string> = {};
    if (status && status !== "all") params.status = status;
    if (search) params.search = search;
    const res = await apiGet<{ pages: Page[] }>(`/api/workspace/${workspaceId}/pages`, { params });
    return res.pages;
  },

  getProjectPages: async (projectId: string, status?: string, search?: string) => {
    const params: Record<string, string> = {};
    if (status && status !== "all") params.status = status;
    if (search) params.search = search;
    const res = await apiGet<{ pages: Page[] }>(`/api/project/${projectId}/pages`, { params });
    return res.pages;
  },

  getById: async (pageId: string) => {
    const res = await apiGet<{ page: Page }>(`/api/pages/${pageId}`);
    return res.page;
  },

  create: async ({ projectId, title, content, status }: { projectId: string; title: string; content?: string; status?: string }) => {
    const res = await apiPost<{ page: Page; mainFile?: any }>(`/api/project/${projectId}/pages`, { title, content, status });
    return {
      page: res.page,
      mainFile: res.mainFile || null,
      rootPageId: res.page._id as string,
      mainFileId: (res.mainFile?._id ?? null) as string | null,
    };
  },

  delete: (pageId: string) =>
    apiDelete<void>(`/api/pages/${pageId}`),

  updateTitle: async (pageId: string, title: string, oldTitle?: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { title, _oldTitle: oldTitle });
    return res.page;
  },
};