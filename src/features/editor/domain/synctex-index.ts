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
  tagToSortedLines?: Map<number, number[]>;
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
