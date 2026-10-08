/**
 * latex-structure.ts — Pure LaTeX Outline, Environment & AST utilities
 */

import { API_BASE_URL } from '@/config/env';
import type { LogEntry, ParsedLog } from '../types/compiler.types';


// ── Document Structure ────────────────────────────────────────────────────────

export interface LatexSection {
  level: "section" | "subsection" | "subsubsection";
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
  totalLines: number;
}

export function parseLatexStructure(content: any): LatexStructure {
  const str = typeof content === 'string'
    ? content
    : content && typeof content === 'object'
      ? (content.source || content.text || content.content || '')
      : '';
  const lines = str.split("\n");
  const sections: LatexSection[] = [];
  const environments: LatexEnvironment[] = [];
  const packages: string[] = [];
  const labels: string[] = [];
  const citations: string[] = [];

  const envStack: { type: string; startLine: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1; // 1-based

    // Sections
    const secMatch = line.match(/\\((?:sub){0,2}section)\*?\{([^}]*)\}/);
    if (secMatch) {
      const raw = secMatch[1] as string;
      const level =
        raw === "section"
          ? "section"
          : raw === "subsection"
            ? "subsection"
            : "subsubsection";
      sections.push({ level, title: secMatch[2], startLine: ln });
    }

    // Packages
    const pkgMatch = line.match(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/);
    if (pkgMatch) {
      pkgMatch[1].split(",").forEach((p: string) => {
        const pkg = p.trim();
        if (pkg && !packages.includes(pkg)) packages.push(pkg);
      });
    }

    // Labels
    const labelMatch = line.match(/\\label\{([^}]+)\}/);
    if (labelMatch && !labels.includes(labelMatch[1])) {
      labels.push(labelMatch[1]);
    }

    // Citations
    const citeMatch = line.match(/\\cite(?:\[[^\]]*\])?\{([^}]+)\}/g);
    if (citeMatch) {
      citeMatch.forEach((m: string) => {
        const inner = m.match(/\{([^}]+)\}/)?.[1] ?? "";
        inner.split(",").forEach((c: string) => {
          const cite = c.trim();
          if (cite && !citations.includes(cite)) citations.push(cite);
        });
      });
    }

    // Environments
    const beginMatch = line.match(/\\begin\{([^}]+)\}/);
    if (beginMatch) envStack.push({ type: beginMatch[1], startLine: ln });

    const endMatch = line.match(/\\end\{([^}]+)\}/);
    if (endMatch && envStack.length > 0) {
      const top = envStack[envStack.length - 1];
      if (top.type === endMatch[1]) {
        envStack.pop();
        if (top.type !== "document") {
          environments.push({ type: top.type, startLine: top.startLine, endLine: ln });
        }
      }
    }
  }

  return { sections, environments, packages, labels, citations, totalLines: lines.length };
}

/** Find what section and environment a line falls inside */
export function getLineContext(
  lineNumber: number,
  structure: LatexStructure,
): { section: string | null; environment: string | null } {
  let section: string | null = null;
  for (const s of structure.sections) {
    if (s.startLine <= lineNumber) section = `\\${s.level}{${s.title}}`;
    else break;
  }

  let environment: string | null = null;
  for (const env of structure.environments) {
    if (env.startLine <= lineNumber && env.endLine >= lineNumber) {
      environment = env.type;
    }
  }

  return { section, environment };
}

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

