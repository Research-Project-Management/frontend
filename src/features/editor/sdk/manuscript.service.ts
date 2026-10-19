/**
 * manuscript.service.ts
 *
 * UNIFIED MANUSCRIPT CLIENT SDK FACADE
 *
 * Canonical entry point for all Manuscript subsystem operations:
 * - docs: Document CRUD, child files, lines, thumbnails, incremental sync
 * - compiler: LaTeX compilation, word count, preview, aux artifacts
 * - synctex: Forward and reverse SyncTeX coordinate mapping
 * - comments: Inline discussion threads, replies, and resolution
 * - suggestions: Track changes and review suggestions (accept/reject)
 * - review: Unified review & track changes threads
 * - history: Snapshots, revisions, visual diffing, and audit logs
 * - search: Full-text search and atomic batch replace across project files
 * - export: Multi-format compilation export (PDF, TeX, arXiv, DOCX, MD)
 * - collaboration: Real-time presence, heartbeat, and SSE synchronization
 * - structure: Project hierarchy, folders, and file tree nodes
 * - diagnostics: Error explanation, linter, autofix
 * - linkedFiles: External file links (Zotero, Mendeley, URL, etc.)
 * - citations: BibTeX entry resolution, validation, and search
 * - templates: Project and gallery template scaffolding
 * - filestore: Binary file upload, streaming, and signed URLs
 * - updater: Batch document update buffering and buffer flushing
 * - spelling: Personal spellcheck dictionary
 */

import * as api from '@/shared/lib/api';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';
import { manuscriptService } from './manuscript/manuscript-api.client';

export * from './manuscript/base';
export * from './manuscript/types';
export * from './manuscript/manuscript-api.client';
export * from './realtime/yjs-socket-provider';
export * from './archive/archive-export';
export * from './archive/archive-import';
export { manuscriptService };
export default manuscriptService;

// ─── 1. Core Document & File Aliases ─────────────────────────────────────────

export const pageService = {
  getById: async (pageId: string): Promise<Page> => {
    if (!pageId) throw new Error('pageId is required');
    const page = await manuscriptService.docs.getById(pageId);
    if (!page) throw new Error(`Page ${pageId} not found`);
    return page;
  },
  updateContent: manuscriptService.docs.updateContent,
  updateThumbnail: manuscriptService.docs.updateThumbnail,
  deletePage: manuscriptService.docs.delete,
  restorePage: async (docId: string): Promise<Page> => manuscriptService.docs.restore(docId),
  updateTitle: manuscriptService.docs.updateTitle,
  create: manuscriptService.docs.create,
};

