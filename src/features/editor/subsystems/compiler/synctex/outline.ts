/**
 * pdf-outline.ts
 *
 * Utilities for extracting and resolving document outlines/bookmarks from PDF.js instances
 * and mapping backend-extracted LaTeX outline DTOs.
 */

import { logger } from '@/shared/lib/logger';
import type { LatexOutlineEntryDto } from '@/features/editor/sdk/pages/types';
import { resolveForward, type SyncTeXMap } from './synctex';

export interface PdfOutlineItem {
  id: string;
  title: string;
  pageNumber: number;
  level: number;
}

interface PdfJsOutlineItem {
  title: string;
  dest?: string | unknown[];
  items?: PdfJsOutlineItem[];
}

export interface PdfJsDocument {
  getOutline: () => Promise<PdfJsOutlineItem[] | null>;
  getDestination: (dest: string) => Promise<unknown[] | null>;
  getPageIndex: (ref: unknown) => Promise<number>;
}

/**
 * Recursively extracts outline bookmarks from a PDF.js Document object.
 */
export async function extractPdfBookmarks(
  pdfDoc: PdfJsDocument | null | undefined,
): Promise<PdfOutlineItem[]> {
  if (!pdfDoc || typeof pdfDoc.getOutline !== 'function') {
    return [];
  }
  const doc = pdfDoc;

  try {
    const rawOutline = await doc.getOutline();
    if (!rawOutline || !Array.isArray(rawOutline) || rawOutline.length === 0) {
      return [];
    }

    const destCache = new Map<string, unknown[] | null>();
    const pageIndexCache = new Map<unknown, number>();

    async function resolvePageNumber(item: PdfJsOutlineItem): Promise<number> {
      try {
        let dest: string | unknown[] | null | undefined = item.dest;
        if (typeof dest === 'string') {
          if (destCache.has(dest)) {
            dest = destCache.get(dest);
          } else {
            const resolved = await doc.getDestination(dest);
            destCache.set(dest, resolved);
            dest = resolved;
          }
        }

        if (Array.isArray(dest) && dest.length > 0) {
          const ref = dest[0];
          if (pageIndexCache.has(ref)) {
            return pageIndexCache.get(ref)! + 1;
          }
          const pageIndex = await doc.getPageIndex(ref);
          if (typeof pageIndex === 'number') {
            pageIndexCache.set(ref, pageIndex);
            return pageIndex + 1;
          }
        }
      } catch {
        // fallback to page 1
      }
      return 1;
    }

    async function traverse(
      items: PdfJsOutlineItem[],
      level = 0,
    ): Promise<Array<Omit<PdfOutlineItem, 'id'>>> {
      const resolvedList = await Promise.all(
        items.map(async (item) => {
          if (!item || !item.title) return null;
          const pageNumber = Math.max(1, await resolvePageNumber(item));
          const current: Omit<PdfOutlineItem, 'id'> = {
            title: item.title.trim(),
            pageNumber,
            level,
          };
          const children =
            Array.isArray(item.items) && item.items.length > 0
              ? await traverse(item.items, level + 1)
              : [];
          return { current, children };
        }),
      );

      const flat: Array<Omit<PdfOutlineItem, 'id'>> = [];
      for (const res of resolvedList) {
        if (!res) continue;
        flat.push(res.current);
        if (res.children.length > 0) {
          flat.push(...res.children);
        }
      }
      return flat;
    }

    const flatItems = await traverse(rawOutline, 0);
    return flatItems.map((item, idx) => ({
      id: `bm_${idx}_${item.level}_${item.pageNumber}`,
      ...item,
    }));
  } catch (err) {
    logger.warn('[pdf-outline] Failed to extract PDF bookmarks', { error: err });
    return [];
  }
}

export interface OutlineEntry {
  level: number;
  levelName: string;
  title: string;
  line: number;
  type?:
    | 'book'
    | 'part'
    | 'chapter'
    | 'section'
    | 'subsection'
    | 'subsubsection'
    | 'paragraph'
    | 'subparagraph'
    | 'figure'
    | 'table'
    | 'slide'
    | 'appendix'
    | 'abstract';
  sourceFile?: string;
}

export const OUTLINE_INDENT = [0, 8, 18, 28, 38, 48, 58];

/**
 * Returns true if the character at `index` is preceded by an odd number of backslashes.
 * Properly distinguishes `\%` (escaped) from `\\%` (line break + comment).
 */
