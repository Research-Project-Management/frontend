/**
 * pdf-outline.ts
 *
 * Utilities for extracting and resolving document outlines/bookmarks from PDF.js instances
 * and mapping backend-extracted LaTeX outline DTOs.
 */

import type { LatexOutlineEntryDto } from '@/features/editor/sdk/pages/types';
import { resolvePageForLine, type SyncTeXMap } from './synctex-index';

export interface PdfOutlineItem {
  id: string;
  title: string;
  pageNumber: number;
  level: number;
}

export interface PdfJsOutlineItem {
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
    console.warn('[pdf-outline] Failed to extract PDF bookmarks:', err);
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
 * Strips LaTeX formatting commands, math delims, and labels from section titles.
 */
export function cleanLatexTitle(raw: string): string {
  let cleaned = raw || '';
  for (let i = 0; i < 4; i++) {
    cleaned = cleaned.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1');
  }
  return cleaned
    .replace(/\\([&%_#$])/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}

const OUTLINE_LEVEL_META: Record<string, { level: number; levelName: string; type: OutlineEntry['type'] }> = {
  part: { level: 0, levelName: 'Part', type: 'part' },
  chapter: { level: 0, levelName: 'Chapter', type: 'chapter' },
  section: { level: 1, levelName: 'Section', type: 'section' },
  subsection: { level: 2, levelName: 'Subsection', type: 'subsection' },
  subsubsection: { level: 3, levelName: 'Subsubsection', type: 'subsubsection' },
  paragraph: { level: 4, levelName: 'Paragraph', type: 'paragraph' },
  subparagraph: { level: 5, levelName: 'Subparagraph', type: 'subparagraph' },
  slide: { level: 2, levelName: 'Slide', type: 'slide' },
  figure: { level: 3, levelName: 'Figure', type: 'figure' },
  table: { level: 3, levelName: 'Table', type: 'table' },
  appendix: { level: 1, levelName: 'Appendix', type: 'appendix' },
  abstract: { level: 1, levelName: 'Abstract', type: 'abstract' },
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

export function parseLatexHeadings(
  content: unknown,
  sourceFile?: string,
  backendEntries?: LatexOutlineEntryDto[],
): OutlineEntry[] {
  if (backendEntries) {
    const mapped = dtoToOutlineEntries(backendEntries);
    cachedOutlineEntries = mapped;
    return mapped;
  }

  if (content === undefined || content === null) {
    return cachedOutlineEntries;
  }

  if (typeof content !== 'string' || !content.trim()) {
    return [];
  }

  const entries: OutlineEntry[] = [];
  const lines = content.split('\n');
  let currentFrameEntry: OutlineEntry | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const trimmed = rawLine.trim();
    if (trimmed.startsWith('%')) {
      continue;
    }

    let nonComment = '';
    for (let c = 0; c < rawLine.length; c++) {
      if (rawLine[c] === '%' && (c === 0 || rawLine[c - 1] !== '\\')) {
        break;
      }
      nonComment += rawLine[c];
    }

    // Beamer \begin{frame}
    const frameMatch = /\\begin\{frame\}(?:\[[^\]]*\])?(?:\s*\{([^}]*)\})?/.exec(nonComment);
    if (frameMatch) {
      const frameTitle = frameMatch[1] ? cleanLatexTitle(frameMatch[1]) : 'Slide';
      currentFrameEntry = {
        level: 2,
        levelName: 'Slide',
        title: frameTitle,
        line: lineNum,
        type: 'slide',
        sourceFile,
      };
      entries.push(currentFrameEntry);
      continue;
    }

    if (/\\end\{frame\}/.test(nonComment)) {
      currentFrameEntry = null;
      continue;
    }

    // Beamer \frametitle{...}
    const frameTitleMatch = /\\frametitle\{([^}]*)\}/.exec(nonComment);
    if (frameTitleMatch) {
      const newTitle = cleanLatexTitle(frameTitleMatch[1]);
      if (currentFrameEntry && currentFrameEntry.title === 'Slide') {
        currentFrameEntry.title = newTitle;
      } else {
        entries.push({
          level: 2,
          levelName: 'Slide',
          title: newTitle,
          line: lineNum,
          type: 'slide',
          sourceFile,
        });
      }
      continue;
    }

    // LaTeX Headings (\section, \subsection, etc.)
    const headingTypeMatch = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\s*\{/.exec(nonComment);
    if (headingTypeMatch) {
      const cmd = headingTypeMatch[1];
      const startLine = lineNum;
      const startIndex = headingTypeMatch.index + headingTypeMatch[0].length;
      let titleAccumulator = nonComment.slice(startIndex);
      let braceDepth = 1;
      let titleFound = false;
      let j = i;

      while (j < lines.length) {
        const textToScan = j === i ? titleAccumulator : lines[j];
        for (let k = 0; k < textToScan.length; k++) {
          const char = textToScan[k];
          if (char === '%' && (k === 0 || textToScan[k - 1] !== '\\')) {
            break;
          }
          if (char === '{' && (k === 0 || textToScan[k - 1] !== '\\')) {
            braceDepth++;
          } else if (char === '}' && (k === 0 || textToScan[k - 1] !== '\\')) {
            braceDepth--;
            if (braceDepth === 0) {
              titleAccumulator = (j === i ? titleAccumulator.slice(0, k) : titleAccumulator + '\n' + textToScan.slice(0, k));
              titleFound = true;
              break;
            }
          }
        }
        if (titleFound) {
          i = j;
          break;
        }
        if (j > i) {
          titleAccumulator += '\n' + lines[j];
        }
        j++;
      }

      const levelMap: Record<string, { level: number; levelName: string; type: OutlineEntry['type'] }> = {
        part: { level: 0, levelName: 'Part', type: 'part' },
        chapter: { level: 0, levelName: 'Chapter', type: 'chapter' },
        section: { level: 1, levelName: 'Section', type: 'section' },
        subsection: { level: 2, levelName: 'Subsection', type: 'subsection' },
        subsubsection: { level: 3, levelName: 'Subsubsection', type: 'subsubsection' },
        paragraph: { level: 4, levelName: 'Paragraph', type: 'paragraph' },
        subparagraph: { level: 5, levelName: 'Subparagraph', type: 'subparagraph' },
      };

      const meta = levelMap[cmd] || { level: 1, levelName: 'Section', type: 'section' };
      entries.push({
        level: meta.level,
        levelName: meta.levelName,
        title: cleanLatexTitle(titleAccumulator),
        line: startLine,
        type: meta.type,
        sourceFile,
      });
    }
  }

  if (entries.length > 0) {
    cachedOutlineEntries = entries;
  }
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
        page = resolvePageForLine(synctexMap, entry.line);
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
