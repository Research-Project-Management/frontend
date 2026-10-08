/**
 * synctex-index.ts
 *
 * SyncTeX Zero-Allocation Line Scanner & Bidirectional Coordinate Index (Domain Layer).
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
  tagToSortedLines: Map<number, number[]>;
}

/**
 * Memory-efficient zero-allocation line scanner for large text streams.
 */
export function forEachLine(text: string, callback: (line: string) => void): void {
  let start = 0;
  const len = text.length;
  while (start < len) {
    let end = text.indexOf('\n', start);
    if (end === -1) end = len;
    let lineEnd = end;
    if (lineEnd > start && text.charCodeAt(lineEnd - 1) === 13 /* \r */) {
      lineEnd--;
    }
    callback(text.substring(start, lineEnd));
    start = end + 1;
  }
}

/**
 * Resolves the page number for a given line, with tag matching and O(log M) binary search fallback.
 */
export function resolvePageForLine(
  synctexMap: SyncTeXMap | null | undefined,
  line: number,
  tag?: number,
  maxTolerance: number = 20,
): number | null {
  if (!synctexMap) return null;

  if (tag !== undefined) {
    const key = `${tag}:${line}`;
    if (synctexMap.tagLineToPage.has(key)) {
      return synctexMap.tagLineToPage.get(key)!;
    }

    const tagSorted = synctexMap.tagToSortedLines?.get(tag);
    if (tagSorted && tagSorted.length > 0) {
      let low = 0;
      let high = tagSorted.length - 1;
      let bestCandidate: number | null = null;

      while (low <= high) {
        const mid = (low + high) >> 1;
        if (tagSorted[mid] <= line) {
          bestCandidate = tagSorted[mid];
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (bestCandidate !== null && Math.abs(line - bestCandidate) <= maxTolerance) {
        return synctexMap.tagLineToPage.get(`${tag}:${bestCandidate}`) ?? null;
      }
    }
  }

  if (synctexMap.lineToPage.has(line)) {
    return synctexMap.lineToPage.get(line)!;
  }

  const sorted = synctexMap.sortedLines;
  if (!sorted || sorted.length === 0) return null;

  // Binary search for nearest preceding line (<= line)
  let low = 0;
  let high = sorted.length - 1;
  let bestCandidate: number | null = null;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] <= line) {
      bestCandidate = sorted[mid];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (bestCandidate !== null && Math.abs(line - bestCandidate) <= maxTolerance) {
    return synctexMap.lineToPage.get(bestCandidate) ?? null;
  }

  return null;
}

/**
 * Parse a decompressed SyncTeX text into a coordinate-aware map.
 */
export function parseSyncTeX(text: string): SyncTeXMap {
  const lineToPage = new Map<number, number>();
  const tagLineToPage = new Map<string, number>();
  const pageToLines = new Map<number, number[]>();
  const pageToNodes = new Map<number, SyncTeXNode[]>();
  const tagLineToNode = new Map<string, SyncTeXNode & { page: number }>();
  const tagToPath = new Map<number, string>();
  const pathToTag = new Map<string, number>();
  const tagToLinesMap = new Map<number, Set<number>>();
  let unit = 1;
  let scaleFactor = (unit / 65536) * 0.996264;
  let currentPage = 0;

  forEachLine(text, (raw) => {
    const s = raw.trimEnd();
    if (!s) return;

    if (s.startsWith("Unit:")) {
      const parsedUnit = parseFloat(s.substring(5).trim());
      if (!isNaN(parsedUnit) && parsedUnit > 0) {
        unit = parsedUnit;
        scaleFactor = (unit / 65536) * 0.996264;
      }
      return;
    }

    if (s.startsWith("Input:")) {
      const parts = s.split(":");
      if (parts.length >= 3) {
        const tag = parseInt(parts[1], 10);
        const filepath = parts.slice(2).join(":").trim();
        tagToPath.set(tag, filepath);

        const normalized = filepath.replace(/\\/g, '/').toLowerCase();
        const basename = normalized.split("/").pop() || normalized;
        pathToTag.set(basename, tag);
        pathToTag.set(normalized, tag);
        pathToTag.set(normalized.replace(/^\.\//, ''), tag);

        const cleanNorm = normalized.replace(/^\.\//, '');
        const segments = cleanNorm.split('/');
        for (let i = 0; i < segments.length; i++) {
          const subPath = segments.slice(i).join('/');
          if (subPath && !pathToTag.has(subPath)) {
            pathToTag.set(subPath, tag);
          }
        }
      }
      return;
    }

    const first = s.charCodeAt(0);

    if (first === 123 /* { */) {
      const m = s.match(/^\{(\d+)/);
      if (m) {
        currentPage = parseInt(m[1], 10);
        if (!pageToLines.has(currentPage)) pageToLines.set(currentPage, []);
        if (!pageToNodes.has(currentPage)) pageToNodes.set(currentPage, []);
      }
      return;
    }

    if (first === 125 /* } */) {
      currentPage = 0;
      return;
    }

    if (currentPage === 0) return;

    const m = s.match(/^([\[\(\)hvgxk$])(\d+)[:,\.](\d+)(?:[:,\.](\d+))?:(-?\d+),(-?\d+)(?::(-?\d+),(-?\d+))?/);
    if (m) {
      const tag = parseInt(m[2], 10);
      const line = parseInt(m[3], 10);
      const rawX = parseInt(m[5], 10);
      const rawY = parseInt(m[6], 10);
      const rawW = m[7] !== undefined ? parseInt(m[7], 10) : undefined;
      const rawH = m[8] !== undefined ? parseInt(m[8], 10) : undefined;

      const x = Math.round(rawX * scaleFactor);
      const y = Math.round(rawY * scaleFactor);
      const w = rawW !== undefined ? Math.max(Math.round(rawW * scaleFactor), 50) : undefined;
      const h = rawH !== undefined ? Math.max(Math.round(rawH * scaleFactor), 12) : undefined;

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

      let tagSet = tagToLinesMap.get(tag);
      if (!tagSet) {
        tagSet = new Set<number>();
        tagToLinesMap.set(tag, tagSet);
      }
      tagSet.add(line);
    }
  });

  for (const [page, lines] of pageToLines.entries()) {
    pageToLines.set(page, Array.from(new Set(lines)).sort((a, b) => a - b));
  }

  for (const [page, nodes] of pageToNodes.entries()) {
    pageToNodes.set(page, nodes.sort((a, b) => a.y - b.y));
  }

  const sortedLines = Array.from(lineToPage.keys()).sort((a, b) => a - b);

  const tagToSortedLines = new Map<number, number[]>();
  for (const [t, set] of tagToLinesMap.entries()) {
    tagToSortedLines.set(t, Array.from(set).sort((a, b) => a - b));
  }

  return {
    lineToPage,
    tagLineToPage,
    pageToLines,
    sortedLines,
    pageToNodes,
    tagLineToNode,
    tagToPath,
    pathToTag,
    tagToSortedLines,
  };
}

