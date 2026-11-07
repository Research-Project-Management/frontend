/**
 * latex-structure.ts — Lightweight LaTeX Outline, Environment & Diagnostic helpers.
 * Authoritative full-document AST outline parsing is handled by `/structure/outline`.
 */

import type { LogEntry, ParsedLog } from '@/features/editor/domain/types/compiler.types';
import type { CompilerDiagnostic } from '@/features/editor/sdk/pages/types';
import { parseLatexLog } from './compiler-logs-parser';

export { parseLatexLog } from './compiler-logs-parser';
export type { LogEntry, ParsedLog };

export interface ParsedCompileError {
  line: number | null;
  message: string;
  context: string;
  file?: string;
  severity?: 'error' | 'warning' | 'info' | 'badbox';
  code?: string;
  suggestion?: string;
  quickFix?: {
    description: string;
    replacementText: string;
  };
}

export function parseCompileErrors(
  log: string,
  diagnostics?: CompilerDiagnostic[],
): ParsedCompileError[] {
  if (diagnostics && diagnostics.length > 0) {
    return diagnostics.slice(0, 50).map((d) => ({
      file: d.file,
      line: d.line ?? null,
      message: d.message,
      context: d.context || d.message,
      severity: d.severity,
      code: d.code,
      suggestion: d.suggestion || d.quickFix?.description,
      quickFix: d.quickFix,
    }));
  }
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
      quickFix: err.quickFix,
    });
  }
  for (const warn of parsed.warnings) {
    if (errors.length >= 50) break;
    errors.push({
      file: warn.file,
      line: warn.line ?? null,
      message: warn.message.replace(/^(?:LaTeX3?|LaTeX\s+Font|(?:Package|Class|Module)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:\s*/i, '').trim(),
      context: warn.rawExcerpt || warn.message,
      severity: 'warning',
      quickFix: warn.quickFix,
    });
  }
  return errors;
}

export interface LatexSection {
  level: string;
  title: string;
  startLine: number;
}

export interface LatexEnvironment {
  type: string;
  startLine: number;
  endLine: number;
}

export interface LatexStructure {
  sections: LatexSection[];
  environments: LatexEnvironment[];
  packages: string[];
  labels: string[];
  citations: string[];
}

export interface RichEditorContext {
  filename: string;
  fileContent: string;
  totalLines: number;
  selectedText: string;
  hasSelection: boolean;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  selectedLineCount: number;
  selectedCharCount: number;
  selectedWordCount: number;
  contextBefore?: string;
  contextAfter?: string;
  currentSection?: string | null;
  currentEnvironment?: string | null;
  structure: LatexStructure;
  cursorLine: number;
  cursorCol: number;
  cursorContext?: string;
}

export function parseLatexStructure(latex: string): LatexStructure {
  const sections: LatexSection[] = [];
  const environments: LatexEnvironment[] = [];
  const packages: string[] = [];
  const labels: string[] = [];
  const citations: string[] = [];
  if (!latex) return { sections, environments, packages, labels, citations };

  const lines = latex.split(/\r?\n/);
  const envStack: Array<{ type: string; startLine: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i].replace(/(^|[^\\])%.*$/, '$1');
    const secMatch = line.match(/\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\{([^}]*)\}/);
    if (secMatch) sections.push({ level: secMatch[1], title: secMatch[2].trim(), startLine: lineNum });
    const bMatch = line.match(/\\begin\{([^}]+)\}/);
    if (bMatch) envStack.push({ type: bMatch[1].trim(), startLine: lineNum });
    const eMatch = line.match(/\\end\{([^}]+)\}/);
    if (eMatch) {
      const idx = envStack.map((e) => e.type).lastIndexOf(eMatch[1].trim());
      if (idx !== -1) {
        const [m] = envStack.splice(idx, 1);
        environments.push({ type: m.type, startLine: m.startLine, endLine: lineNum });
      }
    }
  }
  return { sections, environments, packages, labels, citations };
}

export function getLineContext(
  line: number,
  structure: LatexStructure,
): { section: string | null; environment: string | null } {
  let section: string | null = null;
  for (const s of structure.sections) {
    if (s.startLine <= line) section = `\\${s.level}{${s.title}}`;
    else break;
  }
  let environment: string | null = null;
  for (const env of structure.environments) {
    if (env.type !== 'document' && env.startLine <= line && env.endLine >= line) {
      environment = env.type;
    }
  }
  return { section, environment };
}

export function formatContextForPrompt(richCtx: RichEditorContext): string {
  return [
    richCtx.filename && `File: ${richCtx.filename}`,
    richCtx.currentSection && `Current section: ${richCtx.currentSection}`,
    richCtx.currentEnvironment && `Inside environment: \\begin{${richCtx.currentEnvironment}}`,
    richCtx.selectedText,
  ].filter(Boolean).join('\n');
}
