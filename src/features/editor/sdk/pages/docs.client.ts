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
import type { BffEnvelope } from '@/shared/types/bff.types';
import { PAGES_API_BASE } from './base';
import { flushYjsProviders } from '../realtime/provider-pool';
import { PageFileMapper, type RawPageFileRecord } from './doc-mapper';
import type {
  FlushResultDto,
  EditorBootstrapResponseDto,
} from './types/docs.types';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';

interface UpdatePageMetadataPayload {
  title?: string;
  description?: string;
  status?: string;
  compiler?: 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
  texlive?: string;
  spellLang?: string;
  rootDocId?: string;
}

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

  updateTitle: async (docId: string, title: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(`${PAGES_API_BASE}/docs/${docId}`, { title });
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

  purge: async (docId: string): Promise<{ success: boolean; purgedPageId: string }> => {
    if (!docId) throw new Error('docId is required');
    return await apiDelete<{ success: boolean; purgedPageId: string }>(
      `${PAGES_API_BASE}/docs/${encodeURIComponent(docId)}/permanent`,
    );
  },

  duplicate: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPost<{ page: Page }>(`${PAGES_API_BASE}/docs/${docId}/duplicate`, {});
    return res.page;
  },

  duplicatePage: async <TPage = Page>(docId: string) => {
    if (!docId) throw new Error('docId is required');
    return await apiPost<{
      page: TPage;
      mainFile?: { id: string; [key: string]: unknown } | string | null;
      rootPageId?: string;
      mainFileId?: string | null;
    }>(`${PAGES_API_BASE}/docs/${encodeURIComponent(docId)}/duplicate`, {});
  },

  updateMetadata: async <TPage = Page>(
    pageId: string,
    data: UpdatePageMetadataPayload,
  ): Promise<TPage> => {
    if (!pageId) throw new Error('pageId is required');
    const res = await apiPatch<{ page?: TPage } & TPage>(
      `${PAGES_API_BASE}/docs/${encodeURIComponent(pageId)}/metadata`,
      data,
    );
    return (res && typeof res === 'object' && 'page' in res && res.page ? res.page : res) as TPage;
  },

  listSpacePages: async <TPage = Page>(
    spaceId: string,
    status?: string,
    search?: string,
  ): Promise<TPage[]> => {
    const targetScope = !spaceId ? 'personal' : spaceId;
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search && search.trim()) params.search = search.trim();
    const res = await apiGet<{ pages: TPage[]; total?: number; isEmpty?: boolean }>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(targetScope)}/docs`,
      { params },
    );
    return res?.pages ?? [];
  },

  createSpacePage: async <TPage extends { id?: string } = Page>(input: {
    spaceId: string;
    title: string;
    content?: unknown;
    status?: string;
    labelIds?: string[];
    templateType?: 'blank' | 'example';
  }) => {
    const targetScope = !input.spaceId ? 'personal' : input.spaceId;
    const res = await apiPost<{
      page: TPage;
      mainFile?: { id: string; [key: string]: unknown } | string | null;
    }>(`${PAGES_API_BASE}/spaces/${encodeURIComponent(targetScope)}/docs`, {
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
      rootPageId: res.page?.id || '',
      mainFileId,
    };
  },

  getTrash: async <TPage = Page>(spaceId: string): Promise<TPage[]> => {
    const targetScope = !spaceId ? 'personal' : spaceId;
    const res = await apiGet<{ pages: TPage[]; total?: number }>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(targetScope)}/trash`,
    );
    return res?.pages ?? [];
  },

  replaceLabels: (spaceId: string, pageId: string, labelIds: string[]) => {
    const targetScope = !spaceId ? 'personal' : spaceId;
    return apiPut<{ labels: Array<{ id: string; name: string; color: string }> }>(
      `${PAGES_API_BASE}/spaces/${encodeURIComponent(targetScope)}/docs/${encodeURIComponent(pageId)}/labels`,
      { labelIds },
    );
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
};

export const updater = {
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
    const segment = options?.isProjectRoute ? 'projects' : 'pages';
    const params: Record<string, string> = {};
    if (options?.fileId) {
      params.fileId = options.fileId;
    }
    const envelope = await apiGet<BffEnvelope<EditorBootstrapResponseDto>>(
      `/api/v1/bff/web/${segment}/${encodeURIComponent(id)}/editor-bootstrap`,
      {
        params,
        signal: options?.signal,
      },
    );
    return envelope.data;
  },
};
