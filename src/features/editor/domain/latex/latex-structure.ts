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

// ── LaTeX AST Structure & Line Context ──────────────────────────────────────────

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

  if (!latex) {
    return { sections, environments, packages, labels, citations };
  }

  const lines = latex.split(/\r?\n/);
  const envStack: Array<{ type: string; startLine: number }> = [];

  const beginRegex = /\\begin\{([^}]+)\}/g;
  const endRegex = /\\end\{([^}]+)\}/g;
  const pkgRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  const labelRegex = /\\label\{([^}]+)\}/g;
  const citeRegex = /\\(?:cite|citet|citep|citealp|citealt|citeauthor|citeyear|citeyearpar|autocite|parencite|textcite|footcite|nocite|newcite|shortcite)\*?(?:\[[^\]]*\])*\{([^}]+)\}/g;

  let iffalseDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    // Strip unescaped % comments
    const rawLine = lines[i];
    const line = rawLine.replace(/(^|[^\\])%.*$/, '$1');

    if (/\\iffalse\b/.test(line)) {
      iffalseDepth++;
    }
    if (/\\fi\b/.test(line)) {
      if (iffalseDepth > 0) iffalseDepth--;
      continue;
    }
    if (iffalseDepth > 0) {
      continue;
    }

    // 1. Sections (supports nested braces in titles)
    const secCmdMatch = line.match(/\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\{/);
    if (secCmdMatch && secCmdMatch.index !== undefined) {
      const level = secCmdMatch[1];
      const openBraceIdx = secCmdMatch.index + secCmdMatch[0].length - 1;
      let depth = 0;
      let closeBraceIdx = -1;
      for (let k = openBraceIdx; k < line.length; k++) {
        if (line[k] === '{' && line[k - 1] !== '\\') depth++;
        else if (line[k] === '}' && line[k - 1] !== '\\') {
          depth--;
          if (depth === 0) {
            closeBraceIdx = k;
            break;
          }
        }
      }
      if (closeBraceIdx !== -1) {
        sections.push({
          level,
          title: line.slice(openBraceIdx + 1, closeBraceIdx).trim(),
          startLine: lineNum,
        });
      }
    }

    // 2. Environments
    let bMatch: RegExpExecArray | null;
    beginRegex.lastIndex = 0;
    while ((bMatch = beginRegex.exec(line)) !== null) {
      envStack.push({
        type: bMatch[1].trim(),
        startLine: lineNum,
      });
    }

    let eMatch: RegExpExecArray | null;
    endRegex.lastIndex = 0;
    while ((eMatch = endRegex.exec(line)) !== null) {
      const endType = eMatch[1].trim();
      const lastIdx = envStack.map((e) => e.type).lastIndexOf(endType);
      if (lastIdx !== -1) {
        const [matched] = envStack.splice(lastIdx, 1);
        environments.push({
          type: matched.type,
          startLine: matched.startLine,
          endLine: lineNum,
        });
      }
    }

    // 3. Packages
    let pMatch: RegExpExecArray | null;
    pkgRegex.lastIndex = 0;
    while ((pMatch = pkgRegex.exec(line)) !== null) {
      const pkgs = pMatch[1].split(',').map((p) => p.trim()).filter(Boolean);
      for (const p of pkgs) {
        if (!packages.includes(p)) packages.push(p);
      }
    }

    // 4. Labels
    let lMatch: RegExpExecArray | null;
    labelRegex.lastIndex = 0;
    while ((lMatch = labelRegex.exec(line)) !== null) {
      const lbl = lMatch[1].trim();
      if (lbl && !labels.includes(lbl)) labels.push(lbl);
    }

    // 5. Citations
    let cMatch: RegExpExecArray | null;
    citeRegex.lastIndex = 0;
    while ((cMatch = citeRegex.exec(line)) !== null) {
      const cites = cMatch[1].split(',').map((c) => c.trim()).filter(Boolean);
      for (const c of cites) {
        if (!citations.includes(c)) citations.push(c);
      }
    }
  }

  return {
    sections,
    environments,
    packages,
    labels,
    citations,
  };
}

export function getLineContext(
  line: number,
  structure: LatexStructure,
): { section: string | null; environment: string | null } {
  let activeSection: string | null = null;
  for (const s of structure.sections) {
    if (s.startLine <= line) {
      activeSection = `\\${s.level}{${s.title}}`;
    } else {
      break;
    }
  }

  let activeEnvironment: string | null = null;
  let smallestSpan = Infinity;
  for (const env of structure.environments) {
    if (env.type !== 'document' && env.startLine <= line && env.endLine >= line) {
      const span = env.endLine - env.startLine;
      if (span <= smallestSpan) {
        smallestSpan = span;
        activeEnvironment = env.type;
      }
    }
  }

  return {
    section: activeSection,
    environment: activeEnvironment,
  };
}

export function formatContextForPrompt(richCtx: RichEditorContext): string {
  const parts: string[] = [];
  if (richCtx.filename) parts.push(`File: ${richCtx.filename}`);
  if (richCtx.currentSection) parts.push(`Current section: ${richCtx.currentSection}`);
  if (richCtx.currentEnvironment) parts.push(`Inside environment: \\begin{${richCtx.currentEnvironment}}`);
  if (richCtx.selectedText) parts.push(richCtx.selectedText);
  return parts.join('\n');
}



