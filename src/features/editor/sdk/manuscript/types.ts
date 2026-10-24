/**
 * types.ts
 *
 * Unified DTOs and payloads for the Manuscript service subsystem.
 */

import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionType } from '@/features/editor/domain/types/suggestion.types';
import type { ErrorExplanationDto } from '@/features/editor/domain/types/compiler.types';
import type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
  VersionLabelItem,
} from '@/features/editor/domain/types/history.types';
import type { DocumentExportFormat } from '@/features/editor/domain/types/export.types';

export type {
  ProjectVersionListItem,
  ProjectSnapshotDetail,
  ProjectDiffResponse,
  ProjectFileDiff,
  VersionLabelItem,
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
  provider?: 'url' | 'zotero' | 'mendeley';
  providerType?: 'URL' | 'ZOTERO' | 'MENDELEY' | 'DROPBOX' | 'GITHUB';
  url?: string | null;
  collectionId?: string | null;
  nodeId?: string | null;
  docId?: string | null;
  fileId?: string | null;
  targetBibFile?: string;
  status: 'synced' | 'failed' | 'pending' | 'SYNCED' | 'SYNCING' | 'FAILED' | 'PENDING';
  lastSyncedAt?: string | null;
  errorMessage?: string | null;
  autoRefresh?: boolean;
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
  id?: string;
  key: string;
  type: string;
  entryType?: string;
  title?: string;
  author?: string;
  authorsDisplay?: string;
  authors?: string[];
  displayLabel?: string;
  fields?: Record<string, string>;
  year?: string;
  journal?: string;
  doi?: string;
  rawBibtex?: string;
}

export interface CitationValidationDto {
  valid?: boolean;
  isValid: boolean;
  totalFiles?: number;
  duplicateKeys: string[];
  warnings?: string[];
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
  name?: string;
  filename: string;
  sizeBytes: number;
  hash: string;
  mimeType: string;
  storageKey?: string;
  bucketName?: string;
  rev?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface TextRangeDto {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface TrackChangeDto {
  id: string;
  projectId: string;
  docId: string;
  type: 'insert' | 'delete';
  text: string;
  range?: TextRangeDto;
  fromIndex?: number;
  toIndex?: number;
  authorId?: string;
  createdById?: string | null;
  authorName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  resolvedAt?: string | null;
  resolvedById?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CommentReplyDto {
  id: string;
  threadId: string;
  authorId?: string;
  createdById?: string | null;
  authorName?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CommentThreadDto {
  id: string;
  projectId: string;
  docId: string;
  authorId?: string;
  createdById?: string | null;
  authorName?: string;
  content?: string;
  quote?: string | null;
  range?: TextRangeDto;
  fromIndex?: number;
  toIndex?: number;
  selectedText?: string;
  resolved?: boolean;
  isResolved?: boolean;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  replies: CommentReplyDto[];
  createdAt: string;
  updatedAt: string;
}

export interface DocReviewsResponseDto {
  changes: TrackChangeDto[];
  threads: CommentThreadDto[];
}

export interface QueueUpdatePayload {
  lines?: string[];
  splice?: {
    startLine: number;
    deleteCount: number;
    newLines: string[];
  };
  userId?: string;
  clientRev?: number;
  debounceMs?: number;
  pathname?: string;
  docLines?: string[];
  docOps?: unknown[];
  version?: number;
}

export interface FlushResultDto {
  projectId?: string;
  flushed?: boolean;
  flushedDocCount?: number;
  flushedDocsCount: number;
  flushedDocIds?: string[];
  skippedDocIds?: string[];
  errors?: Array<{ docId: string; error: string }>;
  durationMs?: number;
}

export interface StructureNodeDto {
  id: string;
  projectId: string;
  name: string;
  path: string;
  type: 'folder' | 'file' | 'doc' | 'FOLDER' | 'FILE' | 'DOC';
  parentId?: string | null;
  sortOrder?: number;
  sizeBytes?: number;
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

export interface CompileOutputFile {
  type?: string;
  path?: string;
  url?: string;
}

export interface CompileLatexResponse {
  success?: boolean;
  pdf: string;
  logs: string;
  synctex?: string;
  error?: string;
  diagnostics?: CompilerDiagnostic[];
  compile?: {
    outputFiles?: CompileOutputFile[];
  };
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
  idempotencyKey?: string;
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
  socketId?: string;
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

export interface ImportProjectZipResult {
  projectId: string;
  totalEntries: number;
  totalDocs: number;
  totalFiles: number;
  totalFolders: number;
  rootDocId?: string | null;
  rootDocPath?: string | null;
}

export interface ProjectTemplateItem {
  id: string;
  name?: string;
  title: string;
  category?: string;
  description?: string;
  author?: string;
  thumbnailUrl?: string | null;
  fileCount?: number;
  defaultRootDoc?: string;
  [key: string]: unknown;
}
