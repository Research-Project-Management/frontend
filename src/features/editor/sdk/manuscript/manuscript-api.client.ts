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

import * as api from '@/shared/lib/api';
import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  getAuthToken,
  getEffectiveBaseUrl,
} from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE, getManuscriptsBaseUrl } from './base';
import type {
  DocstoreDocDto,
  StructureNodeDto,
  QueueUpdatePayload,
  FlushResultDto,
  FileMetadataDto,
  DiagnosticReportDto,
  AutoFixResultDto,
  ErrorExplanationDto,
  ExportFileResult,
  BibEntryDto,
  CitationValidationDto,
  LinkedFileDto,
  CreateLinkedFilePayload,
  CompileLatexPayload,
  CompileLatexResponse,
  WordCountResponse,
  PreviewCompileResult,
  AuxFileItem,
  CreateSuggestionPayload,
  ForwardSyncPayload,
  ForwardSyncResult,
  ReverseSyncPayload,
  ReverseSyncResult,
  SearchOptions,
  SearchResultResponse,
  BatchReplaceOptions,
  BatchReplaceResultResponse,
  VersionDiffResponse,
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  VersionLabelItem,
  ImportProjectZipResult,
  ProjectTemplateItem,
  ReconstructedContent,
} from './types';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';
import type { PageVersion, ProjectEvent } from '@/features/editor/domain/types/history.types';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import { uploadBlobWithPresigned } from '@/features/storage';
import { API_BASE_URL } from '@/config/env';
import type {
  AcademicAiActionParams,
  AcademicAiActionResult,
} from '@/features/editor/domain/ai/ai-academic-assistant';
import type {
  AiErrorFixParams,
  AiErrorFixResult,
} from '@/features/editor/domain/ai/ai-error-assist';
import {
  maskLatexEntities,
  getAcademicSystemPrompt,
  applyHeuristicTransformation,
} from '@/features/editor/domain/ai/ai-academic-assistant';
import { heuristicLatexErrorFix } from '@/features/editor/domain/ai/ai-error-assist';
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

  updateContent: async (docId: string, content: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiPut<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`, { content });
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
      const token = getAuthToken();
      const res = await fetch(`${getManuscriptsBaseUrl()}/projects/${projectId}/docs/doc/${docId}/raw`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });
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


// ── Sub-domain: structure.api.ts ──────────────────────────────────────
/**
 * structure.api.ts
 *
 * Project hierarchy, folder tree nodes, root document management sub-API.
 */


export const structure = {
  getTree: async (projectId: string) => {
    return await apiGet(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/tree`);
  },

  getAllNodes: async (projectId: string): Promise<StructureNodeDto[]> => {
    if (!projectId) return [];
    try {
      return await apiGet<StructureNodeDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, { silent: true });
    } catch {
      return [];
    }
  },

  getNodeById: async (projectId: string, nodeId: string): Promise<StructureNodeDto | null> => {
    if (!projectId || !nodeId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}`, { silent: true });
    } catch {
      return null;
    }
  },

  createNode: async (projectId: string, dto: Partial<StructureNodeDto> & { name: string; content?: string }) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, {
      ...dto,
      type: typeof dto?.type === 'string' ? dto.type.toUpperCase() : (dto?.type || 'DOC'),
    });
  },

  moveNode: async (projectId: string, nodeId: string, dto: { parentId?: string | null; destParentId?: string | null; destPath?: string; sortOrder?: number; [key: string]: unknown }) => {
    const payload = {
      ...dto,
      ...(dto.destParentId === undefined && dto.parentId !== undefined
        ? { destParentId: dto.parentId }
        : {}),
    };
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}/move`, payload);
  },

  renameNode: async (projectId: string, nodeId: string, dto: { name: string; [key: string]: unknown }) => {
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}/rename`, dto);
  },

  deleteNode: async (projectId: string, nodeId: string) => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}`);
  },

  getRootDoc: async (projectId: string): Promise<StructureNodeDto | null> => {
    if (!projectId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/root-doc`, { silent: true });
    } catch {
      return null;
    }
  },

  setRootDoc: async (projectId: string, nodeId: string): Promise<StructureNodeDto> => {
    return await apiPost<StructureNodeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/root-doc/${nodeId}`,
      {},
    );
  },

  reorderNode: async (projectId: string, nodeId: string, sortOrder: number): Promise<void> => {
    await apiPost(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}/reorder`,
      { sortOrder },
    );
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


// ── Sub-domain: filestore.api.ts ──────────────────────────────────────
/**
 * filestore.api.ts
 *
 * Filestore binary assets sub-API: Stream URLs, multipart uploads, signed URLs, deletion.
 */


export const filestore = {
  getStreamUrl: (projectId: string, fileId: string): string => {
    return `${MANUSCRIPTS_API_BASE}/projects/${projectId}/files/${fileId}`;
  },

  upload: async (projectId: string, file: File | Blob, filename?: string): Promise<FileMetadataDto> => {
    const name = filename || (file instanceof File ? file.name : 'unnamed.bin');
    const formData = new FormData();
    formData.append('file', file, name);
    const token = getAuthToken();
    const res = await fetch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/files?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`File upload failed: ${res.statusText}`);
    return (await res.json()) as FileMetadataDto;
  },

  getSignedUrl: async (projectId: string, fileId: string, expiresIn = 3600): Promise<{ signedUrl: string | null }> => {
    try {
      return await apiGet<{ signedUrl: string | null }>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/files/${fileId}/signed-url?expiresIn=${expiresIn}`,
      );
    } catch {
      return { signedUrl: null };
    }
  },

  delete: async (projectId: string, fileId: string): Promise<void> => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/files/${fileId}`);
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
};


// ── Sub-domain: storage.api.ts ──────────────────────────────────────
/**
 * storage.api.ts
 *
 * Manuscripts Storage & File Hierarchy Sub-API (Part of manuscriptService SDK).
 * Mirrors Backend modules/storage & project structure:
 *  - S3 / R2 Asset uploads (/api/v1/storage/files/upload, presigned direct R2)
 *  - Storage file & folder hierarchy (/projects/:projectId/structure/nodes)
 *  - Item management (rename, move, delete, root doc)
 */



export type { EditorStorageItem };

export const storage = {
  getProjectFiles: async (projectId: string, parentId?: string | null): Promise<EditorStorageItem[]> => {
    if (!projectId) return [];
    try {
      const endpoint = parentId
        ? `${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes?parentId=${parentId}`
        : `${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`;
      const nodes = await apiGet<StructureNodeDto[]>(endpoint, { silent: true });
      if (Array.isArray(nodes)) {
        return nodes.map((n) => ({
          id: n.id,
          filename: n.name,
          isFolder: n.type?.toUpperCase() === 'FOLDER',
          parentId: n.parentId,
          size: n.sizeBytes,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
        }));
      }
    } catch {
      return [];
    }
    return [];
  },

  getPageFiles: async (pageId: string, parentId?: string | null): Promise<EditorStorageItem[]> => {
    return storage.getProjectFiles(pageId, parentId);
  },

  uploadPageFile: async (
    pageId: string,
    file: File,
    parentId?: string | null,
    onProgress?: (progress: number) => void,
    projectId?: string,
  ): Promise<EditorStorageItem> => {
    const targetProjectId = projectId || pageId;
    const completed = await uploadBlobWithPresigned(file, file.name, {
      projectId: targetProjectId,
      parentId: parentId || null,
      onProgress,
    });

    const id = completed.fileId || '';
    return {
      id,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
      isFolder: false,
      parentId: parentId || null,
      url: completed.url || `/api/v1/storage/files/${id}/content`,
    };
  },

  createFileRecord: async (
    pageId: string,
    params: {
      filename: string;
      size: number;
      mimeType: string;
      url: string;
      parentId?: string | null;
      fileBase64?: string;
    },
    projectId?: string,
  ) => {
    const targetProjectId = projectId || pageId;
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${targetProjectId}/structure/nodes`, {
      name: params.filename,
      type: 'FILE',
      parentId: params.parentId ?? null,
      url: params.url,
      sizeBytes: params.size,
      mimeType: params.mimeType,
    });
  },

  createFile: async (
    projectId: string,
    name: string,
    parentId?: string | null,
    content?: string,
  ) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, {
      name,
      type: 'DOC',
      parentId: parentId ?? null,
      ...(content !== undefined ? { content } : {}),
    });
  },

  createFolder: async (projectId: string, name: string, parentId?: string | null) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, {
      name,
      type: 'FOLDER',
      parentId: parentId ?? null,
    });
  },

  createPageFolder: async (pageId: string, name: string, parentId?: string | null) => {
    return storage.createFolder(pageId, name, parentId);
  },

  createProjectFolder: async (projectId: string, name: string, parentId?: string | null) => {
    return storage.createFolder(projectId, name, parentId);
  },

  renameItem: async (itemId: string, name: string, projectId?: string) => {
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}/rename`, { name });
  },

  deleteItem: async (itemId: string, projectId?: string) => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}`);
  },

  permanentlyDeleteItem: async (itemId: string, projectId?: string) => {
    return storage.deleteItem(itemId, projectId);
  },

  moveItem: async (itemId: string, targetFolderId: string | null, projectId?: string) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}/move`, {
      destParentId: targetFolderId,
    });
  },

  reorderItem: async (itemId: string, sortOrder: number, projectId?: string) => {
    if (!projectId) return null;
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}/reorder`, {
      sortOrder,
    });
  },

  setRootDoc: async (nodeId: string, projectId: string) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/root-doc/${nodeId}`, {});
  },

  getRootDoc: async (projectId: string): Promise<StructureNodeDto | null> => {
    if (!projectId) return null;
    try {
      return await apiGet<StructureNodeDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/root-doc`, { silent: true });
    } catch {
      return null;
    }
  },
};






