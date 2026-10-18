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
  CollaborationPresence,
  CollaborationEvent,
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
  DocReviewsResponseDto,
  TextRangeDto,
  TrackChangeDto,
  CommentThreadDto,
  CommentReplyDto,
  SearchOptions,
  SearchResultResponse,
  BatchReplaceOptions,
  BatchReplaceResultResponse,
  VersionDiffResponse,
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
  VersionLabelItem,
  ImportProjectZipResult,
  ProjectTemplateItem,
  OpLogTimeline,
  ReconstructedContent,
} from './types';
import type { Page, PageFile } from '@/features/editor/domain/types/core.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';
import type { PageVersion, ProjectEvent } from '@/features/editor/domain/types/history.types';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';
import type { EditorStorageItem } from '@/features/editor/domain/types/storage-item.types';
import { presignUpload, completePresigned } from '@/features/storage/services/upload.service';
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


// ── Sub-domain: comments.api.ts ──────────────────────────────────────
/**
 * comments.api.ts
 *
 * Comments & discussions sub-API: Threads, replies, resolution, deletion.
 */


export const comments = {
  getComments: async (docId: string, status?: string): Promise<PageComment[]> => {
    if (!docId) return [];
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const data = await apiGet<{ comments: PageComment[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments${query}`,
        { silent: true },
      );
      return data.comments || [];
    } catch {
      return [];
    }
  },

  createComment: async (
    docId: string,
    payload: {
      content: string;
      line?: number;
      lineEnd?: number;
      projectId?: string;
    },
  ): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments`,
      payload,
    );
    return data.comment;
  },

  updateComment: async (
    docId: string,
    commentId: string,
    payload: { content?: string; status?: 'open' | 'resolved' } | string,
  ): Promise<PageComment> => {
    const body = typeof payload === 'string' ? { content: payload } : payload;
    const data = await apiPatch<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}`,
      body,
    );
    return data.comment;
  },

  deleteComment: async (docId: string, commentId: string): Promise<void> => {
    await apiDelete(`${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}`);
  },

  deleteReply: async (
    docId: string,
    commentId: string,
    replyId: string,
  ): Promise<PageComment> => {
    const data = await apiDelete<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}/replies/${replyId}`,
    );
    return data.comment;
  },

  addReply: async (
    docId: string,
    commentId: string,
    content: string,
  ): Promise<PageComment> => {
    const data = await apiPost<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}/reply`,
      { content },
    );
    return data.comment;
  },

  resolveComment: async (
    docId: string,
    commentId: string,
    resolved: boolean,
  ): Promise<PageComment> => {
    const data = await apiPatch<{ comment: PageComment }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/comments/${commentId}/resolve`,
      { resolved },
    );
    return data.comment;
  },
};


// ── Sub-domain: suggestions.api.ts ──────────────────────────────────────
/**
 * suggestions.api.ts
 *
 * Review suggestions sub-API: Accept, reject, create suggestions.
 */


export const suggestions = {
  getSuggestions: async (
    docId: string,
    status?: SuggestionStatus,
  ): Promise<PageSuggestion[]> => {
    if (!docId) return [];
    try {
      const queryStr = status ? `?status=${status}` : '';
      const data = await apiGet<{ suggestions: PageSuggestion[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions${queryStr}`,
        { silent: true },
      );
      return data.suggestions || [];
    } catch {
      return [];
    }
  },

  createSuggestion: async (payload: CreateSuggestionPayload): Promise<PageSuggestion> => {
    const { pageId, ...body } = payload;
    const data = await apiPost<{ suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${pageId}/suggestions`,
      body,
    );
    return data.suggestion;
  },

  acceptSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion; page: Page }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion; page: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/accept`,
      {},
    );
  },

  rejectSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion }> => {
    return await apiPost<{ ok: boolean; suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/reject`,
      {},
    );
  },

  acceptAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; acceptedCount: number; page?: Page }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/accept-all`,
      {},
    );
  },

  rejectAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/reject-all`,
      {},
    );
  },

  acceptSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; acceptedCount: number; page?: Page }> => {
    return await apiPost<{ ok: boolean; acceptedCount: number; page?: Page }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/accept-all`,
      { suggestionIds },
    );
  },

  rejectSelectedSuggestions: async (
    docId: string,
    suggestionIds: string[],
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/reject-all`,
      { suggestionIds },
    );
  },
};


