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
    return null;
  }

  // Fallback for root document (tag 1 or unspecified tag)
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
 * Asynchronously decompresses a SyncTeX payload if provided as base64-encoded gzip.
 * If already plain text, returns as-is.
 */
export async function decompressSyncTeXData(payload: string): Promise<string> {
  if (!payload || typeof payload !== 'string') return '';
  const trimmed = payload.trim();
  if (trimmed.startsWith('SyncTeX') || trimmed.includes('Unit:') || trimmed.includes('Input:')) {
    return trimmed;
  }

  try {
    if (typeof window !== 'undefined' && typeof window.atob === 'function' && typeof DecompressionStream !== 'undefined') {
      const binaryString = window.atob(trimmed);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).text();
    }
  } catch (err) {
    console.debug('[SyncTeX] Client-side gzip decompression failed or not gzip format:', err);
  }

  return trimmed;
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
        const cleanNorm = normalized.replace(/^\.\//, '');

        pathToTag.set(basename, tag);
        pathToTag.set(normalized, tag);
        pathToTag.set(cleanNorm, tag);

        const cleanNoExt = cleanNorm.replace(/\.(tex|bib|sty|cls)$/i, '');
        const baseNoExt = basename.replace(/\.(tex|bib|sty|cls)$/i, '');
        pathToTag.set(cleanNoExt, tag);
        pathToTag.set(baseNoExt, tag);

        const segments = cleanNorm.split('/');
        for (let i = 0; i < segments.length; i++) {
          const subPath = segments.slice(i).join('/');
          if (subPath && !pathToTag.has(subPath)) {
            pathToTag.set(subPath, tag);
            pathToTag.set(subPath.replace(/\.(tex|bib|sty|cls)$/i, ''), tag);
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

/**
 * SyncTeX forward resolution with coordinate detail
 */
export function resolveForwardDetail(
  line: number,
  synctexMap: SyncTeXMap | null | undefined,
  activeTitle?: string,
  maxPages?: number,
): { page: number; x?: number; y?: number; w?: number; h?: number } | null {
  if (!synctexMap) return null;

  let targetPage: number | null = null;
  let targetNode: (SyncTeXNode & { page?: number }) | null = null;
  let targetTag: number | undefined;

  if (activeTitle && synctexMap.pathToTag) {
    const normalizedTitle = activeTitle.replace(/\\/g, '/').toLowerCase();
    const cleanNorm = normalizedTitle.replace(/^\.\//, '');
    const baseTitle = cleanNorm.split('/').pop() || cleanNorm;
    const withTex = cleanNorm.endsWith('.tex') ? cleanNorm : `${cleanNorm}.tex`;
    const baseWithTex = baseTitle.endsWith('.tex') ? baseTitle : `${baseTitle}.tex`;
    const noExt = cleanNorm.replace(/\.(tex|bib|sty|cls)$/i, '');
    const baseNoExt = baseTitle.replace(/\.(tex|bib|sty|cls)$/i, '');

    targetTag =
      synctexMap.pathToTag.get(cleanNorm) ??
      synctexMap.pathToTag.get(withTex) ??
      synctexMap.pathToTag.get(noExt) ??
      synctexMap.pathToTag.get(baseTitle) ??
      synctexMap.pathToTag.get(baseWithTex) ??
      synctexMap.pathToTag.get(baseNoExt) ??
      synctexMap.pathToTag.get(`./${cleanNorm}`) ??
      synctexMap.pathToTag.get(`./${withTex}`);
    if (targetTag !== undefined) {
      const key = `${targetTag}:${line}`;
      if (synctexMap.tagLineToPage.has(key)) {
        targetPage = synctexMap.tagLineToPage.get(key)!;
        targetNode = synctexMap.tagLineToNode?.get(key) || null;
      }
    }
  }

  if (targetPage === null) {
    targetPage = resolvePageForLine(synctexMap, line, targetTag);
    if (targetPage !== null) {
      if (targetTag !== undefined && synctexMap.tagToSortedLines?.has(targetTag)) {
        const sorted = synctexMap.tagToSortedLines.get(targetTag)!;
        let bestLine = sorted[0];
        for (const l of sorted) {
          if (l <= line) bestLine = l;
          else break;
        }
        targetNode = synctexMap.tagLineToNode?.get(`${targetTag}:${bestLine}`) || null;
      }
      if (!targetNode) {
        const pNodes = synctexMap.pageToNodes?.get(targetPage);
        targetNode = pNodes?.find((n) => n.line === line) || pNodes?.[0] || null;
      }
    }
  }

  if (targetPage !== null && targetPage >= 1 && (!maxPages || targetPage <= maxPages)) {
    return {
      page: targetPage,
      x: targetNode?.x,
      y: targetNode?.y,
      w: targetNode?.w,
      h: targetNode?.h,
    };
  }

  return null;
}

/**
 * SyncTeX forward resolution (Editor line -> PDF page number)
 */
export function resolveForward(
  line: number,
  synctexMap: SyncTeXMap | null | undefined,
  activeTitle?: string,
  maxPages?: number,
): number | null {
  return resolveForwardDetail(line, synctexMap, activeTitle, maxPages)?.page ?? null;
}

/**
 * SyncTeX reverse resolution (PDF double-click -> LaTeX source line and file)
 * Employs O(log N) binary search on y-sorted nodes with branch-and-bound geometric pruning.
 */
export function resolveReverse(
  clickFraction: number,
  pageNum: number,
  synctexMap: SyncTeXMap | null | undefined,
  ptX?: number,
  ptY?: number,
): { sourcePath: string | null; line: number } | null {
  if (!synctexMap) return null;

  // 1. Direct page node mapping (nearest coordinate with O(log N) binary search + pruning)
  const nodes = synctexMap.pageToNodes?.get(pageNum);
  if (nodes && nodes.length > 0) {
    const targetY = ptY !== undefined ? ptY : clickFraction * 842;
    const targetX = ptX !== undefined ? ptX : undefined;

    // Binary search for node closest in y-coordinate
    let low = 0;
    let high = nodes.length - 1;
    let mid = 0;
    while (low <= high) {
      mid = (low + high) >> 1;
      if (nodes[mid].y < targetY) {
        low = mid + 1;
      } else if (nodes[mid].y > targetY) {
        high = mid - 1;
      } else {
        break;
      }
    }
    mid = Math.max(0, Math.min(nodes.length - 1, mid));

    let bestNode = nodes[mid];
    const initDy = bestNode.y - targetY;
    const initDx = targetX !== undefined ? bestNode.x - targetX : 0;
    let bestDist = initDy * initDy + 0.1 * (initDx * initDx);

    // Search downward (decreasing y): prune as soon as dy^2 >= bestDist
    for (let i = mid - 1; i >= 0; i--) {
      const n = nodes[i];
      const dy = targetY - n.y;
      if (dy * dy >= bestDist) {
        break;
      }
      const dx = targetX !== undefined ? n.x - targetX : 0;
      const dist = dy * dy + 0.1 * (dx * dx);
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = n;
      }
    }

    // Search upward (increasing y): prune as soon as dy^2 >= bestDist
    for (let i = mid + 1; i < nodes.length; i++) {
      const n = nodes[i];
      const dy = n.y - targetY;
      if (dy * dy >= bestDist) {
        break;
      }
      const dx = targetX !== undefined ? n.x - targetX : 0;
      const dist = dy * dy + 0.1 * (dx * dx);
      if (dist < bestDist) {
        bestDist = dist;
        bestNode = n;
      }
    }

    if (bestNode) {
      const sourcePath = synctexMap.tagToPath?.get(bestNode.tag) || null;
      return { sourcePath, line: bestNode.line };
    }
  }

  // 2. Binary search fallback on line numbers
  const lines = synctexMap.pageToLines?.get(pageNum);
  if (lines && lines.length > 0) {
    const idx = Math.min(Math.floor(clickFraction * lines.length), lines.length - 1);
    return { sourcePath: null, line: lines[idx] };
  }

  return null;
}

