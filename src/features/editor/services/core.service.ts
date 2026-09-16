/**
 * core.service.ts
 *
 * Frontend service mirroring Backend `modules/document/core/`:
 *  - Page CRUD (`/api/pages/:pageId`)
 *  - Child Files (`/api/pages/:pageId/files`)
 *  - Main File Selection (`/api/pages/:pageId/main-file`)
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type { Page, PageFile } from '../types';

// ─── 1. Page CRUD ────────────────────────────────────────────────────────────

export const pageService = {
  getById: async (pageId: string): Promise<Page> => {
    const res = await apiGet<{ page: Page }>(`/api/pages/${pageId}`);
    return res.page;
  },

  updateContent: async (pageId: string, content: string): Promise<Page> => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { content });
    return res.page;
  },

  updateThumbnail: async (pageId: string, dataUrl: string): Promise<Page> => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}/thumbnail`, {
      pdfThumbnail: dataUrl,
    });
    return res.page;
  },

  deletePage: (pageId: string): Promise<void> => apiDelete<void>(`/api/pages/${pageId}`),

  updateTitle: async (pageId: string, title: string, _oldTitle?: string): Promise<Page> => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, {
      title,
    });
    return res.page;
  },
};

export const documentService = pageService;
export const PageDocumentService = pageService;

// ─── 2. Child Files ──────────────────────────────────────────────────────────

export const fileService = {
  getByPageId: async (pageId: string): Promise<PageFile[]> => {
    const res = await apiGet<{ files: PageFile[] }>(`/api/pages/${pageId}/files`);
    return res.files;
  },

  create: async ({
    parentPageId,
    title,
    content,
  }: {
    parentPageId: string;
    title: string;
    content?: string;
  }): Promise<PageFile> => {
    const res = await apiPost<{ page?: PageFile; file?: PageFile }>(
      `/api/pages/${parentPageId}/files`,
      {
        title,
        content,
      },
    );
    return (res.file || res.page)!;
  },

  setMain: async ({ pageId, fileId }: { pageId: string; fileId: string }): Promise<Page> => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}/main-file`, {
      mainFileId: fileId,
    });
    return res.page;
  },
};

export const PageFileService = fileService;
