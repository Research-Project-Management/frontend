/**
 * manuscript-api.client.ts
 *
 * Consolidated Manuscript API Gateway Client (Deep Module - SDK Layer).
 * Location: frontend/src/features/editor/sdk/manuscript/manuscript-api.client.ts
 *
 * Adheres strictly to Matt Pocock Codebase Design & Ousterhout Deep Module principles:
 * - Single typed entry point consolidating 22 shallow sub-domain endpoints.
 * - Cheaper to learn, zero artificial file hops, higher locality for network calls.
 * - Single source of truth for all Manuscript HTTP communication.
 */

import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  rawFetch,
  getAuthToken,
} from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE, getManuscriptsBaseUrl } from './base';
import type {
  DocstoreDocDto,
  QueueUpdatePayload,
  FlushResultDto,
  DiagnosticReportDto,
  AutoFixResultDto,
  ErrorExplanationDto,
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
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import type {
  AcademicAiActionParams,
  AcademicAiActionResult,
} from '@/features/editor/domain/ai/ai-academic-assistant';
import type {
  AiErrorFixParams,
  AiErrorFixResult,
} from '@/features/editor/domain/ai/ai-error-assist';
import { countLatexWords } from '../../domain/document/word-count';
import type {
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
} from '@/features/editor/domain/collaboration/notification-digest';

export type {
  AcademicAiActionParams,
  AcademicAiActionResult,
  AiErrorFixParams,
  AiErrorFixResult,
  PendingBundleInfo,
  NotificationDigest,
  NotificationBundlingSettings,
  EditorStorageItem,
};

// ── Sub-domain: docs.api.ts ──────────────────────────────────────
/**
 * docs.api.ts
 *
 * Document and file management sub-API: CRUD, title, thumbnails, incremental sync, docstore.
 */

export const docs = {
  getById: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiGet<{ page: Page & { docContent?: string } }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`);
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
    const res = await apiPut<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`, payload);
    return res.page;
  },

  updateThumbnail: async (docId: string, dataUrl: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/thumbnail`,
      { pdfThumbnail: dataUrl },
      { silent: true },
    );
    return res.page;
  },

  updateTitle: async (docId: string, title: string, _oldTitle?: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`, { title });
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
    const res = await apiPost<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs`, {
      title,
      content,
      status,
    });
    return res.page;
  },

  delete: async (docId: string): Promise<void> => {
    if (!docId) return;
    await apiDelete(`${MANUSCRIPTS_API_BASE}/docs/${docId}`);
  },

  restore: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPost<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/restore`, {});
    return res.page;
  },

  duplicate: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPost<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/duplicate`, {});
    return res.page;
  },

  getFiles: async (docId: string): Promise<PageFile[]> => {
    try {
      const res = await apiGet<{ files: PageFile[] }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/files`);
      return res.files || [];
    } catch {
      return [];
    }
  },

  syncIncremental: async (
    rootDocId: string,
    dirtyFileIds: string[],
    forceAll?: boolean,
  ): Promise<{ synced: string[] }> => {
    return await apiPost<{ synced: string[] }>(`${MANUSCRIPTS_API_BASE}/docs/${rootDocId}/sync-incremental`, {
      dirtyFileIds,
      forceAll,
    });
  },

  getProjectDocs: async (projectId: string, status?: string, search?: string): Promise<Page[]> => {
    const params: Record<string, string> = {};
    if (status && status !== 'all') params.status = status;
    if (search) params.search = search;
    try {
      const res = await apiGet<{ pages: Page[] }>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs`, { params });
      return res.pages || [];
    } catch {
      return [];
    }
  },

  getAllDocs: async (projectId: string): Promise<DocstoreDocDto[]> => {
    try {
      return await apiGet<DocstoreDocDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc`);
    } catch {
      return [];
    }
  },

  getAllDeletedDocs: async (projectId: string): Promise<DocstoreDocDto[]> => {
    try {
      return await apiGet<DocstoreDocDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc-deleted`);
    } catch {
      return [];
    }
  },

  getAllRanges: async (projectId: string): Promise<Record<string, unknown>> => {
    try {
      return await apiGet<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/ranges`);
    } catch {
      return {};
    }
  },

  getDoc: async (projectId: string, docId: string, includeDeleted = false): Promise<DocstoreDocDto | null> => {
    try {
      return await apiGet<DocstoreDocDto>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}?include_deleted=${includeDeleted}`,
      );
    } catch {
      return null;
    }
  },

  getRawDoc: async (projectId: string, docId: string): Promise<string> => {
    try {
      const res = await rawFetch(
        `${getManuscriptsBaseUrl()}/projects/${projectId}/docs/doc/${docId}/raw`,
        'GET',
        undefined,
        { silent: true },
      );
      if (!res.ok) return '';
      return await res.text();
    } catch {
      return '';
    }
  },

  updateDocLines: async (
    projectId: string,
    docId: string,
    lines: string[],
    rev?: number,
  ): Promise<{ modified: boolean; rev: number }> => {
    return await apiPost<{ modified: boolean; rev: number }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}`,
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
    return await apiPatch<DocstoreDocDto | Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}`, payload);
  },

  archiveDoc: async (projectId: string, docId: string): Promise<void> => {
    await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}/archive`, {});
  },

  archiveAllDocs: async (projectId: string): Promise<void> => {
    await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/archive`, {});
  },

  unarchiveAllDocs: async (projectId: string): Promise<{ unarchived: number }> => {
    return await apiPost<{ unarchived: number }>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/unarchive`, {});
  },
};

