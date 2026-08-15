import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Page, PageFile } from "../types/document.types";

export const PageDocumentService = {
  getById: async (pageId: string) => {
    const res = await apiGet<{ page: Page }>(`/api/pages/${pageId}`);
    return res.page;
  },

  updateContent: async (pageId: string, content: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { content });
    return res.page;
  },

  updateThumbnail: async (pageId: string, dataUrl: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}/thumbnail`, { dataUrl });
    return res.page;
  },

  deletePage: (pageId: string) =>
    apiDelete<void>(`/api/pages/${pageId}`),

  updateTitle: async (pageId: string, title: string, oldTitle?: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { title, _oldTitle: oldTitle });
    return res.page;
  },
};

export const PageFileService = {
  getByPageId: async (pageId: string) => {
    const res = await apiGet<{ files: PageFile[] }>(`/api/pages/${pageId}/files`);
    return res.files;
  },

  create: async ({ parentPageId, title, content }: { parentPageId: string; title: string; content?: string }) => {
    const res = await apiPost<{ page: PageFile }>(`/api/pages/${parentPageId}/files`, { title, content });
    return res.page;
  },

  setMain: async ({ pageId, fileId }: { pageId: string; fileId: string }) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}/main-file`, { fileId });
    return res.page;
  },
};