// ── Sub-domain: review.api.ts ──────────────────────────────────────
/**
 * review.api.ts
 *
 * Review & Track Changes sub-API: Tracked changes, comment threads, batch resolution.
 */

/** Converts a 0-based absolute character offset into a 0-based line/column pair. */
export function offsetToLineCol(content: string, offset: number): { line: number; col: number } {
  const clamped = Math.max(0, Math.min(offset, content.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < clamped; i++) {
    if (content.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: clamped - lineStart };
}

/** Converts absolute offsets [from, to) into the backend TextRange contract. */
export function offsetsToRange(content: string, fromIndex: number, toIndex: number): TextRangeDto {
  const a = Math.min(fromIndex, toIndex);
  const b = Math.max(fromIndex, toIndex);
  const s = offsetToLineCol(content, a);
  const e = offsetToLineCol(content, b);
  return { startLine: s.line, startCol: s.col, endLine: e.line, endCol: e.col };
}

interface RangeSource {
  range?: TextRangeDto;
  /** Full document text; required to convert fromIndex/toIndex on multi-line docs. */
  content?: string;
  fromIndex?: number;
  toIndex?: number;
  startLine?: number;
  startCol?: number;
  endLine?: number;
  endCol?: number;
}

export function resolveRange(src: RangeSource): TextRangeDto {
  if (src.range) return src.range;
  if (src.startLine !== undefined) {
    return {
      startLine: src.startLine,
      startCol: src.startCol ?? 0,
      endLine: src.endLine ?? src.startLine,
      endCol: src.endCol ?? src.startCol ?? 0,
    };
  }
  if (src.fromIndex !== undefined) {
    const to = src.toIndex ?? src.fromIndex;
    if (typeof src.content === 'string') {
      return offsetsToRange(src.content, src.fromIndex, to);
    }
    throw new Error('review: fromIndex/toIndex require `content` to compute a line/column range');
  }
  throw new Error('review: a range (range, startLine/startCol, or fromIndex+content) is required');
}

export interface RecordChangeInput {
  type: 'insert' | 'delete';
  text: string;
  range?: TextRangeDto;
  content?: string;
  fromIndex?: number;
  toIndex?: number;
  startLine?: number;
  startCol?: number;
  endLine?: number;
  endCol?: number;
}

export interface CreateCommentThreadInput {
  content: string;
  quote?: string;
  selectedText?: string;
  range?: TextRangeDto;
  /** Full document text used to convert fromIndex/toIndex into line/column. */
  docContent?: string;
  fromIndex?: number;
  toIndex?: number;
  startLine?: number;
  startCol?: number;
  endLine?: number;
  endCol?: number;
}

export const review = {
  getDocReviews: async (projectId: string, docId: string): Promise<DocReviewsResponseDto> => {
    if (!projectId || !docId) {
      return { changes: [], threads: [] };
    }
    try {
      return await apiGet<DocReviewsResponseDto>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review`,
        { silent: true },
      );
    } catch {
      return { changes: [], threads: [] };
    }
  },

  recordChange: async (
    projectId: string,
    docId: string,
    dto: RecordChangeInput,
  ): Promise<TrackChangeDto> => {
    const range: TextRangeDto = resolveRange(dto);
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes`,
      {
        type: dto.type,
        text: dto.text,
        range,
      },
    );
  },

  acceptChange: async (projectId: string, docId: string, changeId: string): Promise<TrackChangeDto> => {
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes/${changeId}/accept`,
      {},
    );
  },

  rejectChange: async (projectId: string, docId: string, changeId: string): Promise<TrackChangeDto> => {
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes/${changeId}/reject`,
      {},
    );
  },

  batchResolveChanges: async (
    projectId: string,
    docId: string,
    action: 'accept_all' | 'reject_all' | 'accept_selected' | 'reject_selected',
    changeIds?: string[],
  ): Promise<{ resolvedCount: number; action: string }> => {
    return await apiPost<{ resolvedCount: number; action: string }>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes/batch`,
      { action, changeIds },
    );
  },

  createCommentThread: async (
    projectId: string,
    docId: string,
    dto: CreateCommentThreadInput,
  ): Promise<CommentThreadDto> => {
    const range: TextRangeDto = resolveRange({ ...dto, content: dto.docContent });
    return await apiPost<CommentThreadDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads`,
      {
        content: dto.content,
        quote: dto.quote || dto.selectedText,
        range,
      },
    );
  },

  addCommentReply: async (
    projectId: string,
    docId: string,
    threadId: string,
    content: string,
  ): Promise<CommentReplyDto> => {
    return await apiPost<CommentReplyDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads/${threadId}/replies`,
      { content },
    );
  },

  resolveCommentThread: async (
    projectId: string,
    docId: string,
    threadId: string,
    resolve: boolean,
  ): Promise<CommentThreadDto> => {
    return await apiPatch<CommentThreadDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads/${threadId}/resolve`,
      { resolve },
    );
  },
};