/** Parse pdflatex/xelatex/tectonic log to extract error and warning entries */
export function parseCompileErrors(log: string): ParsedCompileError[] {
  if (!log) return [];
  const errors: ParsedCompileError[] = [];
  const lines = log.split("\n");
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    if (errors.length >= 50) break;
    const line = lines[i];

    // File:line error: ./main.tex:14: Undefined control sequence
    const fileLineMatch = line.match(/^(\.{0,2}\/?[^\s:!]+\.(?:tex|bib|sty|cls)):(\d+):\s*(.+)$/i);
    if (fileLineMatch) {
      const file = fileLineMatch[1].trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
      const lineNum = parseInt(fileLineMatch[2], 10);
      const message = fileLineMatch[3].trim();
      const key = `f:${file}:${lineNum}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          file,
          line: lineNum,
          message,
          context: line,
          severity: 'error',
        });
      }
      continue;
    }

    // LaTeX hard error: ! Error message
    if (line.startsWith("!")) {
      const message = line.slice(1).trim();
      let errorLine: number | null = null;
      let context = "";
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const m = lines[j].match(/^l\.(\d+)/);
        if (m) {
          errorLine = parseInt(m[1], 10);
          context = lines.slice(i, j + 2).join("\n");
          break;
        }
      }
      if (!context) context = lines.slice(i, i + 4).join("\n");

      const key = `h:${errorLine ?? ''}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({ line: errorLine, message, context, severity: 'error' });
      }
      continue;
    }

    // Warning: Undefined reference / citation / LaTeX Warning
    const warnMatch = line.match(/(?:LaTeX|Package [^\s]+) Warning:.*?(?:on input line (\d+)|input line (\d+))/i);
    if (warnMatch) {
      const warnLine = parseInt(warnMatch[1] || warnMatch[2], 10);
      const message = line.replace(/^(?:LaTeX|Package [^\s]+) Warning:\s*/i, "").trim();
      const key = `w:${warnLine}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({ line: warnLine, message, context: line, severity: 'warning' });
      }
    }
  }

  return errors;
}

// ── Rich Editor Context ────────────────────────────────────────────────────────

export interface RichEditorContext {
  fileContent: string;
  filename: string;
  totalLines: number;

  hasSelection: boolean;
  selectedText: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  selectedLineCount: number;
  selectedCharCount: number;
  selectedWordCount: number;

  contextBefore: string;
  contextAfter: string;

  currentSection: string | null;
  currentEnvironment: string | null;

  structure: LatexStructure;

  cursorLine: number;
  cursorCol: number;
  cursorContext: string;
}

export function buildRichContext(
  editor: any,
  filename: string,
): RichEditorContext {
  const model = editor.getModel();
  const fullContent = model?.getValue() ?? "";
  const totalLines = model?.getLineCount() ?? 0;
  const position = editor.getPosition();
  const selectionRange = editor.getSelection();

  const cursorLine = position?.lineNumber ?? 1;
  const cursorCol = position?.column ?? 1;

  const ctxStart = Math.max(1, cursorLine - 10);
  const ctxEnd = Math.min(totalLines, cursorLine + 10);
  const cursorContext = Array.from(
    { length: ctxEnd - ctxStart + 1 },
    (_, i) => model?.getLineContent(ctxStart + i) ?? "",
  ).join("\n");

  const hasSelection =
    !!selectionRange &&
    (selectionRange.startLineNumber !== selectionRange.endLineNumber ||
      selectionRange.startColumn !== selectionRange.endColumn);

  const selectedText = hasSelection && selectionRange && model
    ? model.getValueInRange(selectionRange)
    : "";

  const startLine = selectionRange?.startLineNumber ?? cursorLine;
  const endLine = selectionRange?.endLineNumber ?? cursorLine;
  const startCol = selectionRange?.startColumn ?? cursorCol;
  const endCol = selectionRange?.endColumn ?? cursorCol;

  const selectedLineCount = endLine - startLine + 1;
  const selectedCharCount = selectedText.length;
  const selectedWordCount = selectedText
    ? selectedText.split(/\s+/).filter(Boolean).length
    : 0;

  const surStart = Math.max(1, startLine - 15);
  const surEnd = Math.min(totalLines, endLine + 15);

  const contextBefore = Array.from(
    { length: Math.max(0, startLine - surStart) },
    (_, i) => model?.getLineContent(surStart + i) ?? "",
  ).join("\n");

  const contextAfter = Array.from(
    { length: Math.max(0, surEnd - endLine) },
    (_, i) => model?.getLineContent(endLine + 1 + i) ?? "",
  ).join("\n");

  const structure = parseLatexStructure(fullContent);
  const { section, environment } = getLineContext(startLine, structure);

  return {
    fileContent: fullContent,
    filename,
    totalLines,
    hasSelection,
    selectedText,
    startLine,
    endLine,
    startCol,
    endCol,
    selectedLineCount,
    selectedCharCount,
    selectedWordCount,
    contextBefore,
    contextAfter,
    currentSection: section,
    currentEnvironment: environment,
    structure,
    cursorLine,
    cursorCol,
    cursorContext,
  };
}

/** Format rich context into a system-prompt-friendly string */
export function formatContextForPrompt(ctx: RichEditorContext): string {
  const parts: string[] = [];

  parts.push(`File: ${ctx.filename} (${ctx.totalLines} lines total)`);

  if (ctx.currentSection) parts.push(`Current section: ${ctx.currentSection}`);
  if (ctx.currentEnvironment) parts.push(`Inside environment: \\begin{${ctx.currentEnvironment}}`);

  if (ctx.structure.packages.length > 0) {
    parts.push(`Packages: ${ctx.structure.packages.slice(0, 10).join(", ")}`);
  }
  if (ctx.structure.labels.length > 0) {
    parts.push(`Defined labels: ${ctx.structure.labels.slice(0, 15).join(", ")}`);
  }

  if (ctx.hasSelection) {
    const range =
      ctx.startLine === ctx.endLine
        ? `line ${ctx.startLine}`
        : `lines ${ctx.startLine}–${ctx.endLine}`;
    parts.push(`\nSelected (${range}, ${ctx.selectedWordCount} words):\n\`\`\`latex\n${ctx.selectedText}\n\`\`\``);
    if (ctx.contextBefore) parts.push(`\nContext before:\n\`\`\`latex\n${ctx.contextBefore}\n\`\`\``);
    if (ctx.contextAfter) parts.push(`\nContext after:\n\`\`\`latex\n${ctx.contextAfter}\n\`\`\``);
  } else {
    parts.push(`Cursor at line ${ctx.cursorLine}, col ${ctx.cursorCol}`);
    parts.push(`\nSurrounding context:\n\`\`\`latex\n${ctx.cursorContext}\n\`\`\``);
  }

  return parts.join("\n");
}

// ── File URL Resolution ────────────────────────────────────────────────────────

