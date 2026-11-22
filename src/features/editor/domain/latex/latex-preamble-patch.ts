/**
 * latex-preamble-patch.ts
 *
 * Pure domain helpers for detecting preamble-only LaTeX snippets
 * (such as `\usepackage` / `\RequirePackage`) and computing structural
 * insertion patches that always place packages after `\documentclass`
 * and before `\begin{document}`.
 */

export interface PreambleInsertionPatch {
  from: number;
  to: number;
  originalText: string;
  insertText: string;
  updated: string;
  addedLines: string[];
  skippedLines: string[];
  changed: boolean;
}

const PREAMBLE_DECLARATION_LINE_RE =
  /^\s*\\(?:usepackage|RequirePackage|PassOptionsToPackage|usetikzlibrary)(?:\[[^\]]*\])?(?:\{[^}]*\})+\s*(?:%.*)?$/;

const DOC_CLASS_TOKEN_RE = /\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/;
const BEGIN_DOC_TOKEN_RE = /\\begin\{document\}/;
const PACKAGE_TOKEN_RE = /\\(?:usepackage|RequirePackage)(?:\[[^\]]*\])?\{[^}]+\}/;

interface IndexedLine {
  index: number;
  raw: string;
  lineStart: number;
  lineEnd: number;
  hasNewline: boolean;
  nextLineStart: number;
}

/**
 * Strips from the first unescaped `%` comment delimiter to end of line,
 * preserving escaped literal `\%`.
 */
function stripUnescapedLatexComment(line: string): string {
  let backslashes = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\') {
      backslashes += 1;
      continue;
    }
    if (ch === '%' && backslashes % 2 === 0) {
      return line.slice(0, i);
    }
    backslashes = 0;
  }
  return line;
}

function indexLines(content: string): IndexedLine[] {
  const lines: IndexedLine[] = [];
  if (content.length === 0) {
    lines.push({
      index: 0,
      raw: '',
      lineStart: 0,
      lineEnd: 0,
      hasNewline: false,
      nextLineStart: 0,
    });
    return lines;
  }

  let pos = 0;
  let index = 0;
  while (pos < content.length) {
    const nlIdx = content.indexOf('\n', pos);
    if (nlIdx === -1) {
      const raw = content.slice(pos).replace(/\r$/, '');
      lines.push({
        index,
        raw,
        lineStart: pos,
        lineEnd: pos + raw.length,
        hasNewline: false,
        nextLineStart: content.length,
      });
      break;
    }
    const raw = content.slice(pos, nlIdx).replace(/\r$/, '');
    lines.push({
      index,
      raw,
      lineStart: pos,
      lineEnd: pos + raw.length,
      hasNewline: true,
      nextLineStart: nlIdx + 1,
    });
    pos = nlIdx + 1;
    index += 1;
  }
  return lines;
}

/**
 * Returns true when every non-blank line in `snippet` is either a comment
 * or a LaTeX package/preamble declaration (with at least one declaration line).
 */
export function isPreambleOnlySnippet(snippet: string): boolean {
  if (!snippet || typeof snippet !== 'string') return false;
  const normalized = snippet.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let hasDeclaration = false;

  for (const line of normalized.split('\n')) {
    if (!line.trim()) continue;
    if (/^\s*%/.test(line)) continue;
    if (PREAMBLE_DECLARATION_LINE_RE.test(line)) {
      hasDeclaration = true;
      continue;
    }
    return false;
  }

  return hasDeclaration;
}

/**
 * Computes a structural insertion patch for preamble declarations.
 * Guarantees packages are never placed before `\documentclass{...}`.
 * Returns `null` when neither `\documentclass` nor `\begin{document}`
 * is found and `options.fallbackToTop` is false.
 */
