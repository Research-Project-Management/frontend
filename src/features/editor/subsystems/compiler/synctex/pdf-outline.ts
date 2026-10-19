/**
 * pdf-outline.util.ts
 *
 * Utilities for extracting and resolving document outlines/bookmarks from PDF.js instances
 */

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
  pdfDoc: PdfJsDocument | null | undefined
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

    // Traverse outline tree concurrently at each level while maintaining stable document order
    async function traverse(items: PdfJsOutlineItem[], level = 0): Promise<Array<Omit<PdfOutlineItem, 'id'>>> {
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
        })
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

const SECTION_REGEX = /\\(book|part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\s*(?:\[[^\]]*\])?(.*)/;

const SECTION_META: Record<string, { level: number; levelName: string; type: OutlineEntry['type'] }> = {
  book: { level: 0, levelName: 'Book', type: 'book' },
  part: { level: 0, levelName: 'Part', type: 'part' },
  chapter: { level: 0, levelName: 'Chapter', type: 'chapter' },
  section: { level: 1, levelName: 'Section', type: 'section' },
  subsection: { level: 2, levelName: 'Subsection', type: 'subsection' },
  subsubsection: { level: 3, levelName: 'Subsubsection', type: 'subsubsection' },
  paragraph: { level: 4, levelName: 'Paragraph', type: 'paragraph' },
  subparagraph: { level: 5, levelName: 'Subparagraph', type: 'subparagraph' },
};

const RE_IFFALSE = /\\iffalse\b/;
const RE_FI = /\\fi\b/;
const RE_BEGIN_FIGURE = /\\begin\s*\{\s*figure\*?\s*\}/;
const RE_END_FIGURE = /\\end\s*\{\s*figure\*?\s*\}/;
const RE_BEGIN_TABLE = /\\begin\s*\{\s*table\*?\s*\}/;
const RE_END_TABLE = /\\end\s*\{\s*table\*?\s*\}/;
const RE_CAPTION = /\\caption\s*(?:\[[^\]]*\])?(.*)/;
const RE_BEGIN_FRAME = /\\begin\s*\{\s*frame\s*\}(.*)/;
const RE_FRAMETITLE = /\\frametitle\s*(?:\[[^\]]*\])?(.*)/;
const RE_APPENDIX = /\\appendix\b/;
const RE_BEGIN_ABSTRACT = /\\begin\s*\{\s*abstract\s*\}/;

/**
 * Strips LaTeX formatting commands, math delims, and labels from section titles.
 */
export function cleanLatexTitle(raw: string): string {
  let s = (raw || '').trim();
  // Remove \label{...}, \index{...}, \cite{...}, and footnotes
  s = s.replace(/\\label\{[^{}]*\}/g, '');
  s = s.replace(/\\index\{[^{}]*\}/g, '');
  s = s.replace(/\\(?:cite[a-zA-Z]*|citep|citet|newcite|shortcite)(?:\[[^\]]*\])*\{[^{}]*\}/g, '');
  s = s.replace(/\\(?:footnote|thanks)\{[^{}]*\}/g, '');
  // Unescape escaped LaTeX special chars (\&, \%, \_, \#, \$)
  s = s.replace(/\\([&%_#$])/g, '$1');
  // Unnest formatting commands like \textbf{...}, \textit{...}, \emph{...}
  let prev = '';
  do {
    prev = s;
    s = s.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g, '$1');
  } while (s !== prev);
  // Remove math mode delimiters but keep math symbols readable
  s = s.replace(/\$([^$]+)\$/g, '$1');
  // Strip standalone LaTeX command backslashes (e.g. \LaTeX -> LaTeX)
  s = s.replace(/\\[a-zA-Z]+/g, ' ');
  // Replace line breaks and non-breaking spaces
  s = s.replace(/\\\\/g, ' ');
  s = s.replace(/~/g, ' ');
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s || 'Untitled';
}

function stripUnescapedComment(line: string): string {
  for (let c = 0; c < line.length; c++) {
    if (line[c] === '%') {
      let backslashes = 0;
      for (let j = c - 1; j >= 0 && line[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 0) return line.slice(0, c);
    }
  }
  return line;
}

/**
 * Extracts the contents of the first balanced curly-braced group starting at or after startPos.
 */
export function extractBracedArgument(
  str: string,
  startPos = 0,
): { value: string; endIndex: number } | null {
  const openIdx = str.indexOf('{', startPos);
  if (openIdx === -1) return null;
  let depth = 0;
  let inEscape = false;
  for (let i = openIdx; i < str.length; i++) {
    const ch = str[i];
    if (inEscape) {
      inEscape = false;
      continue;
    }
    if (ch === '\\') {
      inEscape = true;
      continue;
    }
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return {
          value: str.slice(openIdx + 1, i),
          endIndex: i,
        };
      }
    }
  }
  return null;
}

