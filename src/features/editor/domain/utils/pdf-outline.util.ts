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

    const results: PdfOutlineItem[] = [];

    async function traverse(items: PdfJsOutlineItem[], level = 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || !item.title) continue;

        let pageNumber = 1;
        try {
          let dest: any = item.dest;
          if (typeof dest === 'string') {
            dest = await doc.getDestination(dest);
          }

          if (Array.isArray(dest) && dest.length > 0) {
            const pageIndex = await doc.getPageIndex(dest[0]);
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

export interface OutlineEntry {
  level: number;
  levelName: string;
  title: string;
  line: number;
}

export const OUTLINE_INDENT = [0, 8, 18, 28, 38, 48, 58];

const SECTION_COMMANDS = [
  { cmd: 'part', level: 0, levelName: 'Part' },
  { cmd: 'chapter', level: 0, levelName: 'Chapter' },
  { cmd: 'section', level: 1, levelName: 'Section' },
  { cmd: 'subsection', level: 2, levelName: 'Subsection' },
  { cmd: 'subsubsection', level: 3, levelName: 'Subsubsection' },
  { cmd: 'paragraph', level: 4, levelName: 'Paragraph' },
  { cmd: 'subparagraph', level: 5, levelName: 'Subparagraph' },
];

/**
 * Strips LaTeX formatting commands, math delims, and labels from section titles.
 */
export function cleanLatexTitle(raw: string): string {
  let s = (raw || '').trim();
  // Remove \label{...} and \index{...}
  s = s.replace(/\\label\{[^{}]*\}/g, '');
  s = s.replace(/\\index\{[^{}]*\}/g, '');
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
export function parseLatexHeadings(content: unknown): OutlineEntry[] {
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

  for (let idx = 0; idx < lines.length; idx++) {
    const fullLine = lines[idx];
    const lineNum = idx + 1;

    // Strip comments: ignore anything after an unescaped %
    let commentIdx = -1;
    for (let c = 0; c < fullLine.length; c++) {
      if (fullLine[c] === '%' && (c === 0 || fullLine[c - 1] !== '\\')) {
        commentIdx = c;
        break;
      }
    }
    const cleanLine = commentIdx >= 0 ? fullLine.slice(0, commentIdx) : fullLine;
    const trimmed = cleanLine.trim();
    if (!trimmed.includes('\\')) continue;

    // 1. Beamer frame begin: \begin{frame}...
    const frameMatch = trimmed.match(/\\begin\s*\{\s*frame\s*\}(.*)/);
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
      };
      entries.push(entry);
      currentFrameEntry = entry;
      continue;
    }

    // 2. Beamer frametitle: \frametitle{Title}
    const frametitleMatch = trimmed.match(/\\frametitle\s*(?:\[[^\]]*\])?(.*)/);
    if (frametitleMatch) {
      let accumulated = frametitleMatch[1];
      let offset = 0;
      while (!extractBracedArgument(accumulated) && (idx + offset + 1) < lines.length && offset < 5) {
        offset++;
        accumulated += ' ' + lines[idx + offset].trim();
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

    // 4. Standard LaTeX sectioning commands
    let matchedCommand = false;
    for (const { cmd, level, levelName } of SECTION_COMMANDS) {
      const regex = new RegExp(`\\\\${cmd}\\*?\\s*(?:\\[[^\\]]*\\])?(.*)`);
      const match = trimmed.match(regex);
      if (match) {
        let accumulated = match[1];
        let offset = 0;
        while (!extractBracedArgument(accumulated) && (idx + offset + 1) < lines.length && offset < 5) {
          offset++;
          accumulated += ' ' + lines[idx + offset].trim();
        }
        const arg = extractBracedArgument(accumulated);
        if (arg) {
          entries.push({
            level,
            levelName,
            title: cleanLatexTitle(arg.value),
            line: lineNum,
          });
          matchedCommand = true;
          break;
        }
      }
    }
    if (matchedCommand) continue;

    // 5. Appendix
    if (trimmed.match(/\\appendix\b/)) {
      entries.push({
        level: 1,
        levelName: 'Appendix',
        title: 'Appendix',
        line: lineNum,
      });
      continue;
    }

    // 6. Abstract environment
    if (trimmed.match(/\\begin\s*\{\s*abstract\s*\}/)) {
      entries.push({
        level: 1,
        levelName: 'Abstract',
        title: 'Abstract',
        line: lineNum,
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
  synctexMap?: Record<number, number> | null,
): PdfOutlineItem[] {
  if (!latexContent || typeof latexContent !== 'string') return [];

  const rawEntries = parseLatexHeadings(latexContent);
  const totalLines = Math.max(1, latexContent.split('\n').length);
  const totalPages = Math.max(1, numPages);

  return rawEntries.map((entry, index) => {
    let page = 1;
    if (synctexMap && synctexMap[entry.line]) {
      page = synctexMap[entry.line];
    } else {
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
 */
export function parseDocumentOutline(content: unknown): OutlineEntry[] {
  return parseLatexHeadings(content);
}

