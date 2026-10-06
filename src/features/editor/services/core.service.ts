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
  getById: async (pageId: string): Promise<Page> => {
    if (!pageId) {
      throw new Error('pageId is required');
    }
    const page = await manuscriptService.docs.getById(pageId);
    if (!page) {
      throw new Error(`Page ${pageId} not found`);
    }
    return page;
  },
  updateContent: manuscriptService.docs.updateContent,
  updateThumbnail: manuscriptService.docs.updateThumbnail,
  deletePage: manuscriptService.docs.delete,
  restorePage: async (docId: string): Promise<Page> => {
    return await manuscriptService.docs.restore(docId);
  },
  updateTitle: manuscriptService.docs.updateTitle,
  create: manuscriptService.docs.create,
};

export const documentService = pageService;

// ─── 2. Child Files ──────────────────────────────────────────────────────────

export const fileService = {
  getByPageId: async (pageId: string): Promise<PageFile[]> => {
    if (!pageId) return [];
    try {
      const res = await api.apiGet<{ files: any[] }>(`/api/v1/manuscripts/docs/${pageId}/files`, { silent: true });
      if (res && Array.isArray(res.files)) {
        return res.files.map((f) => ({
          id: f.id,
          pageId: f.pageId || pageId,
          title: f.title || f.name || 'untitled.tex',
          content: f.content || '',
          createdAt: f.createdAt || new Date().toISOString(),
          updatedAt: f.updatedAt || new Date().toISOString(),
        }));
      }
      return [];
    } catch {
      return [];
    }
  },

  getDeletedByPageId: async (pageId: string): Promise<PageFile[]> => {
    if (!pageId) return [];
    try {
      const res = await api.apiGet<{ files: any[] }>(`/api/v1/manuscripts/docs/${pageId}/deleted-files`, { silent: true });
      if (res && Array.isArray(res.files)) {
        return res.files.map((f) => ({
          id: f.id,
          pageId: f.pageId || pageId,
          title: f.title || f.name || f.path?.replace(/^\//, '') || 'deleted.tex',
          content: f.content || '',
          createdAt: f.createdAt || new Date().toISOString(),
          updatedAt: f.updatedAt || new Date().toISOString(),
        }));
      }
      return [];
    } catch {
      return [];
    }
  },

  restore: async (fileId: string): Promise<Page> => {
    return pageService.restorePage(fileId);
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
    }
  },

  setMain: async ({ pageId, fileId, projectId }: { pageId: string; fileId: string; projectId?: string }): Promise<Page> => {
    const effectiveProjectId = projectId || pageId;
    await manuscriptService.structure.setRootDoc(effectiveProjectId, fileId);
    return { id: pageId, mainFileId: fileId } as any;
  },
};

