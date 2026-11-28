/**
 * compiler.types.ts
 * DTOs for LaTeX compilation, SyncTeX, diagnostics, word count, and outline.
 */

import type {
  CompileLogMeta,
  CompileOutcome,
  CompileValidationIssue,
  CompilerDiagnostic,
  DiagnosticItemDto,
  DiagnosticsSummary,
} from '@/features/editor/domain/types/compiler.types';

export type {
  CompileLogMeta,
  CompileOutcome,
  CompileValidationIssue,
  CompilerDiagnostic,
  DiagnosticItemDto,
  DiagnosticsSummary,
};

export interface CompileLatexPayload {
  spaceId?: string | null;
  pageId?: string;
  mainFile?: string;
  engine: string;
  texLiveVersion?: string;
  draft: boolean;
  syntaxOnly?: boolean;
  useCache: boolean;
  forceClean?: boolean;
  stopOnFirstError?: boolean;
  priority?: 'manual' | 'auto';
  timeoutMs?: number;
  source?: string;
  files?: Record<string, string>;
  responseMode?: 'inline' | 'artifact';
  signal?: AbortSignal;
}

export interface CompileLatexResponse {
  success?: boolean;
  outcome?: CompileOutcome;
  aborted?: boolean;
  statusCode?: number;
  errorCode?: string;
  pdf: string;
  pdfArtifactUrl?: string;
  synctexArtifactUrl?: string;
  synctexAvailable?: boolean;
  pdfSizeBytes?: number;
  logs: string;
  logMeta?: CompileLogMeta;
  synctex?: string;
  error?: string;
  diagnostics?: CompilerDiagnostic[];
  diagnosticsSummary?: DiagnosticsSummary;
  validationIssues?: CompileValidationIssue[];
}

interface WordCountSectionDto {
  title: string;
  level: string;
  line: number;
  words: number;
}

interface WordCountFileStatsDto {
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