export function computePreambleInsertion(
  content: string,
  snippet: string,
  options?: { fallbackToTop?: boolean },
): PreambleInsertionPatch | null {
  if (typeof content !== 'string' || typeof snippet !== 'string') return null;

  const lines = indexLines(content);
  let docClassLine: IndexedLine | null = null;
  let beginDocLine: IndexedLine | null = null;

  for (const line of lines) {
    const nonComment = stripUnescapedLatexComment(line.raw);
    if (!docClassLine && DOC_CLASS_TOKEN_RE.test(nonComment)) {
      docClassLine = line;
    }
    if (!beginDocLine && BEGIN_DOC_TOKEN_RE.test(nonComment)) {
      beginDocLine = line;
    }
    if (docClassLine && beginDocLine) break;
  }

  if (!docClassLine && !beginDocLine && !options?.fallbackToTop) {
    return null;
  }

  const preambleEndIdx = beginDocLine ? beginDocLine.index : lines.length;
  const existingDeclarations = new Set<string>();
  for (let i = 0; i < preambleEndIdx; i++) {
    const clean = stripUnescapedLatexComment(lines[i].raw).trim();
    if (clean) {
      existingDeclarations.add(clean);
    }
  }

  const normalizedSnippet = snippet.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const linesToInsert: string[] = [];
  const addedLines: string[] = [];
  const skippedLines: string[] = [];
  let pendingComments: string[] = [];

  for (const rawLine of normalizedSnippet.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('%')) {
      pendingComments.push(trimmed);
      continue;
    }

    if (PREAMBLE_DECLARATION_LINE_RE.test(trimmed)) {
      const normalizedDecl = stripUnescapedLatexComment(trimmed).trim();
      if (existingDeclarations.has(normalizedDecl)) {
        skippedLines.push(trimmed);
        pendingComments = [];
      } else {
        existingDeclarations.add(normalizedDecl);
        if (pendingComments.length > 0) {
          linesToInsert.push(...pendingComments);
          pendingComments = [];
        }
        linesToInsert.push(trimmed);
        addedLines.push(normalizedDecl);
      }
      continue;
    }

    if (existingDeclarations.has(trimmed)) {
      skippedLines.push(trimmed);
      pendingComments = [];
    } else {
      existingDeclarations.add(trimmed);
      if (pendingComments.length > 0) {
        linesToInsert.push(...pendingComments);
        pendingComments = [];
      }
      linesToInsert.push(trimmed);
      addedLines.push(trimmed);
    }
  }

  if (addedLines.length === 0) {
    return {
      from: 0,
      to: 0,
      originalText: '',
      insertText: '',
      updated: content,
      addedLines: [],
      skippedLines,
      changed: false,
    };
  }

  let from = 0;
  let to = 0;
  let insertText = '';

  if (docClassLine) {
    const searchUpperBound =
      beginDocLine && beginDocLine.index > docClassLine.index
        ? beginDocLine.index
        : lines.length;
    let lastPackageLine: IndexedLine | null = null;
    for (let i = docClassLine.index + 1; i < searchUpperBound; i++) {
      const nonComment = stripUnescapedLatexComment(lines[i].raw);
      if (PACKAGE_TOKEN_RE.test(nonComment)) {
        lastPackageLine = lines[i];
      }
    }

    const anchorLine = lastPackageLine ?? docClassLine;
    if (anchorLine.hasNewline) {
      from = anchorLine.nextLineStart;
      to = anchorLine.nextLineStart;
      insertText = `${linesToInsert.join('\n')}\n`;
    } else {
      from = content.length;
      to = content.length;
      insertText = `\n${linesToInsert.join('\n')}`;
    }
  } else if (beginDocLine) {
    from = beginDocLine.lineStart;
    to = beginDocLine.lineStart;
    insertText = `${linesToInsert.join('\n')}\n`;
  } else {
    from = 0;
    to = 0;
    insertText = `${linesToInsert.join('\n')}\n`;
  }

  const updated = content.slice(0, from) + insertText + content.slice(to);
  return {
    from,
    to,
    originalText: '',
    insertText,
    updated,
    addedLines,
    skippedLines,
    changed: true,
  };
}
