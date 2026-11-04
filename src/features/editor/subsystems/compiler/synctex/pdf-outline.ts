/**
 * pdf-outline.ts
 *
 * Utilities for extracting and resolving document outlines/bookmarks from PDF.js instances
 * and mapping backend-extracted LaTeX outline DTOs.
 */

import type { LatexOutlineEntryDto } from '@/features/editor/sdk/manuscript/types';
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
  return (raw || '')
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1')
    .replace(/\\([&%_#$])/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}

/**
 * Maps backend `LatexOutlineEntryDto[]` to `OutlineEntry[]`.
 */
export function dtoToOutlineEntries(entries: LatexOutlineEntryDto[] | null | undefined): OutlineEntry[] {
  if (!entries || !Array.isArray(entries)) return [];
  return entries.map((e) => ({
    level: e.level,
    levelName: e.levelName,
    title: e.title,
    line: e.line,
    type: e.type,
    sourceFile: e.sourceFile,
  }));
}

let cachedOutlineEntries: OutlineEntry[] = [];

export function cacheBackendOutline(entries: LatexOutlineEntryDto[] | OutlineEntry[]): void {
  cachedOutlineEntries = entries.map((e) => ({
    level: e.level,
    levelName: e.levelName,
    title: e.title,
    line: e.line,
    type: e.type,
    sourceFile: e.sourceFile,
  }));
}

export function clearOutlineMemoCache(): void {
  cachedOutlineEntries = [];
}

export function parseLatexHeadings(
  _content: unknown,
  _sourceFile?: string,
  backendEntries?: LatexOutlineEntryDto[],
): OutlineEntry[] {
  if (backendEntries) {
    const mapped = dtoToOutlineEntries(backendEntries);
    cachedOutlineEntries = mapped;
    return mapped;
  }
  return cachedOutlineEntries;
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