// ── Sub-domain: collaboration.api.ts ──────────────────────────────────────
/**
 * collaboration.api.ts
 *
 * Real-time presence, heartbeat, and Server-Sent Events (SSE) synchronization sub-API.
 */


export const collaboration = {
  getPresence: async (docId: string): Promise<CollaborationPresence[]> => {
    if (!docId) return [];
    try {
      const res = await apiGet<{ activeUsers?: CollaborationPresence[]; presence?: CollaborationPresence[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/presence`,
        { silent: true },
      );
      return res.activeUsers || res.presence || [];
    } catch {
      return [];
    }
  },

  sendHeartbeat: async (
    docId: string,
    cursor?: {
      line: number;
      column: number;
      selection?: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
    },
  ): Promise<void> => {
    if (!docId) return;
    try {
      await apiPost(`${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/heartbeat`, { cursor }, { silent: true });
    } catch {
      // ignore
    }
  },

  leaveRoom: async (docId: string): Promise<void> => {
    if (!docId) return;
    try {
      await apiPost(`${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/leave`, {}, { silent: true });
    } catch {
      // ignore
    }
  },

  createCollaborationStream: (
    projectId: string | null | undefined,
    docId: string,
    onEvent: (event: CollaborationEvent) => void,
    onError?: (err: unknown) => void,
  ): (() => void) => {
    if (typeof window === 'undefined') return () => {};

    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    const path = projectId
      ? `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/collaboration/stream`
      : `${MANUSCRIPTS_API_BASE}/docs/${docId}/collaboration/stream`;
    const baseUrl = getEffectiveBaseUrl().replace(/\/+$/, '');
    const url = `${baseUrl}${path}${tokenQuery}`;
    const eventSource = new EventSource(url, { withCredentials: true });

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed as CollaborationEvent);
      } catch {
        // non-json message, ignore
      }
    };

    if (onError) {
      eventSource.onerror = (err) => onError(err);
    }

    return () => {
      eventSource.close();
    };
  },
};


// ── Sub-domain: notifications.api.ts ──────────────────────────────────────
/**
 * notifications.api.ts
 *
 * Review Notification Bundling Sub-API (Part of manuscriptService SDK).
 * Implements Overleaf-parity 10-minute review notification bundling endpoints.
 */

export const notifications = {
  getPendingBundles: async (): Promise<PendingBundleInfo[]> => {
    try {
      const data = await api.apiGet<{ bundles: PendingBundleInfo[] }>(
        '/api/documents/notifications/bundles',
      );
      return data.bundles || [];
    } catch {
      return [];
    }
  },

  flushBundle: async (
    scopeId?: string,
    projectId?: string,
  ): Promise<NotificationDigest | null> => {
    try {
      const data = await api.apiPost<{ digest: NotificationDigest }>(
        '/api/documents/notifications/bundles/flush',
        { scopeId, projectId },
      );
      return data.digest || null;
    } catch {
      return null;
    }
  },

  getDigestHistory: async (limit = 20): Promise<NotificationDigest[]> => {
    try {
      const data = await api.apiGet<{ digests: NotificationDigest[] }>(
        '/api/documents/notifications/digests',
        { params: { limit } },
      );
      return data.digests || [];
    } catch {
      return [];
    }
  },

  getSettings: async (): Promise<NotificationBundlingSettings> => {
    try {
      const data = await api.apiGet<{ settings: NotificationBundlingSettings }>(
        '/api/documents/notifications/settings',
      );
      return data.settings || { enabled: false, windowMinutes: 10 };
    } catch {
      return { enabled: false, windowMinutes: 10 };
    }
  },

  updateSettings: async (
    settings: Partial<NotificationBundlingSettings>,
  ): Promise<NotificationBundlingSettings> => {
    try {
      const data = await api.apiPut<{ settings: NotificationBundlingSettings }>(
        '/api/documents/notifications/settings',
        settings,
      );
      return data.settings || { enabled: false, windowMinutes: 10 };
    } catch {
      return { enabled: false, windowMinutes: 10 };
    }
  },
};

export const notificationBundlerService = notifications;


// ── Sub-domain: search.api.ts ──────────────────────────────────────
/**
 * search.api.ts
 *
 * Full-text search and atomic batch replacement sub-API across project files.
 */

export const search = {
  search: async (
    projectId: string,
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResultResponse> => {
    return apiPost<SearchResultResponse>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/search`,
      {
        query,
        ...options,
      },
    );
  },

  batchReplace: async (
    projectId: string,
    query: string,
    replaceWith: string,
    options: BatchReplaceOptions = {},
  ): Promise<BatchReplaceResultResponse> => {
    return apiPost<BatchReplaceResultResponse>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/replace`,
      {
        query,
        replaceWith,
        ...options,
      },
    );
  },
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
    if (!pageId) return [];
    try {
      const endpoint = parentId
        ? `${MANUSCRIPTS_API_BASE}/projects/${pageId}/structure/nodes?parentId=${parentId}`
        : `${MANUSCRIPTS_API_BASE}/projects/${pageId}/structure/nodes`;
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

  uploadPageFile: async (
    pageId: string,
    file: File,
    parentId?: string | null,
    onProgress?: (progress: number) => void,
    projectId?: string,
  ): Promise<EditorStorageItem> => {
    const targetProjectId = projectId || pageId;
    const presignRes = await presignUpload({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      projectId: targetProjectId,
    });

    const uploadUrl = presignRes?.uploadUrl;
    if (!uploadUrl || !presignRes?.storageKey) {
      throw new Error('Failed to obtain presigned upload URL');
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Direct R2 upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Direct R2 upload network error'));
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });

    const completed = await completePresigned({
      storageKey: presignRes.storageKey,
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      projectId: targetProjectId,
      parentId: parentId || null,
    });

    return {
      id: completed.fileId || completed.id,
      filename: completed.filename || file.name,
      size: typeof completed.size === 'number' ? completed.size : file.size,
      mimeType: completed.mimeType || file.type,
      isFolder: false,
      parentId: parentId || null,
      url: completed.url || `/api/v1/storage/files/${completed.fileId || completed.id}/content`,
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
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${pageId}/structure/nodes`, {
      name,
      type: 'FOLDER',
      parentId: parentId ?? null,
    });
  },

  createProjectFolder: async (projectId: string, name: string, parentId?: string | null) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, {
      name,
      type: 'FOLDER',
      parentId: parentId ?? null,
    });
  },

  renameItem: async (itemId: string, name: string, projectId?: string) => {
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}/rename`, { name });
  },

  deleteItem: async (itemId: string, projectId?: string) => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}`);
  },

  permanentlyDeleteItem: async (itemId: string, projectId?: string) => {
    return await apiDelete(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${itemId}`);
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

export const files = storage;
export const StorageService = storage;
export const EditorStorageService = storage;


// ── Sub-domain: export.api.ts ──────────────────────────────────────
/**
 * export.api.ts
 *
 * Multi-format export/import sub-API: PDF, ZIP packages, format conversion, template scaffolding.
 */


export const exportDocs = {
  exportDocument: async (
    docId: string,
    format: DocumentExportFormat,
    includeChildren = true,
  ): Promise<ExportFileResult> => {
    return apiPost<ExportFileResult>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/export`, {
      format,
      includeChildren,
    });
  },

  exportProjectZipUrl: (projectId: string, includeAux = false): string => {
    const token = getAuthToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}&includeAux=${includeAux}` : `?includeAux=${includeAux}`;
    return `${MANUSCRIPTS_API_BASE}/projects/${projectId}/export/zip${tokenQuery}`;
  },

  exportProjectZip: async (
    projectId: string,
    options: { includeAux?: boolean; includePdf?: boolean; cleanArxiv?: boolean; projectName?: string } = {},
  ): Promise<Blob> => {
    const token = getAuthToken();
    const params = new URLSearchParams();
    if (options.includeAux) params.append('includeAux', 'true');
    if (options.includePdf) params.append('includePdf', 'true');
    if (options.cleanArxiv) params.append('cleanArxiv', 'true');
    if (options.projectName) params.append('projectName', options.projectName);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${getManuscriptsBaseUrl()}/projects/${projectId}/export/zip${queryString}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    if (!res.ok) throw new Error(`Export ZIP failed: ${res.statusText}`);
    return await res.blob();
  },

  importProjectZip: async (projectId: string, file: File | Blob, preferredRootDoc?: string): Promise<ImportProjectZipResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = preferredRootDoc ? `?preferredRootDoc=${encodeURIComponent(preferredRootDoc)}` : '';
    const token = getAuthToken();
    const res = await fetch(`${getManuscriptsBaseUrl()}/projects/${projectId}/import/zip${query}`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    if (!res.ok) throw new Error(`Import ZIP failed: ${res.statusText}`);
    return (await res.json()) as ImportProjectZipResult;
  },

  scaffoldTemplate: async (projectId: string, templateId: string): Promise<Record<string, unknown>> => {
    return await apiPost<Record<string, unknown>>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/templates/${templateId}/scaffold`, {});
  },

  convertDocument: async (
    projectId: string,
    file: File | Blob,
    format?: 'docx' | 'md',
  ): Promise<Record<string, unknown>> => {
    const formData = new FormData();
    formData.append('file', file);
    const query = format ? `?format=${encodeURIComponent(format)}` : '';
    const token = getAuthToken();
    const res = await fetch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/import/convert${query}`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      body: formData,
    });
    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(errJson?.message || `Document conversion failed: ${res.statusText}`);
    }
    return (await res.json()) as Record<string, unknown>;
  },
};


// ── Sub-domain: history.api.ts ──────────────────────────────────────
/**
 * history.api.ts
 *
 * History, snapshot revisions, diffing, and audit log sub-API.
 */

export const history = {
  getByDocId: async (docId: string): Promise<PageVersion[]> => {
    if (!docId) return [];
    try {
      const res = await apiGet<{ versions: PageVersion[] }>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/versions`,
        { silent: true },
      );
      return res.versions || [];
    } catch {
      return [];
    }
  },

  getById: async (docId: string, versionId: string): Promise<PageVersion | null> => {
    try {
      const res = await apiGet<{ version: PageVersion }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/versions/${versionId}`);
      return res.version || null;
    } catch {
      return null;
    }
  },

  save: async (payload: {
    pageId: string;
    label?: string;
    content?: string;
    eventType?: string;
    fileName?: string;
    rootPageId?: string;
  }): Promise<PageVersion> => {
    const res = await apiPost<{ version: PageVersion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${payload.pageId}/versions`,
      payload,
    );
    return res.version;
  },

  restore: async (payload: { pageId: string; versionId: string }): Promise<void> => {
    await apiPost(`${MANUSCRIPTS_API_BASE}/docs/${payload.pageId}/versions/${payload.versionId}/restore`, {});
  },

  updateLabel: async (
    docId: string,
    versionId: string,
    label: string,
    title?: string,
  ): Promise<PageVersion> => {
    const res = await apiPost<{ version: PageVersion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/versions/${versionId}/label`,
      { label, title },
    );
    return res.version;
  },

  getDiff: async (
    docId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<VersionDiffResponse> => {
    try {
      return await apiGet<VersionDiffResponse>(
        `${MANUSCRIPTS_API_BASE}/docs/${docId}/versions/diff?from=${fromVersionId}&to=${toVersionId}`,
      );
    } catch {
      return {
        fromVersionId,
        toVersionId,
        fromContent: '',
        toContent: '',
        diff: '',
        chunks: [],
        stats: { additions: 0, deletions: 0, addedLines: 0, deletedLines: 0, unchangedLines: 0 },
      };
    }
  },

  compareVersions: async (
    docId: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<VersionDiffResponse> => {
    return history.getDiff(docId, fromVersionId, toVersionId);
  },

  getByProjectId: async (projectId: string): Promise<ProjectEvent[]> => {
    try {
      const res = await apiGet<ProjectVersionListItem[]>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions`,
      );
      if (Array.isArray(res) && res.length > 0) {
        return res.map((s) => ({
          id: s.id,
          versionNumber: s.version,
          title: s.summary || `Version ${s.version}`,
          label: s.labels?.[0]?.label || s.label || s.summary || '',
          fileName: s.fileName || s.label || 'Project Snapshot',
          createdAt: s.createdAt,
          savedBy: {
            id: s.author?.id || s.createdBy?.id || s.createdById || 'user-1',
            name: s.author?.name || s.createdBy?.name || (s.createdById ? 'Collaborator' : 'You'),
          },
          sizeBytes: s.sizeBytes ?? 0,
          eventType: s.isAutomatic ? 'auto_save' : 'manual_save',
          page: projectId,
        }));
      }
      return [];
    } catch {
      return [];
    }
  },

  getProjectVersions: async (projectId: string): Promise<ProjectVersionListItem[]> => {
    try {
      const res = await apiGet<ProjectVersionListItem[]>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions`,
      );
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  },

  getProjectSnapshot: async (
    projectId: string,
    version: number,
  ): Promise<ProjectSnapshotDetail | null> => {
    try {
      return await apiGet<ProjectSnapshotDetail>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions/${version}`,
      );
    } catch {
      return null;
    }
  },

  compareProjectVersions: async (
    projectId: string,
    baseVersion: number,
    targetVersion: number,
  ): Promise<ProjectDiffResponse | null> => {
    try {
      return await apiGet<ProjectDiffResponse>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/diff?baseVersion=${baseVersion}&targetVersion=${targetVersion}`,
      );
    } catch {
      return null;
    }
  },

  labelProjectVersion: async (
    projectId: string,
    version: number,
    label: string,
  ): Promise<VersionLabelItem | null> => {
    return apiPost<VersionLabelItem>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions/${version}/labels`,
      { label },
    );
  },

  deleteProjectLabel: async (projectId: string, labelId: string): Promise<void> => {
    await apiDelete(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/labels/${labelId}`,
    );
  },

  restoreProjectVersion: async (
    projectId: string,
    targetVersion: number,
  ): Promise<{
    restoredSnapshot: ProjectSnapshotDetail;
    newSnapshot: ProjectSnapshotDetail;
    restoreResult: { restoredFilesCount: number; restoredDocIds: string[] };
  }> => {
    return apiPost(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/restore`,
      { targetVersion },
    );
  },

  createProjectSnapshot: async (
    projectId: string,
    dto: { summary?: string; label?: string; isAutomatic?: boolean },
  ): Promise<ProjectSnapshotDetail> => {
    return apiPost<ProjectSnapshotDetail>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/snapshots`,
      dto,
    );
  },

  getTimeline: async (
    docId: string,
    _from?: string | number,
    _to?: string | number,
  ): Promise<OpLogTimeline> => {
    try {
      return await apiGet<OpLogTimeline>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/timeline`);
    } catch {
      return { entries: [], oldestMs: Date.now() - 3600000, newestMs: Date.now() };
    }
  },

  getContentAt: async (
    docId: string,
    t: string | number,
  ): Promise<ReconstructedContent> => {
    try {
      const query = t !== undefined && t !== null ? `?timestamp=${encodeURIComponent(String(t))}` : '';
      return await apiGet<ReconstructedContent>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/at${query}`);
    } catch {
      return { content: '', timestamp: Date.now() };
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
    const res = await apiGet<ProjectTemplateItem[] | { templates?: ProjectTemplateItem[] }>(`${MANUSCRIPTS_API_BASE}/templates`, { params });
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


// ── Sub-domain: ai.api.ts ──────────────────────────────────────
/**
 * ai.api.ts
 *
 * AI Academic Assistant & LaTeX Error Repair Sub-API (Part of manuscriptService SDK).
 * Connects frontend editor and logs to /api/ai/chat/sync endpoint, backed by
 * domain-level macro masking and robust offline heuristics.
 */
export class AcademicAiService {
  /**
   * Execute an academic AI action on selected text.
   */
  public static async executeAction(params: AcademicAiActionParams): Promise<AcademicAiActionResult> {
    const { action, selectedText, customPrompt } = params;
    const trimmed = selectedText.trim();

    if (!trimmed) {
      return {
        success: false,
        originalText: selectedText,
        suggestedText: selectedText,
        explanation: 'No text selected.',
        action,
        diffSummary: {
          charsOriginal: 0,
          charsSuggested: 0,
          wordsOriginal: 0,
          wordsSuggested: 0,
        },
      };
    }

    // 1. Mask LaTeX entities (equations, citations, labels)
    const { maskedText, unmask } = maskLatexEntities(trimmed);

    let suggestedResult = '';
    let explanation = '';

    try {
      const systemPrompt = getAcademicSystemPrompt(action, customPrompt);
      const promptText = `Text to edit:\n"""\n${maskedText}\n"""`;

      const json = await apiPost<Record<string, unknown>>('/api/ai/chat/sync', {
        query: promptText,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
        model: 'fast',
      }, { silent: true });

      const data = (json?.data && typeof json.data === 'object' ? json.data : json) as Record<string, unknown>;
      const rawAiText =
        typeof data?.content === 'string'
          ? data.content
          : typeof data?.message === 'string'
            ? data.message
            : typeof data?.response === 'string'
              ? data.response
              : '';
      if (rawAiText && rawAiText.trim().length > 0) {
        suggestedResult = unmask(rawAiText.trim().replace(/^"""\s*|\s*"""$/g, ''));
        explanation = `Applied ${action.replace('-', ' ')} via AI Copilot.`;
      }
    } catch {
      // Fallback silently to heuristic engine
    }

    // Heuristic fallback if AI response was empty or failed
    if (!suggestedResult) {
      const fallbackMasked = applyHeuristicTransformation(maskedText, action);
      suggestedResult = unmask(fallbackMasked);
      explanation = `Enhanced ${action.replace('-', ' ')} using Academic Heuristic Rules.`;
    }

    const wordsOriginal = trimmed.split(/\s+/).filter(Boolean).length;
    const wordsSuggested = suggestedResult.split(/\s+/).filter(Boolean).length;

    return {
      success: true,
      originalText: selectedText,
      suggestedText: suggestedResult,
      explanation,
      action,
      diffSummary: {
        charsOriginal: trimmed.length,
        charsSuggested: suggestedResult.length,
        wordsOriginal,
        wordsSuggested,
      },
    };
  }
}

/**
 * Request AI fix suggestion for a given compilation error.
 */
export async function suggestLatexFix(params: AiErrorFixParams): Promise<AiErrorFixResult> {
  const prompt = [
    'You are an expert LaTeX debugging assistant (Overleaf Error Assist).',
    'Analyze the following LaTeX compiler error and suggest an immediate, surgical fix.',
    `File: ${params.errorFile || 'main.tex'}`,
    `Line: ${params.errorLine || 'unknown'}`,
    `Error Message: ${params.errorMessage}`,
    params.detail ? `Detail: ${params.detail}` : '',
    params.surroundingCode ? `\nSurrounding Code:\n\`\`\`latex\n${params.surroundingCode}\n\`\`\`` : '',
    '',
    'Reply ONLY with a valid JSON object in this exact schema (no markdown fences, pure JSON):',
    '{',
    '  "explanation": "Brief 1-2 sentence description of what caused the error and how to fix it",',
    '  "originalSnippet": "Exact code line(s) that should be replaced",',
    '  "fixedSnippet": "The corrected code line(s)",',
    `  "startLine": ${params.errorLine || 1},`,
    `  "endLine": ${params.errorLine || 1},`,
    '  "confidence": "high"',
    '}',
  ].filter(Boolean).join('\n');

  try {
    type AiCompletionPayload = {
      content?: string;
      reply?: string;
      message?: string;
    };
    type AiCompletionResponse = {
      data?: AiCompletionPayload | string;
    } & AiCompletionPayload;

    const json = await apiPost<AiCompletionResponse | string>('/api/ai/chat/sync', {
      messages: [{ role: 'user', content: prompt }],
      query: prompt,
      pageId: params.pageId,
      projectId: params.projectId,
    }, { silent: true });

    const data = (typeof json === 'object' && json !== null && 'data' in json ? json.data : json) || json;
    const rawContent: string =
      typeof data === 'string'
        ? data
        : typeof data === 'object' && data !== null
          ? (data.content || data.reply || data.message || '')
          : '';

    // Clean JSON text (strip markdown code blocks if returned)
    const jsonText = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && parsed.explanation && parsed.fixedSnippet !== undefined) {
      let explanation = String(parsed.explanation).trim();
      explanation = explanation
        .replace(/^Error on line \d+:\s*/i, '')
        .replace(/^LaTeX Error:\s*/i, '')
        .trim();

      return {
        explanation: explanation || String(parsed.explanation),
        originalSnippet: String(parsed.originalSnippet || ''),
        fixedSnippet: String(parsed.fixedSnippet || ''),
        startLine: Number(parsed.startLine) || params.errorLine || 1,
        endLine: Number(parsed.endLine) || params.errorLine || 1,
        confidence:
          parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
            ? parsed.confidence
            : 'high',
      };
    }
  } catch {
    // If AI network or parsing fails, seamlessly return heuristic fix
  }

  return heuristicLatexErrorFix(params);
}

export const ai = {
  executeAcademicAction: AcademicAiService.executeAction,
  suggestLatexFix,
  AcademicAiService,
};

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
  review,
  trackChanges: review,
  history,
  search,
  export: exportDocs,
  exportImport: exportDocs,
  collaboration,
  structure,
  diagnostics,
  linkedFiles,
  citations,
  templates,
  filestore,
  updater,
  spelling: spellingService,
  storage,
  files,
  StorageService,
  EditorStorageService,
  notifications,
  notificationBundlerService,
  ai,
  AcademicAiService,
  suggestLatexFix,
  git: gitApi,
};

export const manuscriptApi = manuscriptService;
export default manuscriptService;