/**
 * Core scanner for LaTeX documents. Parses headings, Beamer slides, appendices, and abstracts.
 */
export function parseLatexHeadings(content: unknown, sourceFile?: string): OutlineEntry[] {
  let str = '';
  if (typeof content === 'string') {
    str = content;
  } else if (content && typeof content === 'object') {
    const obj = content as Record<string, unknown>;
    str = String(obj.source || obj.text || obj.content || '');
  }

  if (!str.trim()) return [];

  const entries: OutlineEntry[] = [];
  const lines = str.split('\n');
  let currentFrameEntry: OutlineEntry | null = null;
  let inFigure = false;
  let inTable = false;
  let iffalseDepth = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const fullLine = lines[idx];
    const lineNum = idx + 1;

    const cleanLine = stripUnescapedComment(fullLine);
    const trimmed = cleanLine.trim();
    if (!trimmed.includes('\\')) continue;

    if (RE_IFFALSE.test(trimmed)) {
      iffalseDepth++;
    }
    if (iffalseDepth > 0) {
      if (RE_FI.test(trimmed)) {
        iffalseDepth = Math.max(0, iffalseDepth - 1);
      }
      continue;
    }

    // Environment tracking for Figures & Tables (Overleaf Parity)
    if (RE_BEGIN_FIGURE.test(trimmed)) {
      inFigure = true;
      inTable = false;
    } else if (RE_END_FIGURE.test(trimmed)) {
      inFigure = false;
    } else if (RE_BEGIN_TABLE.test(trimmed)) {
      inTable = true;
      inFigure = false;
    } else if (RE_END_TABLE.test(trimmed)) {
      inTable = false;
    }

    // 0. Figure / Table Caption Extraction (Overleaf Parity)
    if (inFigure || inTable) {
      const captionMatch = trimmed.match(RE_CAPTION);
      if (captionMatch) {
        let accumulated = captionMatch[1];
        let offset = 0;
        while (!extractBracedArgument(accumulated) && (idx + offset + 1) < lines.length && offset < 15) {
          offset++;
          accumulated += ' ' + stripUnescapedComment(lines[idx + offset]).trim();
        }
        const arg = extractBracedArgument(accumulated);
        if (arg && arg.value.trim()) {
          const clean = cleanLatexTitle(arg.value);
          entries.push({
            level: 3,
            levelName: inFigure ? 'Figure' : 'Table',
            title: `${inFigure ? 'Fig: ' : 'Tab: '}${clean}`,
            line: lineNum,
            type: inFigure ? 'figure' : 'table',
            sourceFile,
          });
        }
        continue;
      }
    }

    // 1. Beamer frame begin: \begin{frame}...
    const frameMatch = trimmed.match(RE_BEGIN_FRAME);
    if (frameMatch) {
      const rest = frameMatch[1].trim();
      let slideTitle = 'Slide';
      let braceSearchFrom = 0;
      if (rest.startsWith('[')) {
        const closeBracket = rest.indexOf(']');
        if (closeBracket >= 0) {
          braceSearchFrom = closeBracket + 1;
        }
      }
      const titleArg = extractBracedArgument(rest, braceSearchFrom);
      if (titleArg && titleArg.value.trim()) {
        slideTitle = cleanLatexTitle(titleArg.value);
      }
      const entry: OutlineEntry = {
        level: 2,
        levelName: 'Slide',
        title: slideTitle,
        line: lineNum,
        type: 'slide',
        sourceFile,
      };
      entries.push(entry);
      currentFrameEntry = entry;
      continue;
    }

    // 2. Beamer frametitle: \frametitle{Title}
    const frametitleMatch = trimmed.match(RE_FRAMETITLE);
    if (frametitleMatch) {
      let accumulated = frametitleMatch[1];
      let offset = 0;
      while (!extractBracedArgument(accumulated) && (idx + offset + 1) < lines.length && offset < 15) {
        offset++;
        accumulated += ' ' + stripUnescapedComment(lines[idx + offset]).trim();
      }
      const arg = extractBracedArgument(accumulated);
      if (arg && arg.value.trim()) {
        const title = cleanLatexTitle(arg.value);
        if (currentFrameEntry && currentFrameEntry.title === 'Slide') {
          currentFrameEntry.title = title;
        } else {
          const entry: OutlineEntry = {
            level: 2,
            levelName: 'Slide',
            title,
            line: lineNum,
            type: 'slide',
            sourceFile,
          };
          entries.push(entry);
          currentFrameEntry = entry;
        }
      }
      continue;
    }

    // 3. Beamer frame end
    if (trimmed.includes('\\end{frame}')) {
      currentFrameEntry = null;
    }

    // 4. Standard LaTeX sectioning commands (O(1) precompiled match, zero inner loop allocation)
    const secMatch = trimmed.match(SECTION_REGEX);
    if (secMatch) {
      const cmd = secMatch[1];
      const meta = SECTION_META[cmd];
      if (meta) {
        let accumulated = secMatch[2];
        let offset = 0;
        while (!extractBracedArgument(accumulated) && (idx + offset + 1) < lines.length && offset < 15) {
          offset++;
          accumulated += ' ' + stripUnescapedComment(lines[idx + offset]).trim();
        }
        const arg = extractBracedArgument(accumulated);
        if (arg) {
          entries.push({
            level: meta.level,
            levelName: meta.levelName,
            title: cleanLatexTitle(arg.value),
            line: lineNum,
            type: meta.type,
            sourceFile,
          });
          continue;
        }
      }
    }

    // 5. Appendix
    if (RE_APPENDIX.test(trimmed)) {
      entries.push({
        level: 1,
        levelName: 'Appendix',
        title: 'Appendix',
        line: lineNum,
        type: 'appendix',
        sourceFile,
      });
      continue;
    }

    // 6. Abstract environment
    if (RE_BEGIN_ABSTRACT.test(trimmed)) {
      entries.push({
        level: 1,
        levelName: 'Abstract',
        title: 'Abstract',
        line: lineNum,
        type: 'abstract',
        sourceFile,
      });
      continue;
    }
  }

  return entries;
}

