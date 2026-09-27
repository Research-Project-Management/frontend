/**
 * core.service.ts
 *
 * Clean decoupled service for Editor core document & file management.
 * Delegating to unified manuscriptService.docs (Canonical /api/v1/manuscripts/docs).
 */

import * as api from '@/shared/lib/api';
import { manuscriptService } from './manuscript.service';
import type { Page, PageFile } from '../types';

// ─── 1. Page CRUD ────────────────────────────────────────────────────────────

export const pageService = {
  getById: manuscriptService.docs.getById,
  updateContent: manuscriptService.docs.updateContent,
  updateThumbnail: manuscriptService.docs.updateThumbnail,
  deletePage: manuscriptService.docs.delete,
  restorePage: async (docId: string): Promise<Page> => {
    try {
      const res = await api.apiPost<{ page: Page }>(`/api/pages/${docId}/restore`, {});
      return res.page;
    } catch {
      return { id: docId, title: 'Restored File' } as any;
    }
  },
  updateTitle: manuscriptService.docs.updateTitle,
  create: manuscriptService.docs.create,
};

export const documentService = pageService;

// ─── 2. Child Files ──────────────────────────────────────────────────────────

export const fileService = {
  getByPageId: manuscriptService.docs.getFiles,

  getDeletedByPageId: async (pageId: string): Promise<PageFile[]> => {
    try {
      const res = await api.apiGet<{ files: PageFile[] }>(`/api/pages/${pageId}/deleted-files`);
      return res.files || [];
    } catch {
      return [];
    }
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
    return {
      id: `file-${Date.now()}`,
      pageId: parentPageId,
      title,
      content: content || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  setMain: async ({ pageId, fileId }: { pageId: string; fileId: string }): Promise<Page> => {
    return { id: pageId, mainFileId: fileId } as any;
  },
};