interface RawPageFileRecord {
  id: string;
  _id?: string;
  pageId?: string;
  title?: string;
  name?: string;
  path?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const fileService = {
  getByPageId: async (pageId: string): Promise<PageFile[]> => {
    if (!pageId) return [];
    try {
      const res = await api.apiGet<{ files: RawPageFileRecord[] }>(`/api/v1/manuscripts/docs/${pageId}/files`, { silent: true });
      if (res && Array.isArray(res.files)) {
        return res.files.map((f) => ({
          id: f.id,
          pageId: f.pageId || pageId,
          title: f.title || f.name || 'untitled.tex',
          path: f.path || f.title || f.name || 'untitled.tex',
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
      const res = await api.apiGet<{ files: RawPageFileRecord[] }>(`/api/v1/manuscripts/docs/${pageId}/deleted-files`, { silent: true });
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

  restore: async (fileId: string): Promise<Page> => pageService.restorePage(fileId),

  create: async ({
    parentPageId,
    title,
    content,
  }: {
    parentPageId: string;
    title: string;
    content?: string;
  }): Promise<PageFile> => {
    const res = await api.apiPost<{ file?: RawPageFileRecord; files?: RawPageFileRecord[] } & Partial<RawPageFileRecord>>(
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
  },

  setMain: async (
    params: string | { pageId: string; fileId: string; projectId?: string },
  ): Promise<{ id: string; mainFileId: string }> => {
    let effectiveProjectId: string;
    let fileId: string;
    let pageId: string;

    if (typeof params === 'string') {
      fileId = params;
      pageId = params;
      effectiveProjectId = params;
    } else {
      fileId = params.fileId;
      pageId = params.pageId;
      effectiveProjectId = params.projectId || params.pageId;
    }

    try {
      await manuscriptService.structure.setRootDoc(effectiveProjectId, fileId);
    } catch {
      // Non-fatal if rootDoc already synced
    }
    return { id: pageId, mainFileId: fileId };
  },
};

// ─── 2. Compiler Aliases ─────────────────────────────────────────────────────

export const flushPageContent = manuscriptService.docs.updateContent;
export const syncIncremental = manuscriptService.docs.syncIncremental;
export const compileLatex = manuscriptService.compiler.compile;
export const fetchWordCount = manuscriptService.compiler.wordCount;
export const listAuxFiles = manuscriptService.compiler.listAuxFiles;
export const downloadAuxFileUrl = manuscriptService.compiler.downloadAuxFileUrl;
export const downloadAllArtifactsZipUrl = manuscriptService.compiler.downloadAllArtifactsZipUrl;
export const cleanAuxFiles = manuscriptService.compiler.cleanAuxFiles;

// ─── 3. SyncTeX Aliases ──────────────────────────────────────────────────────

export const synctexService = {
  forwardSync: manuscriptService.synctex.forwardSync,
  reverseSync: manuscriptService.synctex.reverseSync,
};

// ─── 4. Comment Aliases ──────────────────────────────────────────────────────

export const commentService = manuscriptService.comments;

// ─── 5. Suggestion / Track Changes Aliases ───────────────────────────────────

export const suggestionService = {
  getSuggestions: (
    docId: string,
    status?: Parameters<typeof manuscriptService.suggestions.getSuggestions>[1],
  ) => manuscriptService.suggestions.getSuggestions(docId, status),
  createSuggestion: (
    payload: Parameters<typeof manuscriptService.suggestions.createSuggestion>[0],
  ) => manuscriptService.suggestions.createSuggestion(payload),
  acceptSuggestion: (docId: string, suggestionId: string) =>
    manuscriptService.suggestions.acceptSuggestion(docId, suggestionId),
  rejectSuggestion: (docId: string, suggestionId: string) =>
    manuscriptService.suggestions.rejectSuggestion(docId, suggestionId),
  acceptAllSuggestions: (docId: string) =>
    manuscriptService.suggestions.acceptAllSuggestions(docId),
  rejectAllSuggestions: (docId: string) =>
    manuscriptService.suggestions.rejectAllSuggestions(docId),
  acceptSelectedSuggestions: (docId: string, suggestionIds: string[]) =>
    manuscriptService.suggestions.acceptSelectedSuggestions(docId, suggestionIds),
  rejectSelectedSuggestions: (docId: string, suggestionIds: string[]) =>
    manuscriptService.suggestions.rejectSelectedSuggestions(docId, suggestionIds),
};

// ─── 6. History / Versions Aliases ──────────────────────────────────────────

export const versionService = {
  getByPageId: (docId: string) => manuscriptService.history.getByDocId(docId),
  getById: (docId: string, versionId: string) => manuscriptService.history.getById(docId, versionId),
  save: (payload: Parameters<typeof manuscriptService.history.save>[0]) =>
    manuscriptService.history.save(payload),
  restore: (payload: Parameters<typeof manuscriptService.history.restore>[0]) =>
    manuscriptService.history.restore(payload),
  updateLabel: (docId: string, versionId: string, label: string, title?: string) =>
    manuscriptService.history.updateLabel(docId, versionId, label, title),
  getDiff: (docId: string, fromVersionId: string, toVersionId: string) =>
    manuscriptService.history.getDiff(docId, fromVersionId, toVersionId),
  compareVersions: (docId: string, fromVersionId: string, toVersionId: string) =>
    manuscriptService.history.compareVersions(docId, fromVersionId, toVersionId),
};

export const historyKeys = {
  all: ['history'] as const,
  project: (projectId: string) => ['history', 'project', projectId] as const,
  versions: (projectId: string) => ['history', 'project', projectId, 'versions'] as const,
  snapshot: (projectId: string, version: number) => ['history', 'snapshot', projectId, version] as const,
  doc: (docId: string) => ['history', 'doc', docId] as const,
  diff: (docId: string, from: string, to: string) => ['history', 'diff', docId, from, to] as const,
};

export const historyService = {
  getByProjectId: (projectId: string) => manuscriptService.history.getByProjectId(projectId),
  getProjectVersions: (projectId: string) => manuscriptService.history.getProjectVersions(projectId),
  getProjectSnapshot: (projectId: string, version: number) =>
    manuscriptService.history.getProjectSnapshot(projectId, version),
  compareProjectVersions: (projectId: string, baseVersion: number, targetVersion: number) =>
    manuscriptService.history.compareProjectVersions(projectId, baseVersion, targetVersion),
  labelProjectVersion: (projectId: string, version: number, label: string) =>
    manuscriptService.history.labelProjectVersion(projectId, version, label),
  deleteProjectLabel: (projectId: string, labelId: string) =>
    manuscriptService.history.deleteProjectLabel(projectId, labelId),
  restoreProjectVersion: (projectId: string, targetVersion: number) =>
    manuscriptService.history.restoreProjectVersion(projectId, targetVersion),
  createProjectSnapshot: (
    projectId: string,
    summary?: string | { summary?: string; label?: string; isAutomatic?: boolean }
  ) => {
    const dto = typeof summary === 'string' ? { summary } : (summary ?? {});
    return manuscriptService.history.createProjectSnapshot(projectId, dto);
  },
  restoreToEvent: async (payload: { rootPageId: string; eventId?: string; versionNumber?: number }) => {
    if (payload.versionNumber) {
      return manuscriptService.history.restoreProjectVersion(payload.rootPageId, payload.versionNumber);
    }
    return null;
  },
};

// ─── 7. Export Aliases ───────────────────────────────────────────────────────

export const exportService = {
  exportDocument: manuscriptService.export.exportDocument,
};

// ─── 8. Search Aliases ───────────────────────────────────────────────────────

export const documentSearchService = {
  search: manuscriptService.search.search,
  batchReplace: manuscriptService.search.batchReplace,
};

// ─── 9. AI Assistant & Error Repair Aliases ──────────────────────────────────

export const AcademicAiService = manuscriptService.AcademicAiService;
export const suggestLatexFix = manuscriptService.suggestLatexFix;


