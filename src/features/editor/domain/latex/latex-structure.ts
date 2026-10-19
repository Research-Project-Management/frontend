/**
 * latex-structure.ts — Pure LaTeX Outline, Environment & AST utilities
 */

import type { LogEntry, ParsedLog } from '@/features/editor/domain/types/compiler.types';
import { parseLatexLog } from './compiler-logs-parser';

// ── Compile Error Parser ───────────────────────────────────────────────────────

export interface ParsedCompileError {
  line: number | null;
  message: string;
  context: string;
  file?: string;
  severity?: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
}

/** Parse pdflatex/xelatex/tectonic/bibtex/biber log to extract error and warning entries (Official Overleaf Parity) */
export function parseCompileErrors(log: string): ParsedCompileError[] {
  if (!log) return [];
  const parsed = parseLatexLog(log);
  const errors: ParsedCompileError[] = [];

  for (const err of parsed.errors) {
    if (errors.length >= 50) break;
    errors.push({
      file: err.file,
      line: err.line ?? null,
      message: err.message,
      context: err.rawExcerpt || err.detail || err.message,
      severity: 'error',
      suggestion: err.quickFix?.description,
    });
  }

  for (const warn of parsed.warnings) {
    if (errors.length >= 50) break;
    const strippedMessage = warn.message
      .replace(/^(?:LaTeX3?|LaTeX\s+Font|(?:Package|Class|Module)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:\s*/i, '')
      .trim();
    errors.push({
      file: warn.file,
      line: warn.line ?? null,
      message: strippedMessage,
      context: warn.rawExcerpt || warn.message,
      severity: 'warning',
    });
  }

  return errors;
}

// ── Raw LaTeX Log Parser ──────────────────────────────────────────────────────
export { parseLatexLog } from './compiler-logs-parser';
export type { LogEntry, ParsedLog };



