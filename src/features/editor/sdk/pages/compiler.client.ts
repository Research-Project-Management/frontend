/**
 * compiler.client.ts
 *
 * Compilation & SyncTeX sub-APIs: LaTeX compile, preview compile, word count,
 * aux artifacts, clean aux, and forward/reverse SyncTeX mapping.
 */

import { apiDelete, apiGet, apiPost, rawFetch } from '@/shared/lib/api';
import { isApiError } from '@/shared/types/api.types';
import { PAGES_API_BASE, getPagesBaseUrl } from './base';
import {
  DEFAULT_COMPILER_ENGINE,
  type CompilerEngine,
} from '@/features/editor/domain/types/compiler.types';
import type {
  CompileLatexPayload,
  CompileLatexResponse,
  CompileOutcome,
  WordCountResponse,
  PreviewCompileResult,
  AuxFileItem,
  ForwardSyncPayload,
  ForwardSyncResult,
  ReverseSyncPayload,
  ReverseSyncResult,
} from './types/compiler.types';

const CLSI_API_BASE = `${PAGES_API_BASE}/clsi`;

function getClsiBaseUrl(): string {
  return `${getPagesBaseUrl().replace(/\/+$/, '')}/clsi`;
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
    // Let the server enforce its authoritative tier cap; only give the client HTTP layer
    // enough headroom (+10s) so server-side timeout diagnostics arrive cleanly instead of AbortError.
    const defaultClientHttpTimeout = body.syntaxOnly
      ? 30000
      : body.priority === 'auto'
        ? 40000
        : body.draft
          ? 55000
          : 105000;
    const clientHttpTimeout =
      typeof body.timeoutMs === 'number'
        ? body.timeoutMs + 10000
        : defaultClientHttpTimeout;
    if (effectiveSignal?.aborted) {
      const abortErr = new Error('Compilation superseded');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    try {
      return await apiPost<CompileLatexResponse>(`${CLSI_API_BASE}/compile`, body, {
        signal: effectiveSignal,
        timeout: clientHttpTimeout,
      });
    } catch (err: unknown) {
      const isClientAborted =
        Boolean(effectiveSignal?.aborted) ||
        (err as { name?: string })?.name === 'AbortError' ||
        (err as Error)?.message?.toLowerCase().includes('aborted');
      const isServerSuperseded =
        isApiError(err) &&
        err.statusCode === 409 &&
        (['COMPILE_SUPERSEDED', 'COMPILE_ABORTED', 'PROJECT_LOCK_ABORTED'].includes(err.code ?? '') ||
          /superseded|cancelled/i.test(err.message));

      if (isClientAborted || isServerSuperseded) {
        const abortErr = err instanceof Error ? err : new Error('Compilation superseded');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      const errorMessage =
        err instanceof Error && err.message ? err.message : 'Failed to reach compiler service';

      if (isApiError(err)) {
        const outcome: CompileOutcome =
          err.statusCode === 429 ||
          err.code === 'COMPILE_RATE_LIMITED' ||
          err.code === 'AUTO_COMPILE_SHED' ||
          err.code === 'RATE_LIMIT_EXCEEDED'
            ? 'rate-limited'
            : err.statusCode === 504 || err.code === 'COMPILE_QUEUE_TIMEOUT'
              ? 'timedout'
              : err.statusCode === 503 ||
                  err.statusCode >= 500 ||
                  err.statusCode === 0 ||
                  err.code === 'PROJECT_LOCK_TIMEOUT'
                ? 'clsi-unavailable'
                : 'validation-problems';

        return {
          success: false,
          outcome,
          statusCode: err.statusCode,
          errorCode: err.code,
          pdf: '',
          logs: errorMessage,
          error: errorMessage,
        };
      }

      return {
        success: false,
        outcome: 'clsi-unavailable',
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
    return await apiPost<WordCountResponse>(
      `${CLSI_API_BASE}/word-count`,
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
    engine?: CompilerEngine;
  }): Promise<PreviewCompileResult> => {
    const source = opts.code || opts.suggestion || opts.baseContent || '';
    const engine = opts.engine || DEFAULT_COMPILER_ENGINE;

    try {
      const res = await apiPost<{ pdf?: string; logs?: string; synctex?: string; error?: string }>(
        `${CLSI_API_BASE}/compile`,
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
    pageId: string,
    _options?: { isPageScoped?: boolean },
  ): Promise<AuxFileItem[]> => {
    if (!pageId) return [];
    try {
      const data = await apiGet<{ files?: AuxFileItem[] }>(
        `${CLSI_API_BASE}/pages/${encodeURIComponent(pageId)}/artifacts`,
        { silent: true },
      );
      return Array.isArray(data?.files) ? data.files : [];
    } catch {
      return [];
    }
  },

  downloadAuxFileUrl: (
    pageId: string,
    filename: string,
    _options?: { isPageScoped?: boolean },
  ): string => {
    return `${CLSI_API_BASE}/pages/${encodeURIComponent(pageId)}/artifacts/${encodeURIComponent(filename)}`;
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
    pageId: string,
    filename = 'output.pdf',
    _options?: { isPageScoped?: boolean },
  ): Promise<string | null> => {
    if (!pageId) return null;
    try {
      const res = await rawFetch(
        `${getClsiBaseUrl()}/pages/${encodeURIComponent(pageId)}/artifacts/${encodeURIComponent(filename)}`,
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
    pageId: string,
    _options?: { isPageScoped?: boolean },
  ): string => {
    return `${CLSI_API_BASE}/pages/${encodeURIComponent(pageId)}/artifacts/archive`;
  },

  cancelCompile: async (
    pageId: string,
    _options?: { isPageScoped?: boolean },
  ): Promise<{ success: boolean; cancelled: boolean }> => {
    try {
      return await apiDelete<{ success: boolean; cancelled: boolean }>(
        `${CLSI_API_BASE}/pages/${encodeURIComponent(pageId)}/compile`,
      );
    } catch {
      return { success: false, cancelled: false };
    }
  },

  cleanAuxFiles: async (
    pageId: string,
    _options?: { isPageScoped?: boolean },
  ): Promise<{ success: boolean }> => {
    if (!pageId) return { success: false };
    try {
      return await apiDelete<{ success: boolean }>(
        `${CLSI_API_BASE}/pages/${encodeURIComponent(pageId)}/artifacts`,
      );
    } catch {
      return { success: false };
    }
  },

  getStatus: async (): Promise<{ status: string; engines: string[]; offline?: boolean }> => {
    try {
      return await apiGet<{ status: string; engines: string[]; offline?: boolean }>(`${CLSI_API_BASE}/status`);
    } catch {
      return { status: 'degraded', engines: ['pdflatex', 'xelatex', 'lualatex', 'latex'], offline: true };
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
    }>(`${CLSI_API_BASE}/synctex/forward`, payload);
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
    }>(`${CLSI_API_BASE}/synctex/reverse`, payload);
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
