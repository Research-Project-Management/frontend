/**
 * manuscript.service.ts
 *
 * UNIFIED MANUSCRIPT CLIENT SDK
 *
 * Single point of contact for the frontend to interact with the Manuscript subsystem.
 * This encapsulates all sub-domains:
 *  - docs: Document CRUD, lines, thumbnails, and sync
 *  - compiler: LaTeX compilation, aux artifacts, word-count, preview
 *  - synctex: Forward and reverse SyncTeX coordinate mapping
 *  - comments: Inline discussion threads, replies, and resolution
 *  - suggestions: Track changes and review suggestions (accept/reject)
 *  - history: Snapshots, revisions, visual diffing, and audit logs
 *  - search: Full-text search and atomic batch replace across project files
 *  - export: Multi-format compilation export (PDF, TeX, arXiv ZIP, DOCX, MD)
 *  - collaboration: Real-time presence, heartbeat, and SSE synchronization
 *  - structure: Project hierarchy, folders, and file tree nodes
 *
 * MICROSERVICE READY:
 * By setting NEXT_PUBLIC_MANUSCRIPTS_SERVICE_URL or NEXT_PUBLIC_MANUSCRIPT_SERVICE_URL,
 * the frontend can seamlessly route requests to an independent `manuscript-services`
 * container with zero component-level changes.
 */

import * as api from '@/shared/lib/api';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, getAuthToken, getEffectiveBaseUrl } from '@/shared/lib/api';
import type { Page, PageFile, PageComment, PageSuggestion, SuggestionStatus, SuggestionType, PageVersion, ProjectEvent } from '../types';
import type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
} from '../types/history.types';
import type { DocumentExportFormat } from '../types/export.types';
import { spellingService } from './spelling.service';

export type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
};

export interface DiagnosticItemDto {
  file: string;
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  context?: string;
  code?: string;
  explanation?: {
    code: string;
    title: string;
    summary: string;
    latexSnippet?: string;
  };
  quickFix?: {
    description: string;
    replacementText: string;
  };
}

export interface DiagnosticReportDto {
  id?: string;
  items: DiagnosticItemDto[];
  errorCount?: number;
  errorsCount?: number;
  warningCount?: number;
  warningsCount?: number;
  badboxCount?: number;
  badboxesCount?: number;
  infoCount?: number;
  totalCount?: number;
  isSuccess: boolean;
  rawLog?: string;
}

export interface AutoFixResultDto {
  isFixed: boolean;
  fixedSource: string;
  appliedFixes: Array<{
    line: number;
    rule: string;
    description: string;
  }>;
}

export interface ErrorExplanationDto {
  code: string;
  title: string;
  summary?: string;
  explanation?: string;
  commonCauses?: string[];
  suggestedFix?: string;
  exampleSnippet?: string;
  documentationUrl?: string;
  latexSnippet?: string;
}