// ── Sub-domain: citations.api.ts ──────────────────────────────────────
/**
 * citations.api.ts
 *
 * Citations and bibliography sub-API: Search, resolve, validation, library sync, raw parsing.
 */


export const citations = {
  search: async (projectId: string, query = '', limit = 20): Promise<BibEntryDto[]> => {
    return await apiGet<BibEntryDto[]>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },

  resolve: async (projectId: string, identifier: string): Promise<{ success: boolean; entry: BibEntryDto }> => {
    return await apiPost<{ success: boolean; entry: BibEntryDto }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/resolve`,
      { identifier },
    );
  },

  validate: async (projectId: string): Promise<CitationValidationDto> => {
    return await apiGet<CitationValidationDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/validate`);
  },

  syncLibrary: async (
    projectId: string,
    dto: { provider?: string; collectionId: string; collectionName?: string; targetBibFile?: string; targetFilename?: string },
  ) => {
    const payload = {
      ...dto,
      ...(dto.targetBibFile && !dto.targetFilename ? { targetFilename: dto.targetBibFile } : {}),
    };
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/sync-library`, payload);
  },

  listLibraryCollections: async (): Promise<Array<Record<string, unknown>>> => {
    try {
      return await apiGet<Array<Record<string, unknown>>>(`${MANUSCRIPTS_API_BASE}/citations/library-collections`);
    } catch {
      return [];
    }
  },

  parseRaw: async (rawBibtex: string): Promise<BibEntryDto[]> => {
    try {
      return await apiPost<BibEntryDto[]>(`${MANUSCRIPTS_API_BASE}/citations/parse-raw`, { rawBibtex });
    } catch {
      return [];
    }
  },
};


// ── Sub-domain: templates.api.ts ──────────────────────────────────────
/**
 * templates.api.ts
 *
 * Templates & gallery sub-API: List, search, retrieve, instantiate, custom templates, scaffolding.
 */


export const templates = {
  list: async (query?: { category?: string; search?: string; limit?: number; skip?: number; offset?: number }): Promise<ProjectTemplateItem[]> => {
    const params: Record<string, string> = {};
    if (query?.category) params.category = query.category;
    if (query?.search) params.search = query.search;
    if (query?.limit) params.limit = String(query.limit);
    if (query?.skip !== undefined) {
      params.skip = String(query.skip);
      params.offset = String(query.skip);
    } else if (query?.offset !== undefined) {
      params.offset = String(query.offset);
    }
    const res = await apiGet<ProjectTemplateItem[] | { templates?: ProjectTemplateItem[] }>(`${MANUSCRIPTS_API_BASE}/projects/templates`, { params });
    return Array.isArray(res) ? res : res?.templates || [];
  },

  search: async (query: { q?: string; category?: string; tags?: string[] }): Promise<ProjectTemplateItem[]> => {
    const params: Record<string, string> = {};
    if (query.q) params.q = query.q;
    if (query.category) params.category = query.category;
    const res = await apiGet<ProjectTemplateItem[] | { templates?: ProjectTemplateItem[] }>(`${MANUSCRIPTS_API_BASE}/templates/search`, { params });
    return Array.isArray(res) ? res : res?.templates || [];
  },

  getById: async (id: string): Promise<ProjectTemplateItem | null> => {
    return await apiGet<ProjectTemplateItem>(`${MANUSCRIPTS_API_BASE}/templates/${id}`);
  },

  instantiate: async (templateId: string, projectName: string): Promise<{ projectId: string; [key: string]: unknown }> => {
    return await apiPost<{ projectId: string; [key: string]: unknown }>(`${MANUSCRIPTS_API_BASE}/templates/instantiate`, { templateId, projectName });
  },

  createCustom: async (dto: Record<string, unknown>): Promise<ProjectTemplateItem> => {
    return await apiPost<ProjectTemplateItem>(`${MANUSCRIPTS_API_BASE}/templates/custom`, dto);
  },

  scaffold: async (projectId: string, templateId: string): Promise<Record<string, unknown>> => {
    return await apiPost<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/templates/scaffold`, { projectId, templateId });
  },
};