/** Resolve a relative backend file URL to an absolute URL. */
export function resolveFileUrl(fileUrl?: string | null): string {
  if (!fileUrl) return '';
  if (
    fileUrl.startsWith('http://') ||
    fileUrl.startsWith('https://') ||
    fileUrl.startsWith('blob:')
  ) {
    return fileUrl;
  }
  const cleanUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${API_BASE_URL}${cleanUrl}`;
}


// ── Lightweight Event Bus ─────────────────────────────────────────────────────

type EventListener = (...args: any[]) => void;

class EditorEventBusImpl {
  private listeners: Map<string, Set<EventListener>> = new Map();

  on(event: string, callback: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventListener): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`[EditorEventBus] Error in listener for ${event}:`, err);
      }
    });
  }
}

export const EditorEventBus = new EditorEventBusImpl();

// ── Raw LaTeX Log Parser ──────────────────────────────────────────────────────

export type { LogEntry, ParsedLog };

const PARSED_LOG_CACHE_MAX = 5;
const parsedLogCache = new Map<string, ParsedLog>();

export function parseLatexLog(raw: string): ParsedLog {
  if (!raw) return { errors: [], warnings: [], badBoxes: [] };
  const cached = parsedLogCache.get(raw);
  if (cached) return cached;

  const lines = raw.split('\n');
  const errors: LogEntry[] = [];
  const warnings: LogEntry[] = [];
  const badBoxes: LogEntry[] = [];
  const seen = new Set<string>();

  const tryAdd = (arr: LogEntry[], entry: LogEntry, max: number = 300) => {
    if (arr.length >= max) return;
    const sanitizedEntry: LogEntry = {
      ...entry,
      message: entry.message ? entry.message.replace(/—/g, '-') : '',
      detail: entry.detail ? entry.detail.replace(/—/g, '-') : undefined,
      rawExcerpt: entry.rawExcerpt ? entry.rawExcerpt.replace(/—/g, '-') : undefined,
    };
    const key = `${sanitizedEntry.file ?? ''}|${sanitizedEntry.line ?? ''}|${sanitizedEntry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      arr.push(sanitizedEntry);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hard errors: lines starting with !
    if (line.startsWith('!')) {
      const message = line.slice(1).trim();
      let lineNum: number | undefined;
      let detail: string | undefined;
      const excerptLines: string[] = [];
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const cur = lines[j];
        if (cur.startsWith('!')) break;
        excerptLines.push(cur);
        const m = cur.match(/^l\.(\d+)\s*(.*)/);
        if (m) {
          lineNum = parseInt(m[1], 10);
          const rawDetail = m[2].trim();
          detail = rawDetail && !/^[@^~.?!\s]+$/.test(rawDetail) && rawDetail.length > 1 ? rawDetail : undefined;
          for (let k = j + 1; k < Math.min(j + 3, lines.length); k++) {
            if (lines[k] && !lines[k].startsWith('!')) {
              excerptLines.push(lines[k]);
            }
          }
          break;
        }
      }
      const rawExcerpt = excerptLines.filter((l) => l.trim().length > 0).join('\n');
      tryAdd(errors, { message, line: lineNum, detail, rawExcerpt: rawExcerpt || undefined });
    }

    // File:line: format errors (e.g. ./main.tex:10: Undefined control sequence)
    const fle = line.match(/^(\.{1,2}\/[^\s:!]*\.(?:tex|sty|cls|bib)):(\d+):\s*(.+)$/);
    if (fle) {
      const excerptLines: string[] = [line];
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (lines[j] && !lines[j].startsWith('!') && !lines[j].includes('Warning:')) {
          excerptLines.push(lines[j]);
        } else {
          break;
        }
      }
      tryAdd(errors, {
        message: fle[3].trim(),
        file: fle[1].replace(/^\.\//, ''),
        line: parseInt(fle[2], 10),
        rawExcerpt: excerptLines.join('\n'),
      });
    }

    // Warnings: LaTeX Warning:, Package X Warning:, Class X Warning:, pdfTeX warning:
    if (/(?:LaTeX|(?:Package|Class)\s+\S+|pdfTeX|xdvipdfmx)\s+[Ww]arning:/.test(line)) {
      let msg = line.trim();
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j])) msg += ' ' + lines[j].trim();
        else break;
      }
      const lineRef = msg.match(/input line (\d+)/);
      tryAdd(warnings, {
        message: msg,
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }

    // Bad boxes: Overfull/Underfull \hbox or \vbox
    if (/^(Overfull|Underfull)\s*\\[hv]box/.test(line)) {
      const lineRef = line.match(/lines?\s+(\d+)/);
      tryAdd(badBoxes, {
        message: line.trim(),
        line: lineRef ? parseInt(lineRef[1], 10) : undefined,
      });
    }
  }

  const result: ParsedLog = { errors, warnings, badBoxes };
  if (parsedLogCache.size >= PARSED_LOG_CACHE_MAX) {
    const firstKey = parsedLogCache.keys().next().value;
    if (firstKey) parsedLogCache.delete(firstKey);
  }
  parsedLogCache.set(raw, result);

  return result;
}

