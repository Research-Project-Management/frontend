/**
 * docs.client.ts
 *
 * Document CRUD, child files, line updates, batch updater flushing, and workspace bootstrap sub-APIs.
 */

import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import { structure } from './structure.client';
import { flushYjsProviders } from '../realtime/provider-pool';
import { PageFileMapper, type RawPageFileRecord } from './doc-mapper';
import type {
  DocstoreDocDto,
  QueueUpdatePayload,
  FlushResultDto,
  EditorBootstrapResponseDto,
} from './types';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';

export const docs = {
  getById: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiGet<{ page: Page & { docContent?: string } }>(`${PAGES_API_BASE}/docs/${docId}`);
    if (!res || !res.page) {
      throw new Error(`Document ${docId} not found`);
    }
    if (res.page.content === undefined && typeof res.page.docContent === 'string') {
      res.page.content = res.page.docContent;
    }
    return res.page;
  },

  updateContent: async (
    docId: string,
    content: string,
    options?: { expectedRev?: number; expectedVersion?: number },
  ): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const payload = {
      content,
      ...(options?.expectedRev !== undefined ? { expectedRev: options.expectedRev } : {}),
      ...(options?.expectedVersion !== undefined ? { expectedVersion: options.expectedVersion } : {}),
    };
    const res = await apiPut<{ page: Page }>(`${PAGES_API_BASE}/docs/${docId}`, payload);
    return res.page;
  },

  updateThumbnail: async (docId: string, dataUrl: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(
      `${PAGES_API_BASE}/docs/${docId}/thumbnail`,
      { pdfThumbnail: dataUrl },
      { silent: true },
    );
    return res.page;
  },

  updateTitle: async (docId: string, title: string, _oldTitle?: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(`${PAGES_API_BASE}/docs/${docId}`, { title });
    return res.page;
  },

  create: async ({
    projectId,
    title,
    content,
    status = 'draft',
  }: {
    projectId: string;
    title: string;
    content?: string;
    status?: string;
  }): Promise<Page> => {
    const res = await apiPost<{ page: Page }>(`${PAGES_API_BASE}/spaces/${projectId}/docs`, {
      title,
      content,
      status,
    });
    return res.page;
  },

  delete: async (docId: string): Promise<void> => {
    if (!docId) return;
    await apiDelete(`${PAGES_API_BASE}/docs/${docId}`);
  },

  restore: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPost<{ page: Page }>(`${PAGES_API_BASE}/docs/${docId}/restore`, {});
    return res.page;
  },

  duplicate: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPost<{ page: Page }>(`${PAGES_API_BASE}/docs/${docId}/duplicate`, {});
    return res.page;
  },

  getFiles: async (docId: string): Promise<PageFile[]> => {
    if (!docId) return [];
    try {
      const res = await apiGet<{ files: RawPageFileRecord[] }>(
        `${PAGES_API_BASE}/docs/${docId}/files`,
        { silent: true },
      );
      return PageFileMapper.toDomainList(res?.files, {
        defaultPageId: docId,
        defaultTitle: 'untitled.tex',
        includePath: true,
      });
    } catch {
      return [];
    }
  },

  getDeletedFiles: async (pageId: string): Promise<PageFile[]> => {
    if (!pageId) return [];
    try {
      const res = await apiGet<{ files: RawPageFileRecord[] }>(
        `${PAGES_API_BASE}/docs/${pageId}/deleted-files`,
        { silent: true },
      );
      return PageFileMapper.toDomainList(res?.files, {
        defaultPageId: pageId,
        defaultTitle: 'deleted.tex',
        includePath: false,
      });
    } catch {
      return [];
    }
  },

  createChildFile: async ({
    parentPageId,
    title,
    content,
  }: {
    parentPageId: string;
    title: string;
    content?: string;
  }): Promise<PageFile> => {
    const res = await apiPost<
      { file?: RawPageFileRecord; files?: RawPageFileRecord[] } & Partial<RawPageFileRecord>
    >(`${PAGES_API_BASE}/docs/${parentPageId}/files`, { title, content: content || '' });
    const node = res.file || (Array.isArray(res.files) ? res.files[0] : res);
    return PageFileMapper.toDomain(node, {
      defaultPageId: parentPageId,
      defaultTitle: title,
      fallbackContent: content || '',
    });
  },

  createFile: async (params: {
    parentPageId: string;
    title: string;
    content?: string;
  }): Promise<PageFile> => {
    return docs.createChildFile(params);
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

    await structure.setRootDoc(effectiveProjectId, fileId);
    return { id: pageId, mainFileId: fileId };
  },

  setMainFile: async (
    params: string | { pageId: string; fileId: string; projectId?: string },
  ): Promise<{ id: string; mainFileId: string }> => {
    return docs.setMain(params);
  },

  syncIncremental: async (
    rootDocId: string,
    dirtyFileIds: string[],
    forceAll?: boolean,
  ): Promise<{ synced: string[] }> => {
    return await apiPost<{ synced: string[] }>(`${PAGES_API_BASE}/docs/${rootDocId}/sync-incremental`, {
      dirtyFileIds,
      forceAll,
    });
  },

  getProjectDocs: async (projectId: string, status?: string, search?: string): Promise<Page[]> => {
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search) params.search = search;
    try {
      const res = await apiGet<{ pages: Page[] }>(`${PAGES_API_BASE}/spaces/${projectId}/docs`, { params });
      return res.pages || [];
    } catch {
      return [];
    }
  },

  updateDocLines: async (
    projectId: string,
    docId: string,
    lines: string[],
    rev?: number,
  ): Promise<{ modified: boolean; rev: number }> => {
    return await apiPost<{ modified: boolean; rev: number }>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/doc/${docId}`,
      { lines, rev, ...(rev !== undefined ? { expectedRev: rev } : {}) },
    );
  },

  patchDoc: async (
    projectId: string,
    docId: string,
    dto: { path?: string; name?: string; deleted?: boolean; deletedAt?: string },
  ): Promise<DocstoreDocDto | Record<string, unknown>> => {
    const payload = {
      ...dto,
      ...(dto.path && !dto.name ? { name: dto.path } : {}),
    };
    return await apiPatch<DocstoreDocDto | Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/docs/doc/${docId}`,
      payload,
    );
  },
};

