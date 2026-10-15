/**
 * latex-structure.ts — Pure LaTeX Outline, Environment & AST utilities
 */

import { API_BASE_URL } from '@/config/env';
import type { LogEntry, ParsedLog } from '@/features/editor/domain/types/compiler.types';
import {
  unwrapLatexLogLines,
  normalizeCompilerLogPath,
} from '@/features/editor/subsystems/compiler/logs/compiler-logs.parser';


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

function stripLatexLineComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '%') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 0) return line.slice(0, i);
    }
  }
  return line;
}

function extractBalancedBraceContent(str: string, openBraceIdx: number): { content: string; endIdx: number } | null {
  if (str[openBraceIdx] !== '{') return null;
  let depth = 0;
  for (let i = openBraceIdx; i < str.length; i++) {
    const ch = str[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { content: str.slice(openBraceIdx + 1, i), endIdx: i };
      }
    }
  }
  return null;
}

export function parseLatexStructure(content: unknown): LatexStructure {
  const obj = content && typeof content === 'object' ? (content as Record<string, unknown>) : null;
  const str = typeof content === 'string'
    ? content
    : obj
      ? String(obj.source || obj.text || obj.content || '')
      : '';
  const lines = str.split("\n");
  const sections: LatexSection[] = [];
  const environments: LatexEnvironment[] = [];
  const packages: string[] = [];
  const labels: string[] = [];
  const citations: string[] = [];

  const envStack: { type: string; startLine: number }[] = [];
  let iffalseDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const ln = i + 1; // 1-based
    const line = stripLatexLineComment(rawLine);

    if (/\\iffalse\b/.test(line)) {
      iffalseDepth++;
    }
    if (iffalseDepth > 0) {
      if (/\\fi\b/.test(line)) {
        iffalseDepth = Math.max(0, iffalseDepth - 1);
      }
      continue;
    }

    // Sections (supports nested braces like \section{Analysis of \textsc{TinT} and $\mathcal{O}(d^2)$})
    const secHeadMatch = line.match(/\\((?:sub){0,2}section)\*?(?:\[[^\]]*\])?\{/);
    if (secHeadMatch && secHeadMatch.index !== undefined) {
      const raw = secHeadMatch[1] as string;
      const braceIdx = secHeadMatch.index + secHeadMatch[0].length - 1;
      const balanced = extractBalancedBraceContent(line, braceIdx);
      const title = balanced ? balanced.content : line.slice(braceIdx + 1).replace(/\}.*$/, '');
      const level =
        raw === "section"
          ? "section"
          : raw === "subsection"
            ? "subsection"
            : "subsubsection";
      sections.push({ level, title, startLine: ln });
    }

    // Packages
    const pkgMatches = line.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g);
    for (const pkgMatch of pkgMatches) {
      pkgMatch[1].split(",").forEach((p: string) => {
        const pkg = p.trim();
        if (pkg && !packages.includes(pkg)) packages.push(pkg);
      });
    }

    // Labels (all occurrences on the line)
    const labelMatches = line.matchAll(/\\label\{([^}]+)\}/g);
    for (const labelMatch of labelMatches) {
      const lbl = labelMatch[1].trim();
      if (lbl && !labels.includes(lbl)) {
        labels.push(lbl);
      }
    }

    // Citations (standard, natbib, biblatex, ACL \newcite / \shortcite)
    const citeMatches = line.matchAll(
      /\\(?:cite|citet|citep|citealp|citealt|citeauthor|citeyear|newcite|shortcite|parencite|textcite|autocite)\*?(?:\[[^\]]*\])*\{([^}]+)\}/g,
    );
    for (const m of citeMatches) {
      m[1].split(",").forEach((c: string) => {
        const cite = c.trim();
        if (cite && !citations.includes(cite)) citations.push(cite);
      });
    }

    // Environments (in left-to-right token order to handle single-line \begin...\end)
    const envTokens = line.matchAll(/\\(begin|end)\{([^}]+)\}/g);
    for (const tok of envTokens) {
      const kind = tok[1];
      const envName = tok[2].trim();
      if (kind === 'begin') {
        envStack.push({ type: envName, startLine: ln });
      } else if (kind === 'end' && envStack.length > 0) {
        const top = envStack[envStack.length - 1];
        if (top.type === envName) {
          envStack.pop();
          if (top.type !== "document") {
            environments.push({ type: top.type, startLine: top.startLine, endLine: ln });
          }
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

/** Parse pdflatex/xelatex/tectonic/bibtex/biber log to extract error and warning entries (Official Overleaf Parity) */
export function parseCompileErrors(log: string): ParsedCompileError[] {
  if (!log) return [];
  const errors: ParsedCompileError[] = [];
  const lines = unwrapLatexLogLines(log);
  const seen = new Set<string>();
  let seenEnvironmentError = false;

  const fatalSummaryMsg = "==> Fatal error occurred, no output PDF file produced!";
  const hasSpecificHardError = lines.some((l) => {
    const t = l.trim();
    return (t.startsWith("!") && t.slice(1).trim() !== fatalSummaryMsg) || /^Runaway argument\??/i.test(t);
  });

  let openParens = 0;
  let rootUserFile: string | undefined;
  const fileStack: string[] = [];
  const getCurrentTrackedFile = (): string | undefined => {
    return fileStack.length > 0 ? fileStack[fileStack.length - 1] : rootUserFile;
  };
  const consumeFilePath = (rest: string): { path: string; consumed: number } | null => {
    if (rest.startsWith('"')) {
      const closeQuote = rest.indexOf('"', 1);
      if (closeQuote !== -1) {
        const candidate = rest.slice(1, closeQuote);
        if (candidate.includes('/') || /\.(?:tex|sty|cls|bib|bbl|aux|toc|out|def|cfg|clo|dfu|fd|mkii|ldf)$/i.test(candidate)) {
          return { path: candidate, consumed: closeQuote + 1 };
        }
      }
    }
    const hasSlashPrefix = /^\/?([^ ()\\]+\/)+/.test(rest);
    const hasExtPrefix = /^[^\s()]+\.(?:tex|sty|cls|bib|bbl|aux|toc|out|def|cfg|clo|dfu|fd|mkii|ldf)/i.test(rest);
    if (!hasSlashPrefix && !hasExtPrefix) {
      return null;
    }
    let endOfFilePath = rest.search(/[ ()\\]/);
    while (endOfFilePath !== -1 && rest[endOfFilePath] === ' ') {
      const partialPath = rest.slice(0, endOfFilePath);
      if (/\.\w+$/.test(partialPath)) {
        break;
      }
      const remainingPath = rest.slice(endOfFilePath + 1);
      if (/^\s*["()[\]]/.test(remainingPath)) {
        break;
      }
      const nextEndOfPath = remainingPath.search(/[ "()[\]]/);
      if (nextEndOfPath === -1) {
        endOfFilePath = -1;
      } else {
        endOfFilePath += nextEndOfPath + 1;
      }
    }
    const matchedPath = endOfFilePath === -1 ? rest : rest.slice(0, endOfFilePath);
    if (!/[a-z]/.test(matchedPath) && !/\.\w+$/.test(matchedPath)) {
      return null;
    }
    return { path: matchedPath, consumed: matchedPath.length };
  };
  const updateParenStack = (text: string) => {
    let idx = 0;
    while (idx < text.length) {
      const ch = text[idx];
      if (ch === "(") {
        const rest = text.slice(idx + 1);
        const consumed = consumeFilePath(rest);
        if (consumed) {
          const rawMatched = consumed.path.replace(/\\/g, "/");
          const isSystemTexPath =
            rawMatched.includes("texmf") ||
            rawMatched.includes("texlive") ||
            /\.(?:sty|cls|def|cfg|clo|dfu|fd|mkii|ldf)$/i.test(rawMatched);
          if (!isSystemTexPath) {
            const normalizedPath = normalizeCompilerLogPath(rawMatched);
            if (normalizedPath) {
              if (!rootUserFile) rootUserFile = normalizedPath;
              fileStack.push(normalizedPath);
            } else {
              openParens++;
            }
          } else {
            openParens++;
          }
          idx += 1 + consumed.consumed;
          continue;
        } else {
          openParens++;
        }
      } else if (ch === ")") {
        if (openParens > 0) {
          openParens--;
        } else if (fileStack.length > 1) {
          fileStack.pop();
        }
      }
      idx++;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    if (errors.length >= 50) break;
    const line = lines[i];

    // Official Overleaf `parseRunawayArgumentError`: Runaway argument?
    if (/^Runaway argument\??$/i.test(line.trim())) {
      const activeFile = getCurrentTrackedFile();
      let message = line.trim();
      let errorLine: number | null = null;
      const excerptLines: string[] = [line];
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const cur = lines[j];
        if (cur.startsWith("!")) {
          const bangMsg = cur.slice(1).trim();
          if (bangMsg && bangMsg !== fatalSummaryMsg && !/^Emergency stop/i.test(bangMsg)) {
            excerptLines.push(cur);
            if (message === line.trim()) {
              message = `Runaway argument? ${bangMsg}`;
            }
            i = j;
            continue;
          } else {
            break;
          }
        }
        excerptLines.push(cur);
        const m = cur.match(/^l\.(\d+)/);
        if (m) {
          errorLine = parseInt(m[1], 10);
          i = Math.max(i, j);
          break;
        }
      }
      const key = `r:${activeFile ?? ""}:${errorLine ?? ""}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          file: activeFile,
          line: errorLine,
          message,
          context: excerptLines.join("\n"),
          severity: "error",
        });
      }
      continue;
    }

    // File:line error: ./main.tex:14: Undefined control sequence
    const fileLineMatch = line.match(/^([^:!]*\.(?:tex|bib|sty|cls)):(\d+):\s*(.+)$/i);
    if (fileLineMatch) {
      const file = normalizeCompilerLogPath(fileLineMatch[1]);
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
      updateParenStack(line);
      continue;
    }

    // LaTeX hard error: ! Error message
    if (line.startsWith("!")) {
      const message = line.slice(1).trim();
      if (message === fatalSummaryMsg && hasSpecificHardError) {
        continue;
      }
      const isCascadingEnvError =
        /Error:\s*`\\end\{([^}]+)\}'\s*expected,?\s*but\s*found\s*`\\end\{([^}]+)\}'/i.test(message) ||
        /Error:\s*Found\s*`\\end\{([^}]+)\}'\s*without\s*corresponding\s*\\begin/i.test(message);
      if (isCascadingEnvError && seenEnvironmentError) {
        continue;
      }
      const isPrimaryEnvError =
        /LaTeX Error:\s*\\begin\{([^}]+)\}(?:\s+on input line \d+)?\s+ended by\s+\\end\{([^}]+)\}/i.test(message) ||
        /Error:\s*`([^']{2,})'\s*expected,\s*found\s*`([^']{2,})'/i.test(message) ||
        isCascadingEnvError;
      if (isPrimaryEnvError) {
        seenEnvironmentError = true;
      }
      const activeFile = getCurrentTrackedFile();
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

      const key = `h:${activeFile ?? ''}:${errorLine ?? ''}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({ file: activeFile, line: errorLine, message, context, severity: 'error' });
      }
      continue;
    }

    // Official Overleaf `BibLogParser` — BibTeX Errors (`---line <N> of file <file.bib>`)
    const bibErrMatch = line.trim().match(/^(.*?)---line\s+(\d+)\s+of\s+file\s+(\S+)$/i);
    if (bibErrMatch && !/^Warning--/i.test(line.trim())) {
      const prevLineText = i > 0 ? lines[i - 1].trim() : "";
      const reason = bibErrMatch[1].trim() || prevLineText;
      const bibLine = parseInt(bibErrMatch[2], 10);
      const bibFile = bibErrMatch[3].replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/^\/+/, "");
      const excerptLines: string[] = reason && !bibErrMatch[1].trim() ? [prevLineText, line.trim()] : [line.trim()];
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        excerptLines.push(lines[j]);
        if (/I'm skipping whatever remains of this (?:entry|command)/i.test(lines[j])) {
          i = j;
          break;
        }
      }
      const message = `BibTeX error: ${reason} (in ${bibFile}, line ${bibLine})`;
      const key = `bib:${bibFile}:${bibLine}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          file: bibFile,
          line: bibLine,
          message,
          context: excerptLines.join("\n"),
          severity: "error",
        });
      }
      continue;
    }

    // Official Overleaf `BibLogParser` — Biber Subsystem Errors & Warnings
    const biberMatch = line.trim().match(/^(?:Biber\s+warning:\s*|\[\d+\]\s+\S+>\s+)?(WARN|ERROR)\s+-\s+(.*)$/i);
    if (biberMatch) {
      const level = biberMatch[1].toUpperCase();
      const body = biberMatch[2].trim();
      const subsysMatch = body.match(
        /^BibTeX subsystem:\s*(?:.*\/)?([A-Za-z0-9_.-]+\.bib)(?:_\d+\.utf8)?,\s*line\s+(\d+),\s*(.+)$/i
      );
      const genericLineMatch = body.match(/,\s*line\s+(\d+),\s*(.+)$/i);
      const file = subsysMatch ? subsysMatch[1] : getCurrentTrackedFile();
      const lineNum = subsysMatch
        ? parseInt(subsysMatch[2], 10)
        : genericLineMatch
          ? parseInt(genericLineMatch[1], 10)
          : null;
      const message =
        level === "ERROR"
          ? subsysMatch
            ? `Biber error: ${subsysMatch[3].trim()}`
            : `Biber error: ${body}`
          : `WARN - ${body}`;
      const severity = level === "ERROR" ? "error" : "warning";
      const key = `biber:${file ?? ""}:${lineNum ?? ""}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({
          file,
          line: lineNum,
          message,
          context: line.trim(),
          severity,
        });
      }
      continue;
    }

    // Warning: Undefined reference / citation / LaTeX / LaTeX3 / Package / Class / Module Warning
    const warnMatch = line.match(/(?:LaTeX3?|LaTeX\s+Font|(?:Package|Class|Module) [^\s]+) Warning:.*?(?:on input line (\d+)|input line (\d+))?/i);
    if (warnMatch && /(?:LaTeX3?|LaTeX\s+Font|(?:Package|Class|Module) [^\s]+) Warning:/i.test(line)) {
      const activeFile = getCurrentTrackedFile();
      let fullWarn = line.trim();
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        if (/^\s{2,}/.test(lines[j]) || /^\([A-Za-z0-9_-]+\)\s+/.test(lines[j])) {
          const cleanCont = lines[j].replace(/^\([A-Za-z0-9_-]+\)\s*/, "").trim();
          if (cleanCont) {
            fullWarn += " " + cleanCont;
          }
          i = j;
        } else {
          break;
        }
      }
      const lineRef = fullWarn.match(/(?:on input line|input line|line)\s+(\d+)/i);
      const warnLine = lineRef ? parseInt(lineRef[1], 10) : null;
      const message = fullWarn.replace(/^(?:LaTeX3?|LaTeX\s+Font|(?:Package|Class|Module) [^\s]+) Warning:\s*/i, "").trim();
      const key = `w:${activeFile ?? ''}:${warnLine ?? ''}:${message}`;
      if (!seen.has(key)) {
        seen.add(key);
        errors.push({ file: activeFile, line: warnLine, message, context: fullWarn, severity: 'warning' });
      }
      updateParenStack(line);
      continue;
    }

    updateParenStack(line);
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

export interface EditorSelectionRangeLike {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
}

export interface EditorLike {
  getModel(): {
    getValue(): string;
    getLineCount(): number;
    getLineContent(lineNumber: number): string;
    getValueInRange(range: EditorSelectionRangeLike): string;
  } | null | undefined;
  getPosition(): { lineNumber: number; column: number } | null | undefined;
  getSelection(): EditorSelectionRangeLike | null | undefined;
}

export function buildRichContext(
  editor: EditorLike,
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

type EventListener = (...args: unknown[]) => void;

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

  emit(event: string, ...args: unknown[]): void {
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
export { parseLatexLog } from '@/features/editor/subsystems/compiler/logs/compiler-logs.parser';
export type { LogEntry, ParsedLog };