export interface LinkedFileDto {
  id: string;
  projectId: string;
  name: string;
  providerType: 'URL' | 'ZOTERO' | 'MENDELEY' | 'DROPBOX' | 'GITHUB';
  url?: string;
  collectionId?: string;
  targetBibFile?: string;
  status: 'SYNCED' | 'SYNCING' | 'FAILED' | 'PENDING';
  lastSyncedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLinkedFilePayload {
  name: string;
  providerType?: 'URL' | 'ZOTERO' | 'MENDELEY' | 'DROPBOX' | 'GITHUB';
  provider?: 'url' | 'zotero' | 'mendeley';
  url?: string;
  collectionId?: string;
  targetBibFile?: string;
  parentFolderId?: string;
  autoRefresh?: boolean;
}

export interface BibEntryDto {
  key: string;
  type: string;
  title?: string;
  author?: string;
  year?: string;
  journal?: string;
  doi?: string;
  rawBibtex?: string;
}

export interface CitationValidationDto {
  isValid: boolean;
  duplicateKeys: string[];
  missingFieldWarnings: Array<{ key: string; missingFields: string[] }>;
  totalEntries: number;
}

export type CitationValidationResult = CitationValidationDto;

export interface TemplateSummaryDto {
  id: string;
  name: string;
  category: string;
  publisher?: string;
  description?: string;
  badge?: string;
}

export interface FileMetadataDto {
  id: string;
  projectId: string;
  filename: string;
  sizeBytes: number;
  hash: string;
  mimeType: string;
  createdAt: string;
}

export interface TrackChangeDto {
  id: string;
  projectId: string;
  docId: string;
  type: 'insert' | 'delete';
  text: string;
  fromIndex: number;
  toIndex: number;
  authorId: string;
  authorName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  resolvedAt?: string;
  resolvedById?: string;
  createdAt: string;
}

export interface CommentReplyDto {
  id: string;
  threadId: string;
  authorId: string;
  authorName?: string;
  content: string;
  createdAt: string;
}

export interface CommentThreadDto {
  id: string;
  projectId: string;
  docId: string;
  authorId: string;
  authorName?: string;
  content: string;
  fromIndex: number;
  toIndex: number;
  selectedText?: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedById?: string;
  replies: CommentReplyDto[];
  createdAt: string;
  updatedAt: string;
}

export interface DocReviewsResponseDto {
  changes: TrackChangeDto[];
  threads: CommentThreadDto[];
}

export interface QueueUpdatePayload {
  pathname?: string;
  docLines?: string[];
  docOps?: unknown[];
  version?: number;
}

export interface FlushResultDto {
  flushed: boolean;
  flushedDocCount: number;
}

export interface StructureNodeDto {
  id: string;
  projectId: string;
  name: string;
  path: string;
  type: 'folder' | 'file' | 'doc';
  parentId?: string | null;
  sortOrder?: number;
  isRootDoc?: boolean;
  createdAt: string;
  updatedAt: string;
  children?: StructureNodeDto[];
}

export interface DocstoreDocDto {
  _id: string;
  projectId: string;
  path: string;
  lines: string[];
  version: number;
  rev: number;
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Base URL Configuration ──────────────────────────────────────────────────

export const MANUSCRIPTS_API_BASE =
  process.env.NEXT_PUBLIC_MANUSCRIPTS_SERVICE_URL ||
  process.env.NEXT_PUBLIC_MANUSCRIPT_SERVICE_URL ||
  '/api/v1/manuscripts';

export function getManuscriptsBaseUrl(): string {
  if (MANUSCRIPTS_API_BASE.startsWith('http://') || MANUSCRIPTS_API_BASE.startsWith('https://')) {
    return MANUSCRIPTS_API_BASE;
  }
  if (typeof window !== 'undefined' && !process.env.VITEST) {
    return MANUSCRIPTS_API_BASE;
  }
  const base = getEffectiveBaseUrl().replace(/\/$/, '');
  const path = MANUSCRIPTS_API_BASE.startsWith('/') ? MANUSCRIPTS_API_BASE : `/${MANUSCRIPTS_API_BASE}`;
  return `${base}${path}`;
}

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface CompilerDiagnostic {
  file: string;
  line: number | null;
  message: string;
  context: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
}

export interface CompileLatexPayload {
  project_id?: string;
  projectId?: string;
  page_id?: string;
  pageId?: string;
  main_file: string | null;
  engine: string;
  texLiveVersion?: string;
  draft: boolean;
  use_cache: boolean;
  force_clean?: boolean;
  forceClean?: boolean;
  stop_on_first_error?: boolean;
  timeout_ms?: number;
  timeoutMs?: number;
  source?: string;
  files?: Record<string, string>;
  signal?: AbortSignal;
}

export interface CompileLatexResponse {
  success?: boolean;
  pdf: string;
  logs: string;
  synctex?: string;
  error?: string;
  diagnostics?: CompilerDiagnostic[];
}

export interface WordCountResponse {
  success: boolean;
  stats?: {
    wordsInText: number;
    wordsInHeaders: number;
    wordsInCaptions: number;
    headers: number;
    floats: number;
    mathInlines: number;
    mathDisplayed: number;
    totalWords?: number;
    charactersWithSpaces?: number;
    charactersNoSpaces?: number;
  };
  error?: string;
}

export interface PreviewCompileResult {
  success: boolean;
  pdf?: string;
  pdfUrl?: string;
  log: string;
  error?: string;
}

export interface AuxFileItem {
  name: string;
  size: number;
  ext: string;
}

export interface ForwardSyncPayload {
  projectId: string;
  file: string;
  line: number;
  column?: number;
  pdfPath?: string;
}

export interface ForwardSyncResult {
  page: number;
  x: number;
  y: number;
  h: number;
  w: number;
}

export interface ReverseSyncPayload {
  projectId: string;
  page: number;
  x: number;
  y: number;
  pdfPath?: string;
}

export interface ReverseSyncResult {
  file: string;
  line: number;
  column: number;
}

export interface CreateSuggestionPayload {
  pageId: string;
  type: SuggestionType;
  originalText?: string;
  suggestedText?: string;
  fromLine: number;
  fromColumn?: number;
  toLine: number;
  toColumn?: number;
  description?: string;
  projectId?: string;
  silent?: boolean;
}

export interface DiffChunk {
  type: 'added' | 'removed' | 'unchanged';
  lines: string[];
  oldStart?: number;
  newStart?: number;
}

export interface VersionDiffResponse {
  fromVersionId: string;
  toVersionId: string;
  fromContent?: string;
  toContent?: string;
  diff?: string;
  chunks?: DiffChunk[];
  stats?: {
    additions?: number;
    deletions?: number;
    addedLines?: number;
    deletedLines?: number;
    unchangedLines?: number;
  };
}

export interface OpLogEntry {
  id?: string;
  timestamp: number;
  userId?: string;
  userName?: string;
  operation?: string;
  description?: string;
  [key: string]: unknown;
}

export interface OpLogTimeline {
  entries: OpLogEntry[];
  oldestMs?: number;
  newestMs?: number;
}

export interface ReconstructedContent {
  content?: string;
  timestamp?: number;
}

export interface SearchMatchEntry {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
  snippet: string;
}

export interface FileSearchResult {
  fileId: string;
  fileName: string;
  isMainFile: boolean;
  totalMatches: number;
  matches: SearchMatchEntry[];
}

export interface SearchResultResponse {
  query: string;
  totalFiles: number;
  totalMatches: number;
  results: FileSearchResult[];
  truncated: boolean;
}

export interface BatchReplaceResultResponse {
  query: string;
  replaceWith: string;
  totalFilesAffected: number;
  totalOccurrencesReplaced: number;
  affectedFileIds: string[];
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileIds?: string[];
  maxResults?: number;
}

export interface BatchReplaceOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileIds?: string[];
}

export interface ExportFileResult {
  filename: string;
  mimeType: string;
  content: string;
  isBase64: boolean;
  sizeBytes: number;
}

export interface CollaborationPresence {
  id?: string;
  userId?: string;
  name: string;
  avatar?: string | null;
  role?: string;
  color?: string;
  cursor?: {
    line: number;
    column: number;
    selection?: {
      startLineNumber: number;
      startColumn: number;
      endLineNumber: number;
      endColumn: number;
    };
  };
  lastHeartbeat?: number;
  lastActiveAt?: number;
}

export interface CollaborationEvent {
  pageId: string;
  type: string;
  suggestion?: PageSuggestion;
  comment?: PageComment;
  user?: CollaborationPresence;
  users?: CollaborationPresence[];
  userId?: string;
  isLocked?: boolean;
  lockedBy?: string;
  timestamp: number;
}


// ─── 1. DOCS CLIENT ─────────────────────────────────────────────────────────

const docs = {
  getById: async (docId: string): Promise<Page> => {
    if (!docId) throw new Error('docId is required');
    const res = await apiGet<{ page: Page }>(`${MANUSCRIPTS_API_BASE}/docs/${docId}`);
    if (!res || !res.page) {
      throw new Error(`Document ${docId} not found`);
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

  getAllRanges: async (projectId: string): Promise<any> => {
    try {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/ranges`);
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
      { lines, rev },
    );
  },

  patchDoc: async (
    projectId: string,
    docId: string,
    dto: { path?: string; deleted?: boolean },
  ): Promise<any> => {
    return await apiPatch<any>(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/doc/${docId}`, dto);
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

// ─── 2. COMPILER CLIENT ─────────────────────────────────────────────────────

const compiler = {
  compile: async (payload: CompileLatexPayload, signal?: AbortSignal): Promise<CompileLatexResponse> => {
    const effectiveSignal = signal || payload.signal;
    const { signal: _unused, ...body } = payload;
    if (!body.timeout_ms) {
      body.timeout_ms = 120000;
    }
    try {
      if (body.project_id) {
        try {
          await updater.flushProject(body.project_id);
        } catch {
          // Non-fatal if offline/syncing
        }
      }
      return await apiPost<CompileLatexResponse>(`${MANUSCRIPTS_API_BASE}/compile`, body, {
        signal: effectiveSignal,
        timeout: 120000,
      });
    } catch (err: any) {
      return {
        success: false,
        pdf: '',
        logs: err?.message || 'Compilation service is initializing. Ready for CLSI module.',
        error: err?.message || 'Failed to reach compiler service',
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
    } catch (err: any) {
      return {
        success: false,
        pdf: '',
        pdfUrl: '',
        log: err?.message || String(err),
        error: err?.message || 'Preview compile failed',
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

  getStatus: async (): Promise<any> => {
    try {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/clsi/status`);
    } catch {
      return { status: 'ok', engines: ['pdflatex', 'xelatex', 'lualatex'] };
    }
  },

  getMetricsSummary: async (): Promise<any> => {
    try {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/clsi/metrics/summary`);
    } catch {
      return {};
    }
  },
};

// ─── 3. SYNCTEX CLIENT ──────────────────────────────────────────────────────

const synctex = {
  forwardSync: async (payload: ForwardSyncPayload): Promise<ForwardSyncResult | null> => {
    const res = await apiPost<any>(`${MANUSCRIPTS_API_BASE}/synctex/forward`, payload);
    if (res?.success && res?.result) {
      return {
        page: res.result.page ?? 1,
        x: res.result.x ?? 72,
        y: res.result.y ?? 72,
        w: res.result.width ?? 450,
        h: res.result.height ?? 14,
      };
    }
    return null;
  },

  reverseSync: async (payload: ReverseSyncPayload): Promise<ReverseSyncResult | null> => {
    const res = await apiPost<any>(`${MANUSCRIPTS_API_BASE}/synctex/reverse`, payload);
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

// ─── 4. COMMENTS & DISCUSSION CLIENT ────────────────────────────────────────

const comments = {
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

// ─── 5. SUGGESTIONS & TRACK CHANGES CLIENT ───────────────────────────────────

const suggestions = {
  getSuggestions: async (
    docId: string,
    status?: SuggestionStatus,
  ): Promise<PageSuggestion[]> => {
    if (!docId) return [];
    try {
      const queryStr = status ? `?status=${status}` : '';
      const data = await api.apiGet<{ suggestions: PageSuggestion[] }>(
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
    const data = await api.apiPost<{ suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${pageId}/suggestions`,
      body,
    );
    return data.suggestion;
  },

  acceptSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion; page: any }> => {
    return await api.apiPost<{ ok: boolean; suggestion: PageSuggestion; page: any }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/accept`,
      {},
    );
  },

  rejectSuggestion: async (
    docId: string,
    suggestionId: string,
  ): Promise<{ ok: boolean; suggestion: PageSuggestion }> => {
    return await api.apiPost<{ ok: boolean; suggestion: PageSuggestion }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/${suggestionId}/reject`,
      {},
    );
  },

  acceptAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; acceptedCount: number; page?: any }> => {
    return await api.apiPost<{ ok: boolean; acceptedCount: number; page?: any }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/accept-all`,
      {},
    );
  },

  rejectAllSuggestions: async (
    docId: string,
  ): Promise<{ ok: boolean; rejectedCount: number }> => {
    return await api.apiPost<{ ok: boolean; rejectedCount: number }>(
      `${MANUSCRIPTS_API_BASE}/docs/${docId}/suggestions/reject-all`,
      {},
    );
  },
};

// ─── 5b. REVIEW & TRACK CHANGES CLIENT ──────────────────────────────────────

const review = {
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
    dto: { type: 'insert' | 'delete'; text: string; fromIndex: number; toIndex: number },
  ): Promise<TrackChangeDto> => {
    return await apiPost<TrackChangeDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes`,
      dto,
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
    action: 'accept_all' | 'reject_all',
  ): Promise<any> => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/changes/batch`,
      { action },
    );
  },

  createCommentThread: async (
    projectId: string,
    docId: string,
    dto: { content: string; fromIndex: number; toIndex: number; selectedText?: string },
  ): Promise<CommentThreadDto> => {
    return await apiPost<CommentThreadDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/docs/${docId}/review/threads`,
      dto,
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

// ─── 6. HISTORY & SNAPSHOTS CLIENT ──────────────────────────────────────────

const history = {
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
      const res = await apiGet<any[]>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/history/versions`,
      );
      if (Array.isArray(res) && res.length > 0) {
        return res.map((s) => ({
          id: s.id,
          versionNumber: s.version,
          title: s.summary || `Version ${s.version}`,
          label: s.labels?.[0]?.label || s.summary || '',
          fileName: 'Project Snapshot',
          createdAt: s.createdAt,
          savedBy: { id: s.createdById || 'user-1', name: s.createdById ? 'Collaborator' : 'You' },
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
  ): Promise<any | null> => {
    return apiPost<any>(
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
  ): Promise<any | null> => {
    return apiPost<any>(
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
    _t: string | number,
  ): Promise<ReconstructedContent> => {
    try {
      return await apiGet<ReconstructedContent>(`${MANUSCRIPTS_API_BASE}/docs/${docId}/at`);
    } catch {
      return { content: '', timestamp: Date.now() };
    }
  },
};

// ─── 7. SEARCH & BATCH REPLACE CLIENT ───────────────────────────────────────

const search = {
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

// ─── 8. EXPORT CLIENT ───────────────────────────────────────────────────────

const exportDocs = {
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

  importProjectZip: async (projectId: string, file: File | Blob, preferredRootDoc?: string): Promise<any> => {
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
    return await res.json();
  },

  scaffoldTemplate: async (projectId: string, templateId: string): Promise<any> => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/templates/${templateId}/scaffold`, {});
  },

  convertDocument: async (
    projectId: string,
    file: File | Blob,
    format?: 'docx' | 'md',
  ): Promise<any> => {
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
    return await res.json();
  },
};

// ─── 9. COLLABORATION CLIENT ────────────────────────────────────────────────

const collaboration = {
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
    onError?: (err: any) => void,
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

// ─── 10. STRUCTURE & FILE TREE CLIENT ───────────────────────────────────────

const structure = {
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

  createNode: async (projectId: string, dto: any) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes`, {
      ...dto,
      type: typeof dto?.type === 'string' ? dto.type.toUpperCase() : (dto?.type || 'DOC'),
    });
  },

  moveNode: async (projectId: string, nodeId: string, dto: any) => {
    return await apiPatch(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/structure/nodes/${nodeId}/move`, dto);
  },

  renameNode: async (projectId: string, nodeId: string, dto: any) => {
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

// ─── 11. DIAGNOSTICS & LINTER CLIENT ────────────────────────────────────────

const diagnostics = {
  parseLog: async (logText: string, engine = 'pdflatex'): Promise<DiagnosticReportDto> => {
    return await apiPost<DiagnosticReportDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/parse-log`, { logText, engine });
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

// ─── 12. LINKED FILES CLIENT ────────────────────────────────────────────────

const linkedFiles = {
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

// ─── 13. CITATIONS & BIBLIOGRAPHY CLIENT ────────────────────────────────────

const citations = {
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
    dto: { provider: string; collectionId: string; collectionName?: string; targetBibFile?: string },
  ) => {
    return await apiPost(`${MANUSCRIPTS_API_BASE}/projects/${projectId}/citations/sync-library`, dto);
  },

  listLibraryCollections: async (): Promise<any[]> => {
    try {
      return await apiGet<any[]>(`${MANUSCRIPTS_API_BASE}/citations/library-collections`);
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

// ─── 14. TEMPLATES & GALLERY CLIENT ─────────────────────────────────────────

const templates = {
  list: async (query?: { category?: string; search?: string; limit?: number; skip?: number }): Promise<any[]> => {
    const params: Record<string, string> = {};
    if (query?.category) params.category = query.category;
    if (query?.search) params.search = query.search;
    if (query?.limit) params.limit = String(query.limit);
    if (query?.skip) params.skip = String(query.skip);
    try {
      const res = await apiGet<any>(`${MANUSCRIPTS_API_BASE}/projects/templates`, { params });
      return Array.isArray(res) ? res : res?.templates || [];
    } catch {
      const res = await apiGet<any>(`${MANUSCRIPTS_API_BASE}/templates`, { params });
      return Array.isArray(res) ? res : res?.templates || [];
    }
  },

  search: async (query: { q?: string; category?: string; tags?: string[] }): Promise<any> => {
    const params: Record<string, string> = {};
    if (query.q) params.q = query.q;
    if (query.category) params.category = query.category;
    return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/templates/search`, { params });
  },

  getById: async (id: string): Promise<any> => {
    try {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/projects/templates/${id}`);
    } catch {
      return await apiGet<any>(`${MANUSCRIPTS_API_BASE}/templates/${id}`);
    }
  },

  instantiate: async (templateId: string, projectName: string): Promise<any> => {
    return await apiPost<any>(`${MANUSCRIPTS_API_BASE}/templates/instantiate`, { templateId, projectName });
  },

  createCustom: async (dto: any): Promise<any> => {
    return await apiPost<any>(`${MANUSCRIPTS_API_BASE}/templates/custom`, dto);
  },

  scaffold: async (projectId: string, templateId: string): Promise<any> => {
    try {
      return await apiPost<any>(
        `${MANUSCRIPTS_API_BASE}/projects/${projectId}/templates/${templateId}/scaffold`,
        { templateId },
      );
    } catch {
      return await apiPost<any>(`${MANUSCRIPTS_API_BASE}/templates/scaffold`, { projectId, templateId });
    }
  },
};

// ─── 15. FILESTORE BINARY ASSETS CLIENT ─────────────────────────────────────

const filestore = {
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

// ─── 16. DOCUMENT UPDATER CLIENT ────────────────────────────────────────────

const updater = {
  queueUpdate: async (
    projectId: string,
    docId: string,
    dto: QueueUpdatePayload,
  ): Promise<any> => {
    return await apiPost<any>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/doc/${docId}/update`,
      dto,
    );
  },

  flushProject: async (
    projectId: string,
    force = false,
  ): Promise<FlushResultDto> => {
    return await apiPost<FlushResultDto>(
      `${MANUSCRIPTS_API_BASE}/projects/${projectId}/updater/flush`,
      { force },
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
  ): Promise<any> => {
    return await apiGet<any>(
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

// ─── Unified Manuscript Service Export ───────────────────────────────────────

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
};

export default manuscriptService;