// ── Sub-domain: spelling.api.ts ──────────────────────────────────────
/**
 * spelling.api.ts
 *
 * Manuscripts Spelling & Custom Dictionaries Sub-API (Part of manuscriptService SDK).
 * - Check document spelling
 * - Get candidate suggestions
 * - Manage learned words (List, Add, Remove) for Project & User dictionaries
 */


export interface CustomDictionaryResponse {
  words: string[];
}

export interface SpellingSuggestionResponse {
  word: string;
  suggestions: string[];
}

export interface MisspelledWord {
  word: string;
  line: number;
  col: number;
  length: number;
  suggestions: string[];
}

export interface SpellingReport {
  language: string;
  totalWordsChecked: number;
  misspelledCount: number;
  errors: MisspelledWord[];
}

export interface CheckSpellingPayload {
  text?: string;
  docId?: string;
  language?: string;
}

export const spelling = {
  /**
   * Check LaTeX document spelling and return errors with suggestions.
   */
  checkSpelling: async (
    projectId: string,
    payload: CheckSpellingPayload,
  ): Promise<SpellingReport> => {
    try {
      const res = await apiPost<SpellingReport>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/check`,
        payload,
      );
      return res;
    } catch {
      return {
        language: payload.language || 'en-US',
        totalWordsChecked: 0,
        misspelledCount: 0,
        errors: [],
      };
    }
  },

  /**
   * List custom words learned for a specific project.
   */
  getProjectDictionary: async (projectId: string): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  /**
   * Add a word to the project's custom dictionary.
   */
  learnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  /**
   * Remove a word from the project's custom dictionary.
   */
  unlearnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/spelling/dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  /**
   * List personal custom words learned across all projects for the current user.
   */
  getUserDictionary: async (): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `${MANUSCRIPTS_API_BASE}/spelling/user-dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  /**
   * Add a word to the user's personal dictionary.
   */
  learnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/spelling/user-dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  /**
   * Remove a word from the user's personal dictionary.
   */
  unlearnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${MANUSCRIPTS_API_BASE}/spelling/user-dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  /**
   * Get suggestions for a misspelled word.
   */
  getSuggestions: async (word: string, language: string = 'en_US'): Promise<string[]> => {
    try {
      const res = await apiGet<SpellingSuggestionResponse>(
        `${MANUSCRIPTS_API_BASE}/spelling/suggestions?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`,
      );
      return res?.suggestions || [];
    } catch {
      return [];
    }
  },
};

export const spellingService = spelling;




// ── Sub-domain: git.api.ts ──────────────────────────────────────
/**
 * git.api.ts
 *
 * Git Smart-HTTP & Git Access Token sub-API for Manuscripts.
 */


export interface GitTokenInfo {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface GitRepoInfo {
  enabled: boolean;
  cloneUrl: string;
  branch: string;
  canPush: boolean;
  tokens: GitTokenInfo[];
}

export const gitApi = {
  getRepoInfo: async (projectId: string): Promise<GitRepoInfo> => {
    return apiGet<GitRepoInfo>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/git`);
  },

  listTokens: async (): Promise<{ tokens: GitTokenInfo[] }> => {
    return apiGet<{ tokens: GitTokenInfo[] }>(`${MANUSCRIPTS_API_BASE}/git/tokens`);
  },

  createToken: async (label?: string): Promise<{ token: string }> => {
    return apiPost<{ token: string }>(`${MANUSCRIPTS_API_BASE}/git/tokens`, { label });
  },

  revokeToken: async (tokenId: string): Promise<{ success: boolean }> => {
    return apiDelete<{ success: boolean }>(`${MANUSCRIPTS_API_BASE}/git/tokens/${tokenId}`);
  },
};


// ── Sub-domain: linked-files.api.ts ──────────────────────────────────────
/**
 * linked-files.api.ts
 *
 * Linked external files sub-API: URL imports, Zotero, Mendeley, Dropbox, GitHub syncing.
 */


export const linkedFiles = {
  list: async (projectId: string): Promise<LinkedFileDto[]> => {
    return await apiGet<LinkedFileDto[]>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files`);
  },

  create: async (projectId: string, payload: CreateLinkedFilePayload): Promise<LinkedFileDto> => {
    const body = {
      ...payload,
      provider: payload.provider || (payload.providerType ? payload.providerType.toLowerCase() : 'url'),
    };
    return await apiPost<LinkedFileDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files`, body);
  },

  refresh: async (projectId: string, fileId: string): Promise<LinkedFileDto> => {
    return await apiPost<LinkedFileDto>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files/${fileId}/refresh`, {});
  },

  delete: async (projectId: string, fileId: string, deleteNode = false): Promise<void> => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/linked-files/${fileId}?deleteNode=${deleteNode}`);
  },

  refreshAll: async (projectId?: string): Promise<{ refreshedCount: number }> => {
    return await apiPost<{ refreshedCount: number }>(`${MANUSCRIPTS_API_BASE}/linked-files/refresh-all`, { projectId });
  },
};



// ── Unified Manuscript Service Facade ─────────────────────────────────────────

export const manuscriptService = {
  docs,
  compiler,
  synctex,
  comments,
  suggestions,
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

