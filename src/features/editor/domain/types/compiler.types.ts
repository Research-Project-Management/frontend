/**
 * compiler.types.ts
 *
 * Types and validation schemas for LaTeX compilation, diagnostics, and word count.
 * Matches backend document/compiler module.
 */

export type CompilerEngine = 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
export const DEFAULT_COMPILER_ENGINE: CompilerEngine = 'pdflatex';

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
  | 'rate-limited'
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

// ── Compiler Diagnostics & Log Viewer ────────────────────────────────────────

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

export interface CompilerLogFocusTarget {
  file?: string;
  line?: number;
  severity?: 'error' | 'warning' | 'info';
  message?: string;
  nonce: number;
}

export interface CompilerLogsProps {
  log: string;
  parsedLog?: ParsedLog;
  onClose: () => void;
  onJumpToError?: (file: string | undefined, line: number) => void;
  onClearCacheAndCompile?: () => void;
  onCompile?: () => void;
  focusTarget?: CompilerLogFocusTarget | null;
  onFocusTargetHandled?: () => void;
}

