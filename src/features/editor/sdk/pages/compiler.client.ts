/**
 * compiler.client.ts
 *
 * Compilation & SyncTeX sub-APIs: LaTeX compile, preview compile, word count,
 * aux artifacts, clean aux, and forward/reverse SyncTeX mapping.
 */

import { apiGet, apiPost, rawFetch } from '@/shared/lib/api';
import { PAGES_API_BASE, getPagesBaseUrl } from './base';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import type {
  CompileLatexPayload,
  CompileLatexResponse,
  WordCountResponse,
  PreviewCompileResult,
  AuxFileItem,
  ForwardSyncPayload,
  ForwardSyncResult,
  ReverseSyncPayload,
  ReverseSyncResult,
} from './types';

function resolveCompilerArtifactSegment(
  pageOrProjectId: string,
  options?: { isPageScoped?: boolean },
): 'pages' | 'spaces' {
  if (options?.isPageScoped === true) return 'pages';
  if (options?.isPageScoped === false) return 'spaces';
  const state =
    typeof usePageStore?.getState === 'function' ? usePageStore.getState() : undefined;
  if (
    state?.projectId &&
    state.projectId === pageOrProjectId &&
    state.rootPageId !== pageOrProjectId &&
    state.parentPageId !== pageOrProjectId
  ) {
    return 'spaces';
  }
  if (/^proj[-_]/i.test(pageOrProjectId)) {
    return 'spaces';
  }
  return 'pages';
}

function resolveArtifactRequestUrl(artifactUrlOrPath: string): string {
  const trimmed = artifactUrlOrPath.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const pagesBase = getPagesBaseUrl().replace(/\/+$/, '');
  if (trimmed.startsWith('/api/v1/pages')) {
    return `${pagesBase}${trimmed.slice('/api/v1/pages'.length)}`;
  }
  return `${pagesBase}/${trimmed.replace(/^\/+/, '')}`;
}