function isEscaped(str: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && str[i] === '\\'; i--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

function stripLatexComment(rawLine: string): string {
  for (let c = 0; c < rawLine.length; c++) {
    if (rawLine[c] === '%' && !isEscaped(rawLine, c)) {
      return rawLine.slice(0, c);
    }
  }
  return rawLine;
}

/**
 * Strips LaTeX formatting commands, math delims, and labels from section titles.
 */
function cleanLatexTitle(raw: string): string {
  if (!raw) return 'Untitled';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\$([^$]+)\$/g, '$1');
  cleaned = cleaned.replace(
    /\\(?:cite[a-zA-Z]*|ref|eqref|pageref|autoref|cref|Cref|label|footnote)\*?\s*(?:\[[^\]]*\])?\s*\{[^{}]*\}/g,
    '',
  );
  for (let pass = 0; pass < 6; pass++) {
    const next = cleaned.replace(
      /\\(?:textbf|textit|emph|texttt|textsc|textrm|textsf|underline|mbox|hbox|textnormal|mathrm|mathbf|mathit|mathcal|text|texorpdfstring)\*?\s*\{([^{}]*)\}/g,
      '$1',
    );
    if (next === cleaned) break;
    cleaned = next;
  }
  cleaned = cleaned.replace(/\\([&%_#$])/g, '$1');
  cleaned = cleaned.replace(/\\([{}])/g, '$1');
  cleaned = cleaned.replace(/\\textbackslash\b\s*/g, '\\');
  cleaned = cleaned.replace(/\\[a-zA-Z@]+\*?\s*/g, '');
  cleaned = cleaned.replace(/[{}]/g, '');
  cleaned = cleaned.replace(/~/g, ' ');
  return cleaned.replace(/\s+/g, ' ').trim() || 'Untitled';
}

const OUTLINE_LEVEL_META: Record<string, { level: number; levelName: string; type: OutlineEntry['type'] }> = {
  part: { level: 0, levelName: 'Part', type: 'part' },
  chapter: { level: 1, levelName: 'Chapter', type: 'chapter' },
  section: { level: 2, levelName: 'Section', type: 'section' },
  subsection: { level: 3, levelName: 'Subsection', type: 'subsection' },
  subsubsection: { level: 4, levelName: 'Subsubsection', type: 'subsubsection' },
  paragraph: { level: 5, levelName: 'Paragraph', type: 'paragraph' },
  subparagraph: { level: 6, levelName: 'Subparagraph', type: 'subparagraph' },
  appendix: { level: 1, levelName: 'Appendix', type: 'appendix' },
  abstract: { level: 2, levelName: 'Abstract', type: 'abstract' },
  slide: { level: 3, levelName: 'Slide', type: 'slide' },
  figure: { level: 4, levelName: 'Figure', type: 'figure' },
  table: { level: 4, levelName: 'Table', type: 'table' },
};

/**
 * Maps backend `LatexOutlineEntryDto[]` to `OutlineEntry[]`.
 */
export function dtoToOutlineEntries(entries: LatexOutlineEntryDto[] | null | undefined): OutlineEntry[] {
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map((e: any) => {
    const rawLevel = e.level;
    const meta = typeof rawLevel === 'string' && OUTLINE_LEVEL_META[rawLevel]
      ? OUTLINE_LEVEL_META[rawLevel]
      : { level: typeof rawLevel === 'number' ? rawLevel : 1, levelName: e.levelName || 'Section', type: (e.type || 'section') as OutlineEntry['type'] };

    return {
      level: meta.level,
      levelName: e.levelName || meta.levelName,
      title: e.title,
      line: e.line,
      type: (e.type || meta.type) as OutlineEntry['type'],
      sourceFile: e.file || e.sourceFile,
    };
  });
}

let cachedOutlineEntries: OutlineEntry[] = [];

export function cacheBackendOutline(entries: LatexOutlineEntryDto[] | OutlineEntry[]): void {
  cachedOutlineEntries = dtoToOutlineEntries(entries as any);
}

export function clearOutlineMemoCache(): void {
  cachedOutlineEntries = [];
}

function extractDocumentContentString(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!content || typeof content !== 'object') return '';
  const rec = content as {
    source?: unknown;
    content?: unknown;
    text?: unknown;
    lines?: unknown;
  };
  if (typeof rec.source === 'string') return rec.source;
  if (typeof rec.content === 'string') return rec.content;
  if (typeof rec.text === 'string') return rec.text;
  if (Array.isArray(rec.lines)) {
    return rec.lines.filter((l): l is string => typeof l === 'string').join('\n');
  }
  return '';
}

const MAX_MULTILINE_SCAN_LINES = 12;

function extractMultiLineBalancedBraces(
  lines: string[],
  startLineIdx: number,
  openBraceIndex: number,
): { content: string; endLineIdx: number; endIndex: number } | null {
  const firstClean = stripLatexComment(lines[startLineIdx] ?? '');
  if (firstClean[openBraceIndex] !== '{') return null;

  let depth = 1;
  let buf = '';
  const maxLine = Math.min(lines.length - 1, startLineIdx + MAX_MULTILINE_SCAN_LINES);

  for (let lineIdx = startLineIdx; lineIdx <= maxLine; lineIdx++) {
    const cleanLine =
      lineIdx === startLineIdx ? firstClean : stripLatexComment(lines[lineIdx] ?? '');
    const startCol = lineIdx === startLineIdx ? openBraceIndex + 1 : 0;
    if (lineIdx > startLineIdx) {
      buf += ' ';
    }

    for (let col = startCol; col < cleanLine.length; col++) {
      const ch = cleanLine[col];
      if (ch === '{' && !isEscaped(cleanLine, col)) {
        depth++;
        buf += ch;
      } else if (ch === '}' && !isEscaped(cleanLine, col)) {
        depth--;
        if (depth === 0) {
          return { content: buf, endLineIdx: lineIdx, endIndex: col + 1 };
        }
        buf += ch;
      } else {
        buf += ch;
      }
    }
  }
  return null;
}

function parseLatexHeadings(
  content: unknown,
  sourceFile?: string,
  backendEntries?: LatexOutlineEntryDto[],
): OutlineEntry[] {
  if (backendEntries) {
    const mapped = dtoToOutlineEntries(backendEntries);
    cachedOutlineEntries = mapped;
    return mapped;
  }

  if (content === null) {
    return [];
  }

  if (content === undefined) {
    return cachedOutlineEntries;
  }

  const text = extractDocumentContentString(content);
  if (!text.trim()) {
    return [];
  }

  const entries: OutlineEntry[] = [];
  const lines = text.split('\n');
  let inCommentEnv = false;
  let inVerbatimEnv = false;
  let currentFrameEntry: OutlineEntry | null = null;

  const sectionRegex =
    /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\s*\{/g;
  const frameStartRegex =
    /\\begin\{frame\}(?:\s*<[^>]*>)?(?:\s*\[[^\]]*\])?(?:\s*\{)?/;
  const frameTitleRegex = /\\frametitle(?:\s*<[^>]*>)?(?:\s*\[[^\]]*\])?\s*\{/;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const lineNum = i + 1;
    const nonComment = stripLatexComment(rawLine);
    const trimmed = nonComment.trim();
    if (!trimmed) {
      continue;
    }

    if (/\\begin\{comment\}/.test(trimmed)) {
      inCommentEnv = true;
      continue;
    }
    if (/\\end\{comment\}/.test(trimmed)) {
      inCommentEnv = false;
      continue;
    }
    if (inCommentEnv) continue;

    if (/\\begin\{(?:verbatim|lstlisting|minted)\*?\}/.test(trimmed)) {
      inVerbatimEnv = true;
      continue;
    }
    if (/\\end\{(?:verbatim|lstlisting|minted)\*?\}/.test(trimmed)) {
      inVerbatimEnv = false;
      continue;
    }
    if (inVerbatimEnv) continue;

    // \appendix or \begin{appendices}
    if (/\\appendix\b|\\begin\{appendices\}/.test(trimmed)) {
      entries.push({
        level: OUTLINE_LEVEL_META.appendix.level,
        levelName: OUTLINE_LEVEL_META.appendix.levelName,
        title: 'Appendix',
        line: lineNum,
        type: 'appendix',
        sourceFile,
      });
    }

    // \begin{abstract}
    if (/\\begin\{abstract\}/.test(trimmed)) {
      entries.push({
        level: OUTLINE_LEVEL_META.abstract.level,
        levelName: OUTLINE_LEVEL_META.abstract.levelName,
        title: 'Abstract',
        line: lineNum,
        type: 'abstract',
        sourceFile,
      });
    }

    // Beamer \begin{frame}[opts]{Title}
    const frameMatch = frameStartRegex.exec(nonComment);
    if (frameMatch) {
      let frameTitle = 'Slide';
      let endLineIdx = i;
      if (frameMatch[0].endsWith('{')) {
        const openBraceIdx = frameMatch.index + frameMatch[0].lastIndexOf('{');
        const extracted = extractMultiLineBalancedBraces(lines, i, openBraceIdx);
        const rawTitle = extracted
          ? extracted.content
          : nonComment.slice(openBraceIdx + 1).replace(/\}.*$/, '');
        frameTitle = cleanLatexTitle(rawTitle);
        if (extracted) endLineIdx = extracted.endLineIdx;
      }
      currentFrameEntry = {
        level: OUTLINE_LEVEL_META.slide.level,
        levelName: OUTLINE_LEVEL_META.slide.levelName,
        title: frameTitle,
        line: lineNum,
        type: 'slide',
        sourceFile,
      };
      entries.push(currentFrameEntry);
      if (endLineIdx > i) i = endLineIdx;
      continue;
    }

    if (/\\end\{frame\}/.test(nonComment)) {
      currentFrameEntry = null;
      continue;
    }

    // Beamer \frametitle{...}
    const frameTitleMatch = frameTitleRegex.exec(nonComment);
    if (frameTitleMatch) {
      const openBraceIdx = frameTitleMatch.index + frameTitleMatch[0].lastIndexOf('{');
      const extracted = extractMultiLineBalancedBraces(lines, i, openBraceIdx);
      const rawTitle = extracted
        ? extracted.content
        : nonComment.slice(openBraceIdx + 1).replace(/\}.*$/, '');
      const newTitle = cleanLatexTitle(rawTitle);
      if (currentFrameEntry && currentFrameEntry.title === 'Slide') {
        currentFrameEntry.title = newTitle;
      } else {
        entries.push({
          level: OUTLINE_LEVEL_META.slide.level,
          levelName: OUTLINE_LEVEL_META.slide.levelName,
          title: newTitle,
          line: lineNum,
          type: 'slide',
          sourceFile,
        });
      }
      if (extracted && extracted.endLineIdx > i) i = extracted.endLineIdx;
      continue;
    }

    // LaTeX Headings (\part, \chapter, \section, ..., supports multiple per line & multi-line)
    sectionRegex.lastIndex = 0;
    let headingTypeMatch: RegExpExecArray | null;
    let maxEndLineIdx = i;
    while ((headingTypeMatch = sectionRegex.exec(nonComment)) !== null) {
      const cmd = headingTypeMatch[1];
      const openBraceIdx = headingTypeMatch.index + headingTypeMatch[0].lastIndexOf('{');
      const extracted = extractMultiLineBalancedBraces(lines, i, openBraceIdx);
      const rawTitle = extracted
        ? extracted.content
        : nonComment.slice(openBraceIdx + 1).replace(/\}.*$/, '');
      const meta = OUTLINE_LEVEL_META[cmd] || OUTLINE_LEVEL_META.section;
      entries.push({
        level: meta.level,
        levelName: meta.levelName,
        title: cleanLatexTitle(rawTitle),
        line: lineNum,
        type: meta.type,
        sourceFile,
      });

      if (extracted && extracted.endLineIdx > maxEndLineIdx) {
        maxEndLineIdx = extracted.endLineIdx;
      }
      if (extracted && extracted.endLineIdx === i) {
        sectionRegex.lastIndex = Math.max(sectionRegex.lastIndex, extracted.endIndex);
      } else if (extracted && extracted.endLineIdx > i) {
        break;
      }
    }
    if (maxEndLineIdx > i) {
      i = maxEndLineIdx;
    }
  }

  cachedOutlineEntries = entries;
  return entries;
}

