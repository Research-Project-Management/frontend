/**
 * compiler.api.ts
 *
 * Compilation sub-API: LaTeX compile, preview compile, word count, aux artifacts, clean aux.
 */

import { apiGet, apiPost, getAuthToken } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE, getManuscriptsBaseUrl } from './base';
import type {
  CompileLatexPayload,
  CompileLatexResponse,
  WordCountResponse,
  PreviewCompileResult,
  AuxFileItem,
} from './types';
import { updater } from './updater.api';

export const compiler = {
  compile: async (payload: CompileLatexPayload, signal?: AbortSignal): Promise<CompileLatexResponse> => {
    const effectiveSignal = signal || payload.signal;
    const { signal: _unused, ...body } = payload;
    if (!body.timeout_ms) {
      body.timeout_ms = 120000;
    }
    if (effectiveSignal?.aborted) {
      const abortErr = new Error('Compilation superseded');
      abortErr.name = 'AbortError';
      throw abortErr;
    }

    try {
      const targetProjectId = body.project_id || body.projectId;
      if (targetProjectId) {
        // Non-blocking background flush: in-memory snapshot is already in body.files/source
        void updater.flushProject(targetProjectId).catch(() => {});
      }
      return await apiPost<CompileLatexResponse>(`${MANUSCRIPTS_API_BASE}/compile`, body, {
        signal: effectiveSignal,
        timeout: 120000,
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

      return {
        success: false,
        pdf: '',
        logs: (err as Error)?.message || 'Compilation service is initializing. Ready for CLSI module.',
        error: (err as Error)?.message || 'Failed to reach compiler service',
      };
    }
  },

  wordCount: async (source: string): Promise<WordCountResponse> => {
    try {
      return await apiPost<WordCountResponse>(`${MANUSCRIPTS_API_BASE}/word-count`, { source });
    } catch {
      const words = source ? source.trim().split(/\s+/).filter(Boolean).length : 0;
      return {
        success: true,
        stats: {
          wordsInText: words,
          wordsInHeaders: 0,
          wordsInCaptions: 0,
          headers: 0,
          floats: 0,
          mathInlines: 0,
          mathDisplayed: 0,
        },
      };
    }
  },

  preview: async (opts: {
    baseContent?: string;
    suggestion?: string;
    sessionId?: string;
    code?: string;
    engine?: 'pdflatex' | 'xelatex' | 'lualatex';
  }): Promise<PreviewCompileResult> => {
    const source = opts.code || opts.suggestion || opts.baseContent || '';
    const engine = opts.engine || 'pdflatex';

    try {
      const res = await apiPost<{ pdf?: string; logs?: string; synctex?: string; error?: string }>(
        `${MANUSCRIPTS_API_BASE}/compile`,
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

  listAuxFiles: async (projectId: string): Promise<AuxFileItem[]> => {
    if (!projectId) return [];
    try {
      const token = getAuthToken();
      const res = await fetch(`${getManuscriptsBaseUrl()}/projects/${projectId}/artifacts`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { files?: AuxFileItem[] };
      return data.files || [];
    } catch {
      return [];
    }
  },

  downloadAuxFileUrl: (projectId: string, filename: string): string => {
    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${MANUSCRIPTS_API_BASE}/projects/${projectId}/artifacts/${encodeURIComponent(filename)}${tokenQuery}`;
  },

  downloadAllArtifactsZipUrl: (projectId: string): string => {
    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${MANUSCRIPTS_API_BASE}/projects/${projectId}/artifacts-zip${tokenQuery}`;
  },

  cancelCompile: async (projectId: string): Promise<{ success: boolean; cancelled: boolean }> => {
    try {
      return await apiPost<{ success: boolean; cancelled: boolean }>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/compile/cancel`,
        {},
      );
    } catch {
      return { success: false, cancelled: false };
    }
  },

  cleanAuxFiles: async (projectId: string): Promise<{ success: boolean }> => {
    if (!projectId) return { success: false };
    try {
      return await apiPost<{ success: boolean }>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/clean-aux`,
        {},
      );
    } catch {
      return { success: false };
    }
  },

  getStatus: async (): Promise<{ status: string; engines: string[] }> => {
    try {
      return await apiGet<{ status: string; engines: string[] }>(`${MANUSCRIPTS_API_BASE}/clsi/status`);
    } catch {
      return { status: 'ok', engines: ['pdflatex', 'xelatex', 'lualatex'] };
    }
  },

  getMetricsSummary: async (): Promise<Record<string, unknown>> => {
    try {
      return await apiGet<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/clsi/metrics/summary`);
    } catch {
      return {};
    }
  },
};
