/**
 * compiler.types.ts
 *
 * Types and validation schemas for LaTeX compilation, diagnostics, and word count.
 * Matches backend document/compiler module.
 */

import { z } from 'zod';

export const compilerEngineSchema = z.enum(['pdflatex', 'xelatex', 'lualatex', 'latex']);

export const compileLatexSchema = z.object({
  projectId: z.string().optional(),
  pageId: z.string().optional(),
  mainFile: z.string().optional(),
  source: z.string().optional(),
  engine: compilerEngineSchema.optional(),
  draft: z.boolean().optional(),
  useCache: z.boolean().optional(),
  files: z.record(z.string(), z.string()).optional(),
});

export type CompileLatexInput = z.infer<typeof compileLatexSchema>;

export const wordCountSchema = z.object({
  source: z.string().min(1, 'Source content is required for word count'),
  pageId: z.string().optional(),
  projectId: z.string().optional(),
});

export type WordCountInput = z.infer<typeof wordCountSchema>;

export const syncIncrementalSchema = z.object({
  dirtyFileIds: z.array(z.string()).optional(),
  forceAll: z.boolean().optional(),
  projectId: z.string().optional(),
});

export type SyncIncrementalInput = z.infer<typeof syncIncrementalSchema>;

export const saveAndSyncSchema = z.object({
  title: z.string().optional(),
  content: z.any().optional(),
  createSnapshot: z.boolean().optional(),
  versionDescription: z.string().optional(),
});

export type SaveAndSyncInput = z.infer<typeof saveAndSyncSchema>;

export const compileDocumentSchema = z.object({
  engine: compilerEngineSchema.optional(),
  source: z.string().optional(),
  documentClass: z.string().optional(),
});

export type CompileDocumentInput = z.infer<typeof compileDocumentSchema>;

export type CompilerEngine = 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
export type LaTeXEngine = CompilerEngine;

export type CompileMode = 'full' | 'draft';

export type LogSeverity = 'error' | 'warning' | 'info' | 'badbox';

export type CompileStatus =
  | 'idle'
  | 'flushing'
  | 'syncing'
  | 'compiling'
  | 'done'
  | 'success'
  | 'aborted'
  | 'error';

export type CompilePhase = 'idle' | 'flushing' | 'compiling' | 'done';

export type CompileOutcome =
  | 'success'
  | 'stopped-on-first-error'
  | 'failure'
  | 'timedout'
  | 'terminated'
  | 'validation-problems'
  | 'clsi-unavailable'
  | 'offline-queued'
  | 'code-check-blocked';

export interface CompileLogMeta {
  sizeBytes: number;
  truncated: boolean;
  logArtifactUrl?: string;
  bibLogFiles?: string[];
}

export interface DiagnosticsSummary {
  totalErrors: number;
  totalWarnings: number;
  totalBadboxes: number;
  suppressedCascadeCount: number;
  truncated: boolean;
}

export type CompileValidationIssue =
  | {
      code: 'mainFile';
      mainFile: string;
      availableTexFiles: string[];
      message: string;
    }
  | {
      code: 'conflictedPaths';
      paths: string[];
      message: string;
    }
  | {
      code: 'sizeCheck';
      totalBytes: number;
      limitBytes: number;
      fileLimitBytes: number;
      offendingFiles: Array<{ path: string; sizeBytes: number }>;
      message: string;
    };

export interface CompileError {
  line: number | null;
  message: string;
  /** Raw surrounding lines from the log for context */
  context?: string;
  file?: string;
  severity?: 'error' | 'warning' | 'info' | 'badbox';
  source?: 'tex' | 'bibtex' | 'biber' | 'system';
  highlightCommand?: string;
  code?: string;
  suggestion?: string;
  fixedSnippet?: string;
  originalSnippet?: string;
}

export interface CompileResult {
  pdfUrl: string | null;
  status: CompileStatus;
  log?: string | null;
  errors?: CompileError[];
  compiledAt?: Date;
}

export interface WordCountResult {
  words: number;
  characters: number;
  headers?: number;
  mathFormulas?: number;
}

// ── Compiler Diagnostics & Log Viewer ────────────────────────────────────────

export interface ErrorExplanationDto {
  code?: string;
  title: string;
  summary?: string;
  explanation?: string;
  whyItHappened?: string;
  howToFix?: string;
  commonCauses?: string[];
  suggestedFix?: string;
  exampleSnippet?: string;
  documentationUrl?: string;
  latexSnippet?: string;
}

export interface DiagnosticItemDto {
  id?: string;
  file: string;
  line: number | null;
  column?: number | null;
  severity: 'error' | 'warning' | 'info' | 'badbox';
  category?: 'error' | 'warning' | 'info' | 'badbox';
  warningSubtype?: 'font' | 'package' | 'citation' | 'reference' | 'badbox';
  source?: 'tex' | 'bibtex' | 'biber' | 'system';
  highlightCommand?: string;
  message: string;
  context?: string;
  code?: string;
  explanation?: {
    code?: string;
    title: string;
    summary?: string;
    explanation?: string;
    commonCauses?: string[];
    suggestedFix?: string;
    exampleSnippet?: string;
    latexSnippet?: string;
    documentationUrl?: string;
  };
  quickFix?: {
    description: string;
    replacementText: string;
  };
}

export interface CompilerDiagnostic {
  file: string;
  line: number | null;
  column?: number;
  message: string;
  context: string;
  severity: 'error' | 'warning' | 'info' | 'badbox';
  category?: 'error' | 'warning' | 'info' | 'badbox';
  warningSubtype?: 'font' | 'package' | 'citation' | 'reference' | 'badbox';
  source?: 'tex' | 'bibtex' | 'biber' | 'system';
  highlightCommand?: string;
  code?: string;
  suggestion?: string;
  quickFix?: {
    description: string;
    replacementText: string;
  };
  explanation?: {
    title: string;
    whyItHappened: string;
    howToFix: string;
  };
}

export interface LogEntry {
  message: string;
  file?: string;
  line?: number;
  detail?: string;
  code?: string;
  source?: 'tex' | 'bibtex' | 'biber' | 'system';
  highlightCommand?: string;
  rawExcerpt?: string;
  explanation?: ErrorExplanationDto;
  quickFix?: {
    description: string;
    replacementText: string;
  };
}

export interface ParsedLog {
  errors: LogEntry[];
  warnings: LogEntry[];
  badBoxes: LogEntry[];
}

export interface CompileReport {
  outcome: CompileOutcome;
  errorMessage: string | null;
  diagnostics: CompilerDiagnostic[];
  summary: DiagnosticsSummary;
  validationIssues: CompileValidationIssue[];
  logText: string | null;
  logMeta: CompileLogMeta | null;
  compiledAt: Date | null;
  mainFile: string;
}

export interface CompilerLogsProps {
  log: string;
  parsedLog?: ParsedLog;
  onClose: () => void;
  onJumpToError?: (file: string | undefined, line: number) => void;
  onClearCacheAndCompile?: () => void;
  onCompile?: () => void;
}

export type LogsProps = CompilerLogsProps;