/**
 * Fallback parser that scans LaTeX source text for sections and maps them to PDF pages
 * using line-ratio or SyncTeX records.
 */
export function extractOutlineFromContent(
  latexContent: string,
  numPages = 1,
  synctexMap?: SyncTeXMap | Record<number, number> | null,
): PdfOutlineItem[] {
  if (!latexContent || typeof latexContent !== 'string') return [];

  const rawEntries = parseLatexHeadings(latexContent);
  const totalLines = Math.max(1, latexContent.split('\n').length);
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

/**
 * Parses LaTeX content into outline entries for the File Outline accordion.
 * Uses lightweight fingerprint memoization to avoid retaining large document strings in module memory.
 */
let lastContentFingerprint = '';
let lastSourceFile: string | undefined = undefined;
let lastOutlineResult: OutlineEntry[] = [];

function getContentFingerprint(content: unknown): string {
  if (typeof content === 'string') {
    const len = content.length;
    if (len === 0) return '0:empty';
    // Sample head, middle, tail and length (Flyweight fingerprint: 0 raw document bytes retained)
    const head = content.slice(0, 32);
    const mid = content.slice(Math.floor(len / 2), Math.floor(len / 2) + 32);
    const tail = content.slice(-32);
    return `${len}:${head}:${mid}:${tail}`;
  }
  if (!content) return 'null';
  return typeof content;
}

export function clearOutlineMemoCache(): void {
  lastContentFingerprint = '';
  lastSourceFile = undefined;
  lastOutlineResult = [];
}

export function parseDocumentOutline(content: unknown, sourceFile?: string): OutlineEntry[] {
  const fingerprint = getContentFingerprint(content);
  if (fingerprint === lastContentFingerprint && sourceFile === lastSourceFile && lastContentFingerprint !== '') {
    return lastOutlineResult;
  }
  const result = parseLatexHeadings(content, sourceFile);
  lastContentFingerprint = fingerprint;
  lastSourceFile = sourceFile;
  lastOutlineResult = result;
  return result;
}