export const compiler = {
  compile: async (payload: CompileLatexPayload, signal?: AbortSignal): Promise<CompileLatexResponse> => {
    const effectiveSignal = signal || payload.signal;
    const { signal: _unused, ...body } = payload;
    const effectiveTimeout = body.timeoutMs ?? 240000;
    body.timeoutMs = effectiveTimeout;
    if (effectiveSignal?.aborted) {
      const abortErr = new Error('Compilation superseded');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    try {
      return await apiPost<CompileLatexResponse>(`${PAGES_API_BASE}/compile`, body, {
        signal: effectiveSignal,
        timeout: effectiveTimeout,
      });
    } catch (err: unknown) {
      const isAborted =
        Boolean(effectiveSignal?.aborted) ||
        (err as { name?: string })?.name === 'AbortError' ||
        (err as Error)?.message?.toLowerCase().includes('aborted');

      if (isAborted) {
        const abortErr = (err as Error) || new Error('Compilation superseded');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      const errorMessage = (err as Error)?.message || 'Failed to reach compiler service';
      return {
        success: false,
        pdf: '',
        logs: errorMessage,
        error: errorMessage,
      };
    }
  },

  wordCount: async (
    source?: string,
    projectId?: string,
    options?: {
      includeBib?: boolean;
      filename?: string;
      files?: Record<string, string>;
      pageId?: string;
    },
  ): Promise<WordCountResponse> => {
    const endpoint = projectId
      ? `${PAGES_API_BASE}/spaces/${projectId}/word-count`
      : options?.pageId
        ? `${PAGES_API_BASE}/pages/${options.pageId}/word-count`
        : `${PAGES_API_BASE}/word-count`;
    return await apiPost<WordCountResponse>(
      endpoint,
      {
        ...(source !== undefined ? { source } : {}),
        ...(projectId ? { spaceId: projectId } : {}),
        ...(options?.pageId ? { pageId: options.pageId } : {}),
        ...(options?.includeBib !== undefined
          ? { includeBib: options.includeBib }
          : {}),
        ...(options?.filename ? { filename: options.filename } : {}),
        ...(options?.files ? { files: options.files } : {}),
      },
      { silent: true },
    );
  },

  preview: async (opts: {
    baseContent?: string;
    suggestion?: string;
    sessionId?: string;
    code?: string;
    engine?: 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
  }): Promise<PreviewCompileResult> => {
    const source = opts.code || opts.suggestion || opts.baseContent || '';
    const engine = opts.engine || 'pdflatex';

    try {
      const res = await apiPost<{ pdf?: string; logs?: string; synctex?: string; error?: string }>(
        `${PAGES_API_BASE}/compile`,
        {
          spaceId: opts.sessionId || 'preview',
          mainFile: 'preview.tex',
          engine,
          source,
          draft: true,
          useCache: false,
        },
      );

      return {
        success: Boolean(res.pdf),
        pdf: res.pdf,
        pdfUrl: res.pdf,
        log: res.logs || '',
        error: res.error,
      };
    } catch (err: unknown) {
      return {
        success: false,
        pdf: '',
        pdfUrl: '',
        log: (err as Error)?.message || String(err),
        error: (err as Error)?.message || 'Preview compile failed',
      };
    }
  },

  listAuxFiles: async (
    pageOrProjectId: string,
    options?: { isPageScoped?: boolean },
  ): Promise<AuxFileItem[]> => {
    if (!pageOrProjectId) return [];
    const segment = resolveCompilerArtifactSegment(pageOrProjectId, options);
    try {
      const res = await rawFetch(
        `${getPagesBaseUrl()}/${segment}/${encodeURIComponent(pageOrProjectId)}/artifacts`,
        'GET',
        undefined,
        { silent: true },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { files?: AuxFileItem[] };
      return data.files || [];
    } catch {
      return [];
    }
  },

  downloadAuxFileUrl: (
    pageOrProjectId: string,
    filename: string,
    options?: { isPageScoped?: boolean },
  ): string => {
    const segment = resolveCompilerArtifactSegment(pageOrProjectId, options);
    return `${PAGES_API_BASE}/${segment}/${encodeURIComponent(pageOrProjectId)}/artifacts/${encodeURIComponent(filename)}`;
  },

  fetchArtifactBlob: async (
    artifactUrlOrPath: string,
    signal?: AbortSignal,
  ): Promise<{ url: string; blob: Blob } | null> => {
    if (!artifactUrlOrPath?.trim()) return null;
    try {
      const res = await rawFetch(
        resolveArtifactRequestUrl(artifactUrlOrPath),
        'GET',
        undefined,
        { silent: true, signal },
      );
      if (!res.ok) return null;
      const rawBlob = await res.blob();
      if (!rawBlob || rawBlob.size === 0) return null;
      const pathOnly = artifactUrlOrPath.split('?')[0].toLowerCase();
      const typedBlob =
        rawBlob.type === 'application/pdf' || !pathOnly.endsWith('.pdf')
          ? rawBlob
          : new Blob([rawBlob], { type: 'application/pdf' });
      return { url: URL.createObjectURL(typedBlob), blob: typedBlob };
    } catch (err: unknown) {
      if (signal?.aborted || (err as { name?: string })?.name === 'AbortError') {
        throw err;
      }
      return null;
    }
  },

  fetchArtifactArrayBuffer: async (
    artifactUrlOrPath: string,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer | null> => {
    if (!artifactUrlOrPath?.trim()) return null;
    try {
      const res = await rawFetch(
        resolveArtifactRequestUrl(artifactUrlOrPath),
        'GET',
        undefined,
        { silent: true, signal },
      );
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return buf.byteLength > 0 ? buf : null;
    } catch (err: unknown) {
      if (signal?.aborted || (err as { name?: string })?.name === 'AbortError') {
        throw err;
      }
      return null;
    }
  },

  fetchArtifactBlobUrl: async (
    pageOrProjectId: string,
    filename = 'output.pdf',
    options?: { isPageScoped?: boolean },
  ): Promise<string | null> => {
    if (!pageOrProjectId) return null;
    const segment = resolveCompilerArtifactSegment(pageOrProjectId, options);
    try {
      const res = await rawFetch(
        `${getPagesBaseUrl()}/${segment}/${encodeURIComponent(pageOrProjectId)}/artifacts/${encodeURIComponent(filename)}`,
        'GET',
        undefined,
        { silent: true },
      );
      if (!res.ok) return null;
      const rawBlob = await res.blob();
      if (!rawBlob || rawBlob.size === 0) return null;
      const typedBlob =
        rawBlob.type === 'application/pdf' || !filename.endsWith('.pdf')
          ? rawBlob
          : new Blob([rawBlob], { type: 'application/pdf' });
      return URL.createObjectURL(typedBlob);
    } catch {
      return null;
    }
  },

  downloadAllArtifactsZipUrl: (
    pageOrProjectId: string,
    options?: { isPageScoped?: boolean },
  ): string => {
    const segment = resolveCompilerArtifactSegment(pageOrProjectId, options);
    return `${PAGES_API_BASE}/${segment}/${encodeURIComponent(pageOrProjectId)}/artifacts-zip`;
  },

  cancelCompile: async (
    pageOrProjectId: string,
    options?: { isPageScoped?: boolean },
  ): Promise<{ success: boolean; cancelled: boolean }> => {
    const segment = resolveCompilerArtifactSegment(pageOrProjectId, options);
    try {
      return await apiPost<{ success: boolean; cancelled: boolean }>(
        `${PAGES_API_BASE}/${segment}/${encodeURIComponent(pageOrProjectId)}/compile/cancel`,
        {},
      );
    } catch {
      return { success: false, cancelled: false };
    }
  },

  cleanAuxFiles: async (
    pageOrProjectId: string,
    options?: { isPageScoped?: boolean },
  ): Promise<{ success: boolean }> => {
    if (!pageOrProjectId) return { success: false };
    const segment = resolveCompilerArtifactSegment(pageOrProjectId, options);
    try {
      return await apiPost<{ success: boolean }>(
        `${PAGES_API_BASE}/${segment}/${encodeURIComponent(pageOrProjectId)}/clean-aux`,
        {},
      );
    } catch {
      return { success: false };
    }
  },

  getStatus: async (): Promise<{ status: string; engines: string[]; offline?: boolean }> => {
    try {
      return await apiGet<{ status: string; engines: string[]; offline?: boolean }>(`${PAGES_API_BASE}/clsi/status`);
    } catch {
      return { status: 'degraded', engines: ['pdflatex', 'xelatex', 'lualatex', 'latex'], offline: true };
    }
  },

  getMetricsSummary: async (): Promise<Record<string, unknown>> => {
    try {
      return await apiGet<Record<string, unknown>>(`${PAGES_API_BASE}/clsi/metrics/summary`);
    } catch {
      return {};
    }
  },
};

export const synctex = {
  forwardSync: async (payload: ForwardSyncPayload): Promise<ForwardSyncResult | null> => {
    const res = await apiPost<{
      success?: boolean;
      result?: {
        page?: number;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
        width?: number;
        height?: number;
      };
    }>(`${PAGES_API_BASE}/synctex/forward`, payload);
    if (res?.success && res?.result) {
      return {
        page: res.result.page ?? 1,
        x: res.result.x ?? 72,
        y: res.result.y ?? 72,
        w: res.result.w ?? res.result.width ?? 450,
        h: res.result.h ?? res.result.height ?? 14,
      };
    }
    return null;
  },

  reverseSync: async (payload: ReverseSyncPayload): Promise<ReverseSyncResult | null> => {
    const res = await apiPost<{
      success?: boolean;
      result?: {
        file?: string;
        line?: number;
        column?: number;
      };
    }>(`${PAGES_API_BASE}/synctex/reverse`, payload);
    if (res?.success && res?.result) {
      return {
        file: res.result.file ?? '',
        line: res.result.line ?? 1,
        column: res.result.column ?? 0,
      };
    }
    return null;
  },
};

export const listAuxFiles = (
  pageOrProjectId: string,
  options?: { isPageScoped?: boolean },
) => compiler.listAuxFiles(pageOrProjectId, options);

export const downloadAuxFileUrl = (
  pageOrProjectId: string,
  filename: string,
  options?: { isPageScoped?: boolean },
) => compiler.downloadAuxFileUrl(pageOrProjectId, filename, options);

export const downloadAllArtifactsZipUrl = (
  pageOrProjectId: string,
  options?: { isPageScoped?: boolean },
) => compiler.downloadAllArtifactsZipUrl(pageOrProjectId, options);

export const fetchWordCount = async (
  source: string,
  projectId?: string,
  options?: {
    includeBib?: boolean;
    filename?: string;
    files?: Record<string, string>;
  },
) => {
  return await compiler.wordCount(source, projectId, options);
};
