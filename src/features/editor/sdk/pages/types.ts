/**
 * types.ts
 *
 * Unified DTOs and payloads for the Manuscript service subsystem.
 */

import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionType } from '@/features/editor/domain/types/suggestion.types';
import type {
  CompilerDiagnostic,
  DiagnosticItemDto,
  ErrorExplanationDto,
} from '@/features/editor/domain/types/compiler.types';
import type {
  ProjectSymbolLabelDto,
  ProjectSymbolCitationDto,
  ProjectSymbolCommandDto,
  ProjectSymbolEnvironmentDto,
  ProjectSymbolPackageDto,
  ProjectSymbolOutlineDto,
  ProjectSymbolsResponseDto,
} from '@/features/editor/domain/types/symbols.types';
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
  DiagnosticItemDto,
  CompilerDiagnostic,
  ProjectSymbolLabelDto,
  ProjectSymbolCitationDto,
  ProjectSymbolCommandDto,
  ProjectSymbolEnvironmentDto,
  ProjectSymbolPackageDto,
  ProjectSymbolOutlineDto,
  ProjectSymbolsResponseDto,
};

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
  spaceId?: string | null;
  pageId?: string | null;
  nodeId?: string;
  docId?: string | null;
  fileId?: string | null;
  parentId?: string | null;
  path?: string;
  isRootDoc?: boolean;
  sortOrder?: number;
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

export type StorageFileDto = FileMetadataDto;

