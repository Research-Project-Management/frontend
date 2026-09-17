/**
 * pdf-outline.util.ts
 *
 * Utilities for extracting and resolving document outlines/bookmarks from PDF.js instances
 * with fallback support for LaTeX section scanning and SyncTeX page resolution.
 */

export interface PdfOutlineItem {
  id: string;
  title: string;
  pageNumber: number;
  level: number;
}

/**
 * Recursively extracts outline bookmarks from a PDF.js Document object.
 */
export async function extractPdfBookmarks(pdfDoc: any): Promise<PdfOutlineItem[]> {
  if (!pdfDoc || typeof pdfDoc.getOutline !== 'function') {
    return [];
  }

  try {
    const rawOutline = await pdfDoc.getOutline();
    if (!rawOutline || !Array.isArray(rawOutline) || rawOutline.length === 0) {
      return [];
    }

    const results: PdfOutlineItem[] = [];

    async function traverse(items: any[], level = 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || !item.title) continue;

        let pageNumber = 1;
        try {
          let dest = item.dest;
          if (typeof dest === 'string') {
            dest = await pdfDoc.getDestination(dest);
          }

          if (Array.isArray(dest) && dest.length > 0) {
            const pageIndex = await pdfDoc.getPageIndex(dest[0]);
            pageNumber = typeof pageIndex === 'number' ? pageIndex + 1 : 1;
          }
        } catch {
          pageNumber = 1;
        }

        results.push({
          id: `bm_${results.length}_${level}_${pageNumber}`,
          title: item.title.trim(),
          pageNumber: Math.max(1, pageNumber),
          level,
        });

        if (Array.isArray(item.items) && item.items.length > 0) {
          await traverse(item.items, level + 1);
        }
      }
    }

    await traverse(rawOutline, 0);
    return results;
  } catch (err) {
    console.warn('[pdf-outline] Failed to extract PDF bookmarks:', err);
    return [];
  }
}

const SECTION_PATTERNS = [
  { regex: /^\\part\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 0 },
  { regex: /^\\chapter\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 0 },
  { regex: /^\\section\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 1 },
  { regex: /^\\subsection\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 2 },
  { regex: /^\\subsubsection\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 3 },
  { regex: /^\\paragraph\*?(?:\[[^\]]*\])?\{(.+?)\}/, level: 4 },
];

/**
 * Fallback parser that scans LaTeX source text for sections and maps them to PDF pages
 * using line-ratio or SyncTeX records.
 */
export function extractOutlineFromContent(
  latexContent: string,
  numPages = 1,
  synctexMap?: Record<number, number> | null,
): PdfOutlineItem[] {
  if (!latexContent || typeof latexContent !== 'string') return [];

  const lines = latexContent.split('\n');
  const totalLines = Math.max(1, lines.length);
  const totalPages = Math.max(1, numPages);
  const items: PdfOutlineItem[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx].trimStart();
    if (!rawLine.startsWith('\\')) continue;

    for (const { regex, level } of SECTION_PATTERNS) {
      const match = rawLine.match(regex);
      if (match) {
        const lineNum = idx + 1;
        let page = 1;

        if (synctexMap && synctexMap[lineNum]) {
          page = synctexMap[lineNum];
        } else {
          // Approximate page based on vertical line distribution
          page = Math.min(totalPages, Math.max(1, Math.ceil((lineNum / totalLines) * totalPages)));
        }

        items.push({
          id: `sec_${items.length}_${lineNum}`,
          title: match[1].trim(),
          pageNumber: page,
          level,
        });
        break;
      }
    }
  }

  return items;
}

export interface OutlineEntry {
  level: number;
  levelName: string;
  title: string;
  line: number;
}

export const OUTLINE_INDENT = [0, 8, 18, 28, 38];

const SECTION_LEVEL_NAMES: Record<number, string> = {
  0: 'Chapter',
  1: 'Section',
  2: 'Sub',
  3: 'Subsub',
  4: 'Para',
};

export function parseDocumentOutline(content: unknown): OutlineEntry[] {
  let str = '';
  if (typeof content === 'string') {
    str = content;
  } else if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    str = String(obj.source || obj.text || obj.content || '');
  }

  const entries: OutlineEntry[] = [];
  const lines = str.split('\n');

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trimStart();
    for (const { regex, level } of SECTION_PATTERNS) {
      const match = line.match(regex);
      if (match) {
        entries.push({
          level,
          levelName: SECTION_LEVEL_NAMES[level] || 'Section',
          title: match[1].trim(),
          line: idx + 1,
        });
        break;
      }
    }
  }

  return entries;
}
