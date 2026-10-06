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

// Derived directly from Zod schemas (Single Source of Truth)
export type {
  CompileLatexInput,
  WordCountInput,
  SyncIncrementalInput,
  SaveAndSyncInput,
  CompileDocumentInput,
} from '../schemas/compiler.schema';
