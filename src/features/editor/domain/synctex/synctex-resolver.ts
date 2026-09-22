/**
 * synctex-resolver.ts
 *
 * Pure domain logic: Parses SyncTeX decompressed data and resolves coordinate mappings
 * between LaTeX source lines and PDF pages/bounding boxes.
 * Dependency Rule: ZERO framework dependencies, ZERO DOM/React imports.
 */

export interface SyncTeXNode {
  line: number;
  tag: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface SyncTeXMap {
  lineToPage: Map<number, number>;
  tagLineToPage: Map<string, number>;
  pageToLines: Map<number, number[]>;
  sortedLines: number[];
  pageToNodes: Map<number, SyncTeXNode[]>;
  tagLineToNode: Map<string, SyncTeXNode & { page: number }>;
  tagToPath: Map<number, string>;
  pathToTag: Map<string, number>;
}

/**
 * Parses raw decompressed SyncTeX text into a coordinate-aware map.
 */
export function parseSyncTeX(text: string): SyncTeXMap {
  const lineToPage = new Map<number, number>();
  const tagLineToPage = new Map<string, number>();
  const pageToLines = new Map<number, number[]>();
  const pageToNodes = new Map<number, SyncTeXNode[]>();
  const tagLineToNode = new Map<string, SyncTeXNode & { page: number }>();
  const tagToPath = new Map<number, string>();
  const pathToTag = new Map<string, number>();
  let currentPage = 0;

  for (const raw of text.split('\n')) {
    const s = raw.trimEnd();
    if (!s) continue;

    if (s.startsWith('Input:')) {
      const parts = s.split(':');
      if (parts.length >= 3) {
        const tag = parseInt(parts[1], 10);
        const filepath = parts.slice(2).join(':').trim();
        tagToPath.set(tag, filepath);

        const normalized = filepath.replace(/\\/g, '/').toLowerCase();
        const basename = normalized.split('/').pop() || normalized;
        pathToTag.set(basename, tag);
        pathToTag.set(normalized, tag);
        pathToTag.set(normalized.replace(/^\.\//, ''), tag);
      }
      continue;
    }

    const first = s.charCodeAt(0);

    if (first === 123 /* { */) {
      const m = s.match(/^\{(\d+)/);
      if (m) {
        currentPage = parseInt(m[1], 10);
        if (!pageToLines.has(currentPage)) pageToLines.set(currentPage, []);
        if (!pageToNodes.has(currentPage)) pageToNodes.set(currentPage, []);
      }
      continue;
    }

    if (first === 125 /* } */ || currentPage === 0) continue;

    const m = s.match(
      /^([\[\(\)hvgxk$])(\d+)[:,\.](\d+)(?:[:,\.](\d+))?:(-?\d+),(-?\d+)(?::(-?\d+),(-?\d+))?/,
    );
    if (m) {
      const tag = parseInt(m[2], 10);
      const line = parseInt(m[3], 10);
      const x = parseInt(m[5], 10);
      const y = parseInt(m[6], 10);
      const w = m[7] !== undefined ? parseInt(m[7], 10) : undefined;
      const h = m[8] !== undefined ? parseInt(m[8], 10) : undefined;

      const node: SyncTeXNode & { page: number } = {
        line,
        tag,
        x,
        y,
        ...(w !== undefined ? { w } : {}),
        ...(h !== undefined ? { h } : {}),
        page: currentPage,
      };

      if (tag === 1 && !lineToPage.has(line)) {
        lineToPage.set(line, currentPage);
      }

      const tagKey = `${tag}:${line}`;
      if (!tagLineToPage.has(tagKey)) {
        tagLineToPage.set(tagKey, currentPage);
      }

      pageToLines.get(currentPage)!.push(line);
      pageToNodes.get(currentPage)!.push(node);

      if (!tagLineToNode.has(tagKey)) {
        tagLineToNode.set(tagKey, node);
      }
    }
  }

  for (const [page, lines] of pageToLines.entries()) {
    pageToLines.set(page, Array.from(new Set(lines)).sort((a, b) => a - b));
  }

  const sortedLines = Array.from(lineToPage.keys()).sort((a, b) => a - b);

  return {
    lineToPage,
    tagLineToPage,
    pageToLines,
    sortedLines,
    pageToNodes,
    tagLineToNode,
    tagToPath,
    pathToTag,
  };
}

/**
 * Resolves the corresponding PDF page number for a given line and file tag.
 */
export function resolvePageForLine(
  map: SyncTeXMap,
  line: number,
  fileTag?: number,
): number | null {
  if (fileTag !== undefined) {
    const directTagPage = map.tagLineToPage.get(`${fileTag}:${line}`);
    if (directTagPage !== undefined) return directTagPage;
  }

  const directPage = map.lineToPage.get(line);
  if (directPage !== undefined) return directPage;

  // Binary search for nearest preceding line
  const lines = map.sortedLines;
  if (lines.length === 0) return null;

  let low = 0;
  let high = lines.length - 1;
  let bestLine = lines[0];

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lines[mid] === line) {
      return map.lineToPage.get(lines[mid]) ?? null;
    }
    if (lines[mid] < line) {
      bestLine = lines[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return map.lineToPage.get(bestLine) ?? null;
}