// ── Sub-domain: updater.api.ts ──────────────────────────────────────
/**
 * updater.api.ts
 *
 * Document updater service for batch updates, buffer flushing, and state eviction.
 */

export const updater = {
  queueUpdate: async (
    projectId: string,
    docId: string,
    dto: QueueUpdatePayload,
  ): Promise<Record<string, unknown>> => {
    const payload: QueueUpdatePayload = {
      ...dto,
      ...(dto.lines === undefined && dto.docLines !== undefined
        ? { lines: dto.docLines }
        : {}),
      ...(dto.clientRev === undefined && dto.version !== undefined
        ? { clientRev: dto.version }
        : {}),
    };
    return await apiPost<Record<string, unknown>>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/update`,
      payload,
    );
  },

  flushProject: async (
    projectId: string,
    force = false,
  ): Promise<FlushResultDto> => {
    return await apiPost<FlushResultDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/flush`,
      { force },
      { silent: true },
    );
  },

  flushDoc: async (
    projectId: string,
    docId: string,
  ): Promise<{ flushed: boolean; docId: string; version: number }> => {
    return await apiPost<{ flushed: boolean; docId: string; version: number }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/flush`,
      {},
    );
  },

  getDocState: async (
    projectId: string,
    docId: string,
  ): Promise<Record<string, unknown>> => {
    return await apiGet<Record<string, unknown>>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/state`,
    );
  },

  evictDoc: async (
    projectId: string,
    docId: string,
  ): Promise<void> => {
    await apiDelete(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/buffer`,
    );
  },
};

// ── Sub-domain: compiler.api.ts ──────────────────────────────────────
/**
 * compiler.api.ts
 *
 * Compilation sub-API: LaTeX compile, preview compile, word count, aux artifacts, clean aux.
 */

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
      const stats = countLatexWords(source);
      return {
        success: true,
        stats,
      };
    }
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
      const res = await rawFetch(
        `${getManuscriptsBaseUrl()}/projects/${projectId}/artifacts`,
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

  getStatus: async (): Promise<{ status: string; engines: string[]; offline?: boolean }> => {
    try {
      return await apiGet<{ status: string; engines: string[]; offline?: boolean }>(`${MANUSCRIPTS_API_BASE}/clsi/status`);
    } catch {
      return { status: 'degraded', engines: ['pdflatex', 'xelatex', 'lualatex', 'latex'], offline: true };
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

// ── Sub-domain: synctex.api.ts ──────────────────────────────────────
/**
 * synctex.api.ts
 *
 * SyncTeX sub-API: Forward and reverse SyncTeX coordinate synchronization.
 */

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
    }>(`${MANUSCRIPTS_API_BASE}/synctex/forward`, payload);
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
    }>(`${MANUSCRIPTS_API_BASE}/synctex/reverse`, payload);
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

export const synctexService = synctex;

// ── Sub-domain: diagnostics.api.ts ──────────────────────────────────────
/**
 * diagnostics.api.ts
 *
 * Diagnostics, linter, autofix, and explanation sub-API.
 */

export const diagnostics = {
  parseLog: async (logText: string, engine = 'pdflatex'): Promise<DiagnosticReportDto> => {
    if (!logText || !logText.trim() || logText.includes('signal is aborted') || logText.includes('Compilation superseded')) {
      return {
        id: `report-${Date.now()}`,
        isSuccess: true,
        errorsCount: 0,
        warningsCount: 0,
        badboxesCount: 0,
        infoCount: 0,
        totalCount: 0,
        items: [],
      };
    }
    const MAX_LOG_SIZE = 256 * 1024; // 256KB max to stay well within proxy body limits
    const payload =
      logText.length > MAX_LOG_SIZE
        ? logText.slice(logText.length - MAX_LOG_SIZE)
        : logText;

    return await apiPost<DiagnosticReportDto>(
      `${MANUSCRIPTS_API_BASE}/diagnostics/parse-log`,
      { logText: payload, engine },
      { silent: true }
    );
  },

  lint: async (source: string, filename = 'main.tex'): Promise<DiagnosticReportDto> => {
    return await apiPost<DiagnosticReportDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/lint`, { source, filename });
  },

  lintProject: async (projectId: string): Promise<DiagnosticReportDto> => {
    return await apiPost<DiagnosticReportDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/${projectId}/lint`, {});
  },

  autoFix: async (source: string): Promise<AutoFixResultDto> => {
    return await apiPost<AutoFixResultDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/autofix`, { source });
  },

  getExplanation: async (code: string): Promise<ErrorExplanationDto> => {
    return await apiGet<ErrorExplanationDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/explain/${encodeURIComponent(code)}`);
  },

  getRules: async (): Promise<ErrorExplanationDto[]> => {
    return await apiGet<ErrorExplanationDto[]>(`${MANUSCRIPTS_API_BASE}/diagnostics/rules`);
  },
};

import {
  comments,
  suggestions,
  notifications,
  notificationBundlerService,
  search,
  exportDocs,
  history,
} from './collaboration-api.client';
import {
  ai,
  AcademicAiService,
  suggestLatexFix,
} from './ai-api.client';
import {
  structure,
  filestore,
  storage,
  citations,
  templates,
  spelling,
  spellingService,
  gitApi,
  linkedFiles,
  type CustomDictionaryResponse,
  type SpellingSuggestionResponse,
  type MisspelledWord,
  type SpellingReport,
  type CheckSpellingPayload,
  type GitTokenInfo,
  type GitRepoInfo,
} from './manuscript-storage-tree.client';

export type {
  CustomDictionaryResponse,
  SpellingSuggestionResponse,
  MisspelledWord,
  SpellingReport,
  CheckSpellingPayload,
  GitTokenInfo,
  GitRepoInfo,
};

export {
  comments,
  suggestions,
  notifications,
  notificationBundlerService,
  search,
  exportDocs,
  history,
  ai,
  AcademicAiService,
  suggestLatexFix,
  structure,
  filestore,
  storage,
  citations,
  templates,
  spelling,
  spellingService,
  gitApi,
  linkedFiles,
};

export const review = {
  createCommentThread: async (
    projectId: string,
    docId: string,
    payload: {
      startLine?: number;
      startCol?: number;
      endLine?: number;
      endCol?: number;
      quote?: string;
      content: string;
      [key: string]: any;
    },
  ) => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/comments`,
      payload,
    );
  },

  addCommentReply: async (
    projectId: string,
    docId: string,
    threadId: string,
    content: string,
  ) => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/comments/${threadId}/replies`,
      { content },
    );
  },

  resolveCommentThread: async (
    projectId: string,
    docId: string,
    threadId: string,
    resolved: boolean,
  ) => {
    return await apiPatch<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/comments/${threadId}`,
      { resolved },
    );
  },

  acceptChange: async (projectId: string, docId: string, changeId: string) => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/suggestions/${changeId}/accept`,
    );
  },

  rejectChange: async (projectId: string, docId: string, changeId: string) => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/suggestions/${changeId}/reject`,
    );
  },
};

// ── Unified Manuscript Service Facade ─────────────────────────────────────────

export const manuscriptService = {
  docs,
  compiler,
  synctex,
  comments,
  suggestions,
  review,
  history,
  search,
  export: exportDocs,
  structure,
  diagnostics,
  linkedFiles,
  citations,
  templates,
  filestore,
  updater,
  spelling: spellingService,
  storage,
  notifications,
  notificationBundlerService,
  ai,
  AcademicAiService,
  suggestLatexFix,
  git: gitApi,
};

export default manuscriptService;