export interface TextRangeDto {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface TrackChangeDto {
  id: string;
  spaceId?: string | null;
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
  spaceId?: string | null;
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

export type ReviewStatus =
  | 'draft'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'submitted'
  | 'locked';

export interface ReviewRoundInfo {
  status: ReviewStatus;
  roundNumber?: number;
  requestedById?: string;
  requestedAt?: string;
  verdictById?: string;
  verdictAt?: string;
  notes?: string;
  deadline?: string;
}

export interface ReviewStatusResponse {
  ok: boolean;
  docId: string;
  spaceId?: string | null;
  projectId: string;
  review: ReviewRoundInfo;
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

export interface DocstoreDocDto {
  _id: string;
  spaceId?: string | null;
  projectId: string;
  path: string;
  lines: string[];
  version: number;
  rev: number;
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlushResultDto {
  spaceId?: string | null;
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
  nodeId?: string;
  spaceId?: string | null;
  pageId?: string | null;
  projectId: string;
  name: string;
  path: string;
  type: 'folder' | 'file' | 'doc' | 'FOLDER' | 'FILE' | 'DOC';
  parentId?: string | null;
  docId?: string | null;
  fileId?: string | null;
  sortOrder?: number;
  sizeBytes?: number;
  isRootDoc?: boolean;
  createdAt: string;
  updatedAt: string;
  children?: StructureNodeDto[];
}

export type ManuscriptNodeDto = StructureNodeDto;

export interface CompileLatexPayload {
  spaceId?: string | null;
  pageId?: string;
  mainFile?: string;
  engine: string;
  texLiveVersion?: string;
  draft: boolean;
  useCache: boolean;
  forceClean?: boolean;
  stopOnFirstError?: boolean;
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

export interface WordCountSectionDto {
  title: string;
  level: string;
  line: number;
  words: number;
}

export interface WordCountFileStatsDto {
  id: string;
  title: string;
  path?: string;
  words: number;
  wordsInText: number;
  wordsInHeaders: number;
  wordsInCaptions: number;
  wordsInBibliography?: number;
  headers: number;
  floats: number;
  math: number;
  mathInlines: number;
  mathDisplayed: number;
}

export interface WordCountResponse {
  success: boolean;
  stats?: {
    wordsInText: number;
    wordsInHeaders: number;
    wordsInCaptions: number;
    wordsInBibliography?: number;
    headers: number;
    floats: number;
    mathInlines: number;
    mathDisplayed: number;
    totalWords?: number;
    charactersWithSpaces?: number;
    charactersNoSpaces?: number;
    cjkCharacters?: number;
    readingTimeMinutes?: number;
    sections?: WordCountSectionDto[];
    perFileStats?: WordCountFileStatsDto[];
    rawOutput?: string;
  };
  error?: string;
}

export interface LatexOutlineEntryDto {
  level:
    | 'part'
    | 'chapter'
    | 'section'
    | 'subsection'
    | 'subsubsection'
    | 'paragraph'
    | 'subparagraph'
    | 'figure'
    | 'table'
    | 'slide'
    | 'appendix'
    | 'abstract';
  title: string;
  line: number;
  file?: string;
  label?: string;
  starred?: boolean;
  shortTitle?: string;
  children?: LatexOutlineEntryDto[];
}

export interface ProjectOutlineResponseDto {
  rootDocPath: string | null;
  entries: LatexOutlineEntryDto[];
  tree: LatexOutlineEntryDto[];
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
  spaceId?: string | null;
  pageId?: string;
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
  spaceId?: string | null;
  pageId?: string;
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
  spaceId?: string | null;
  projectId?: string;
  idempotencyKey?: string;
  silent?: boolean;
}

export interface DiffChunk {
  type: 'added' | 'removed' | 'deleted' | 'unchanged' | 'change';
  lines?: string[];
  oldStart?: number;
  oldLines?: number;
  newStart?: number;
  newLines?: number;
  content?: string;
  value?: string;
  linesCount?: number;
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
  pageId?: string;
}

export interface BatchReplaceOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileIds?: string[];
  pageId?: string;
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
  spaceId?: string | null;
  projectId: string;
  totalEntries: number;
  totalDocs: number;
  totalFiles: number;
  totalFolders: number;
  rootDocId?: string | null;
  rootDocPath?: string | null;
}

export interface RestoreProjectVersionFileResult {
  path?: string;
  pathname?: string;
  version?: number;
  newVersion?: number;
  docId?: string | null;
  fileId?: string | null;
  content?: string;
  rev?: number;
  restored?: boolean;
  [key: string]: unknown;
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

export interface ProjectReviewFileOverviewDto {
  docId: string;
  fileId: string;
  title: string;
  path: string;
  isRootDoc?: boolean;
  comments: PageComment[];
  suggestions: PageSuggestion[];
  counts: {
    openCommentsCount: number;
    resolvedCommentsCount: number;
    pendingSuggestionsCount: number;
    acceptedSuggestionsCount: number;
    rejectedSuggestionsCount: number;
    totalVisibleCount: number;
    totalResolvedCount: number;
  };
}

export interface ProjectReviewOverviewResponseDto {
  spaceId?: string | null;
  projectId: string;
  files: ProjectReviewFileOverviewDto[];
  totals: {
    openCommentsCount: number;
    resolvedCommentsCount: number;
    pendingSuggestionsCount: number;
    acceptedSuggestionsCount: number;
    rejectedSuggestionsCount: number;
    totalVisibleCount: number;
    totalResolvedCount: number;
  };
}

export interface ImportFromProjectPayload {
  sourceSpaceId?: string;
  sourceProjectId?: string;
  sourceFileId: string;
  targetName?: string;
  targetPath?: string;
  parentPageId?: string;
}

export type EditorBootstrapDegradedBranch = 'symbols' | 'lastBuild';

export interface EditorBootstrapGithubLinkDto {
  id: string;
  repoFullName: string;
  branch: string;
  lastSyncedAt: string | null;
}

export interface EditorBootstrapPermissionsDto {
  role: string;
  canEdit: boolean;
  canCompile: boolean;
}

export interface EditorBootstrapWorkspaceDto {
  spaceId: string;
  spaceType?: 'personal' | 'project';
  pageId: string;
  rootDocId: string;
  projectName: string | null;
  title: string;
  mainFilePath: string;
  permissions: EditorBootstrapPermissionsDto;
  githubLink: EditorBootstrapGithubLinkDto | null;
}

export interface EditorBootstrapActiveDocDto {
  id: string;
  nodeId?: string | null;
  page: {
    id: string;
    title: string;
    content: string;
    path?: string;
    status: string;
    spaceId?: string;
    pageId?: string;
    projectId: string;
    mainFile: { id: string; title: string };
    mainFileId: string;
    rootPageId: string;
    version: number;
    rev: number;
    createdAt: string;
    updatedAt: string;
  };
  lines: string[];
  version: number;
  rev: number;
  ranges: Record<string, unknown>;
  fallbackToRoot: boolean;
}

export interface EditorBootstrapLastBuildDto {
  status: 'ready' | 'error' | 'uncompiled';
  pdfArtifactUrl: string | null;
  synctexAvailable: boolean;
  lastCompiledAt: string | null;
  diagnostics: CompilerDiagnostic[];
}

export interface EditorBootstrapResponseDto {
  workspace: EditorBootstrapWorkspaceDto;
  tree: StructureNodeDto[];
  activeDoc: EditorBootstrapActiveDocDto;
  symbols: ProjectSymbolsResponseDto | null;
  lastBuild: EditorBootstrapLastBuildDto;
  degraded: boolean;
  degradedBranches: EditorBootstrapDegradedBranch[];
  serverTimestamp: string;
}
