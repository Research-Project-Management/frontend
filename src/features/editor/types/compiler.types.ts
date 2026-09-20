/**
 * compiler.types.ts
 *
 * Types for LaTeX compilation, diagnostics, and word count.
 * Matches backend document/compiler module.
 */

export type CompilerEngine = 'pdflatex' | 'xelatex' | 'lualatex';
export type LaTeXEngine = CompilerEngine;

export type CompileMode = 'full' | 'draft';

export type CompileStatus =
  | 'idle'
  | 'flushing'
  | 'syncing'
  | 'compiling'
  | 'done'
  | 'error';

export interface CompileError {
  line: number | null;
  message: string;
  /** Raw surrounding lines from the log for context */
  context: string;
  file?: string;
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
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

export interface CompileLatexInput {
  projectId?: string;
  pageId?: string;
  mainFile?: string;
  source?: string;
  engine?: CompilerEngine;
  draft?: boolean;
  useCache?: boolean;
  files?: Record<string, string>;
}

export interface WordCountInput {
  source: string;
  pageId?: string;
  projectId?: string;
}

export interface SyncIncrementalInput {
  dirtyFileIds?: string[];
  forceAll?: boolean;
  projectId?: string;
}

export interface SaveAndSyncInput {
  title?: string;
  content?: any;
  createSnapshot?: boolean;
  versionDescription?: string;
}