export function parseDocumentOutline(
  _content: unknown,
  _sourceFile?: string,
  backendEntries?: LatexOutlineEntryDto[],
): OutlineEntry[] {
  return parseLatexHeadings(_content, _sourceFile, backendEntries);
}

/**
 * Maps outline entries to PDF pages using line-ratio or SyncTeX records.
 */
export function extractOutlineFromContent(
  latexContent: string,
  numPages = 1,
  synctexMap?: SyncTeXMap | Record<number, number> | null,
  backendEntries?: LatexOutlineEntryDto[],
): PdfOutlineItem[] {
  const rawEntries = parseLatexHeadings(latexContent, undefined, backendEntries);
  const totalLines = Math.max(1, (latexContent || '').split('\n').length);
  const totalPages = Math.max(1, numPages);

  return rawEntries.map((entry, index) => {
    let page: number | null = null;
    if (synctexMap) {
      if ('lineToPage' in synctexMap) {
        page = resolveForward(entry.line, synctexMap, undefined, totalPages);
      } else if (entry.line in synctexMap) {
        page = (synctexMap as Record<number, number>)[entry.line] ?? null;
      }
    }

    if (page === null || page === undefined) {
      page = Math.min(totalPages, Math.max(1, Math.ceil((entry.line / totalLines) * totalPages)));
    }

    return {
      id: `sec_${index}_${entry.line}`,
      title: entry.title,
      pageNumber: page,
      level: entry.level,
    };
  });
}
