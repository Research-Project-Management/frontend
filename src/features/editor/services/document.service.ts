/**
 * document.service.ts
 *
 * Frontend service mirroring Backend `modules/document/`:
 *  - Page & File CRUD (`/api/pages`, `/api/pages/:pageId/files`)
 *  - History & Version Snapshots (`/api/pages/:pageId/versions`, `/api/pages/:projectId/history`)
 *  - LaTeX Compilation Proxy (`/api/latex/compile`, `/api/pages/:rootId/sync-incremental`)
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type {
  Page,
  PageFile,
  PageVersion,
  ProjectEvent,
} from '../types/document.types';

// ─── 1. Document Page CRUD (backend: document/page) ──────────────────────────

export const documentService = {
  getById: async (pageId: string) => {
    const res = await apiGet<{ page: Page }>(`/api/pages/${pageId}`);
    return res.page;
  },

  updateContent: async (pageId: string, content: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { content });
    return res.page;
  },

  updateThumbnail: async (pageId: string, dataUrl: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}/thumbnail`, {
      pdfThumbnail: dataUrl,
    });
    return res.page;
  },

  deletePage: (pageId: string) => apiDelete<void>(`/api/pages/${pageId}`),

  updateTitle: async (pageId: string, title: string, oldTitle?: string) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, {
      title,
      _oldTitle: oldTitle,
    });
    return res.page;
  },
};

export const PageDocumentService = documentService;

// ─── 2. Document Child Files (backend: document/page) ─────────────────────────

export const fileService = {
  getByPageId: async (pageId: string) => {
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
  }) => {
    const res = await apiPost<{ page: PageFile }>(`/api/pages/${parentPageId}/files`, {
      title,
      content,
    });
    return res.page;
  },

  setMain: async ({ pageId, fileId }: { pageId: string; fileId: string }) => {
    const res = await apiPut<{ page: Page }>(`/api/pages/${pageId}/main-file`, {
      mainFileId: fileId,
    });
    return res.page;
  },
};

export const PageFileService = fileService;

// ─── 3. Document Version Snapshots (backend: document/history) ────────────────

export const versionService = {
  getByPageId: async (pageId: string) => {
    const res = await apiGet<{ versions: PageVersion[] }>(`/api/pages/${pageId}/versions`);
    return res.versions;
  },

  save: async ({
    pageId,
    label,
    rootPageId,
  }: {
    pageId: string;
    label?: string;
    rootPageId?: string;
  }) => {
    const res = await apiPost<{ version: PageVersion }>(`/api/pages/${pageId}/versions`, {
      label,
      rootPageId,
    });
    return res.version;
  },

  restore: async ({ pageId, versionId }: { pageId: string; versionId: string }) => {
    const res = await apiPost<{ page: any }>(
      `/api/pages/${pageId}/versions/${versionId}/restore`,
      {},
    );
    return res.page;
  },

  delete: ({ pageId, versionId }: { pageId: string; versionId: string }) =>
    apiDelete<void>(`/api/pages/${pageId}/versions/${versionId}`),
};

export const PageVersionService = versionService;

// ─── 4. Project History Events (backend: document/history) ───────────────────

export const historyService = {
  getByProjectId: async (projectId: string) => {
    const res = await apiGet<{ events?: ProjectEvent[]; history?: ProjectEvent[] }>(
      `/api/pages/${projectId}/history`,
    );
    return res?.events ?? res?.history ?? [];
  },

  restoreToEvent: ({ rootPageId, eventId }: { rootPageId: string; eventId: string }) =>
    apiPost<ProjectEvent[]>(`/api/pages/${rootPageId}/history/${eventId}/restore`, {}),
};

export const ProjectHistoryService = historyService;

// ─── 5. Document Compilation Proxy (backend: document/latex & engine) ─────────

export const flushPageContent = async (fileId: string, content: string): Promise<void> => {
  await apiPut(`/api/pages/${fileId}`, { content });
};

export const syncIncremental = async (
  rootPageId: string,
  dirtyFileIds: string[],
  forceAll?: boolean,
): Promise<{ synced: string[] }> => {
  return await apiPost<{ synced: string[] }>(`/api/pages/${rootPageId}/sync-incremental`, {
    dirtyFileIds,
    forceAll,
  });
};

export type CompileLatexPayload = {
  project_id: string;
  main_file: string | null;
  engine: string;
  draft: boolean;
  use_cache: boolean;
};

export const compileLatex = async (
  payload: CompileLatexPayload,
): Promise<{ pdf: string; logs: string; synctex?: string }> => {
  return await apiPost<{ pdf: string; logs: string; synctex?: string }>(
    '/api/latex/compile',
    payload,
  );
};

export interface PreviewCompileResult {
  success: boolean;
  pdf?: string;
  pdfUrl?: string;
  log: string;
  error?: string;
}

export async function compilePreview(
  opts: {
    baseContent?: string;
    suggestion?: string;
    sessionId?: string;
    code?: string;
    engine?: 'pdflatex' | 'xelatex' | 'lualatex';
  },
): Promise<PreviewCompileResult> {
  const source = opts.code || opts.suggestion || opts.baseContent || '';
  const engine = opts.engine || 'pdflatex';

  try {
    const res = await apiPost<{ pdf?: string; logs?: string; synctex?: string; error?: string }>(
      '/api/latex/compile',
      {
        project_id: opts.sessionId || 'preview',
        main_file: 'preview.tex',
        engine,
        source,
        draft: true,
        use_cache: false,
      },
    );

    return {
      success: Boolean(res.pdf),
      pdf: res.pdf,
      pdfUrl: res.pdf,
      log: res.logs || '',
      error: res.error,
    };
  } catch (err: any) {
    return {
      success: false,
      pdf: '',
      pdfUrl: '',
      log: err?.message || String(err),
      error: err?.message || 'Preview compile failed',
    };
  }
}

export const compileService = {
  flushPageContent,
  syncIncremental,
  compileLatex,
  compilePreview,
};

export const DocumentCompileService = compileService;

// ─── 6. Reference & DOI Lookup (backend: library / document references) ───────

export type CrossrefWork = {
  title: string;
  authors: string[];
  editors?: string[];
  doi: string;
  journal: string;
  publicationTitle?: string;
  publicationDate?: string;
  publisher: string;
  place?: string;
  issn: string;
  isbn: string;
  volume: string;
  issue: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  pages: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  year: number | string;
  type: string;
  itemType?: string;
  abstract: string;
  url: string;
  score: number;
  language?: string;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  license?: string;
  libraryCatalog?: string;
  keywords?: string[];
  pmid?: string;
  pmcid?: string;
  extra?: string;
};

export async function fetchLookupDoi(doi: string) {
  return apiGet<{ work: CrossrefWork }>(`/api/library/references/doi/${encodeURIComponent(doi)}`);
}

export async function fetchSearchCrossref(query: string, rows = 1) {
  return apiGet<{ works: CrossrefWork[]; totalResults: number }>(
    `/api/library/references/crossref/search?query=${encodeURIComponent(query)}&rows=${rows}`
  );
}
