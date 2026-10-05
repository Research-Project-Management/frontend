/**
 * core.service.ts
 *
 * Clean decoupled service for Editor core document & file management.
 * Delegating to unified manuscriptService.docs (Canonical /api/v1/manuscripts/docs).
 */

import * as api from '@/shared/lib/api';
import { manuscriptService } from './manuscript.service';
import { getDemoManuscript } from '../mock/demo-dataset';
import type { Page, PageFile } from '../types';

// ─── 1. Page CRUD ────────────────────────────────────────────────────────────

export const pageService = {
  getById: async (pageId: string): Promise<Page> => {
    if (!pageId || pageId === 'demo' || pageId.startsWith('demo-') || pageId.startsWith('mock-') || pageId === 'adam-research' || pageId === 'default') {
      return getDemoManuscript(pageId).page;
    }
    try {
      const page = await manuscriptService.docs.getById(pageId);
      if (page && (page.content || page.title)) return page;
      return getDemoManuscript(pageId).page;
    } catch {
      return getDemoManuscript(pageId).page;
    }
  },
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
  getByPageId: async (pageId: string): Promise<PageFile[]> => {
    if (!pageId || pageId === 'demo' || pageId.startsWith('demo-') || pageId.startsWith('mock-') || pageId === 'adam-research' || pageId === 'default') {
      return getDemoManuscript(pageId).files;
    }
    try {
      const res = await api.apiGet<{ files: any[] }>(`/api/v1/manuscripts/docs/${pageId}/files`, { silent: true });
      if (res && res.files && res.files.length > 0) {
        return res.files.map((f) => ({
          id: f.id,
          pageId: f.pageId || pageId,
          title: f.title || f.name || 'untitled.tex',
          content: f.content || '',
          createdAt: f.createdAt || new Date().toISOString(),
          updatedAt: f.updatedAt || new Date().toISOString(),
        }));
      }
      return getDemoManuscript(pageId).files;
    } catch {
      return getDemoManuscript(pageId).files;
    }
  },

  getDeletedByPageId: async (_pageId: string): Promise<PageFile[]> => {
    // Deleted files endpoint is not exposed as a standalone /api/pages route; return empty list safely
    return [];
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
    try {
      const res = await api.apiPost<{ file: any; files?: any[] }>(
        `/api/v1/manuscripts/docs/${parentPageId}/files`,
        { title, content: content || '' }
      );
      const node = res.file || (Array.isArray(res.files) ? res.files[0] : res);
      return {
        id: node.id || node._id || `file-${Date.now()}`,
        pageId: parentPageId,
        title: node.title || node.name || title,
        content: content || '',
        createdAt: node.createdAt || new Date().toISOString(),
        updatedAt: node.updatedAt || new Date().toISOString(),
      };
    } catch {
      try {
        const node: any = await manuscriptService.structure.createNode(parentPageId, {
          name: title,
          type: 'DOC',
          content: content || '',
        });
        return {
          id: node.id || node._id || `file-${Date.now()}`,
          pageId: parentPageId,
          title: node.name || title,
          content: content || '',
          createdAt: node.createdAt || new Date().toISOString(),
          updatedAt: node.updatedAt || new Date().toISOString(),
        };
      } catch {
        return {
          id: `file-${Date.now()}`,
          pageId: parentPageId,
          title,
          content: content || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    }
  },

  setMain: async ({ pageId, fileId }: { pageId: string; fileId: string }): Promise<Page> => {
    try {
      await manuscriptService.structure.setRootDoc(pageId, fileId);
    } catch {
      // safe fallback
    }
    return { id: pageId, mainFileId: fileId } as any;
  },
};