export const updater = {
  queueUpdate: async (
    projectId: string,
    docId: string,
    dto: QueueUpdatePayload,
  ): Promise<Record<string, unknown>> => {
    const lines = dto.lines ?? dto.docLines ?? [];
    const clientRev = dto.clientRev ?? dto.version;
    return await apiPost<Record<string, unknown>>(
      `${PAGES_API_BASE}/spaces/${projectId}/updater/doc/${docId}/update`,
      {
        ...dto,
        docLines: dto.docLines ?? lines,
        lines,
        ...(clientRev !== undefined ? { version: dto.version ?? clientRev, clientRev } : {}),
      },
    );
  },

  flushProject: async (
    projectId: string,
    force = false,
  ): Promise<FlushResultDto> => {
    const localFlushedCount = flushYjsProviders(projectId);
    try {
      const serverFlush = await apiPost<FlushResultDto & { flushedDocsCount?: number; flushedDocs?: number }>(
        `${PAGES_API_BASE}/spaces/${projectId}/updater/flush`,
        { force },
      );
      const serverCount = serverFlush?.flushedDocsCount ?? serverFlush?.flushedDocCount ?? serverFlush?.flushedDocs ?? 0;
      const totalCount = Math.max(localFlushedCount, serverCount);
      return {
        ...serverFlush,
        flushed: true,
        flushedDocCount: totalCount,
        flushedDocsCount: totalCount,
      };
    } catch {
      return {
        flushed: true,
        flushedDocCount: localFlushedCount,
        flushedDocsCount: localFlushedCount,
      };
    }
  },
};

export const bootstrap = {
  getEditorBootstrap: async (
    id: string,
    options?: {
      fileId?: string | null;
      isProjectRoute?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<EditorBootstrapResponseDto> => {
    if (!id) {
      throw new Error('Workspace or page ID is required for editor bootstrap');
    }
    const segment = options?.isProjectRoute ? 'spaces' : 'pages';
    const params: Record<string, string> = {};
    if (options?.fileId) {
      params.fileId = options.fileId;
    }
    return await apiGet<EditorBootstrapResponseDto>(
      `${PAGES_API_BASE}/${segment}/${encodeURIComponent(id)}/bootstrap`,
      { params, signal: options?.signal },
    );
  },
};
