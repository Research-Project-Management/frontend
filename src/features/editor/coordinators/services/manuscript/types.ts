/**
 * types.ts
 *
 * Unified DTOs and payloads for the Manuscript service subsystem.
 */

import type {
  PageComment,
  PageSuggestion,
  SuggestionType,
  ErrorExplanationDto,
} from '@/features/editor/domain/types';
import type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
} from '@/features/editor/domain/types/history.types';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';

export type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
  ErrorExplanationDto,
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
