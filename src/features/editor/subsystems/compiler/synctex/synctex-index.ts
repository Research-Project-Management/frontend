/**
 * synctex-index.ts
 *
 * SyncTeX Zero-Allocation Line Scanner & Bidirectional Coordinate Index (Domain Layer).
 */

export const TEX_SP_PER_PT = 65536;
export const TEX_PT_TO_BP = 72 / 72.27;
export const DEFAULT_PDF_PAGE_WIDTH_PT = 595;
export const DEFAULT_PDF_PAGE_HEIGHT_PT = 842;

export interface PdfPageDimensions {
  widthPt: number;
  heightPt: number;
}

export interface SyncTeXNode {
  line: number;
  tag: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  page?: number;
}

export interface KdTreeNode {
  node: SyncTeXNode;
  left: KdTreeNode | null;
  right: KdTreeNode | null;
  axis: number; // 0 for x, 1 for y
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  subMinX: number;
  subMaxX: number;
  subMinY: number;
  subMaxY: number;
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
  pageToKdTree?: Map<number, KdTreeNode>;
}

/**
 * Calculates effective bounding box and area for a SyncTeX node.
 * Respects baseline coordinates where glyphs extend upward by height and slightly downward.
 */
export function getNodeBounds(node: SyncTeXNode) {
  const width = node.w !== undefined && node.w > 0 ? node.w : 50;
  const height = node.h !== undefined && node.h > 0 ? node.h : 12;
  const minX = node.x;
  const maxX = node.x + width;
  const minY = Math.min(node.y - height, node.y);
  const maxY = Math.max(node.y + 4, node.y + height);
  const area = Math.max(1, (maxX - minX) * (maxY - minY));
  return { minX, maxX, minY, maxY, area };
}

/**
 * Calculates squared Euclidean distance from point (px, py) to an Axis-Aligned Bounding Box (AABB).
 * Returns 0 if the point is strictly inside the box.
 */
export function pointToAabbDistSq(
  px: number,
  py: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): number {
  const dx = px < minX ? minX - px : px > maxX ? px - maxX : 0;
  const dy = py < minY ? minY - py : py > maxY ? py - maxY : 0;
  return dx * dx + dy * dy;
}

function buildKdTreeFromPresorted(
  byX: SyncTeXNode[],
  byY: SyncTeXNode[],
  scratch: SyncTeXNode[],
  start: number,
  end: number,
  depth: number,
): KdTreeNode | null {
  if (start > end) return null;

  const axis = depth & 1; // 0: X-axis, 1: Y-axis

  if (start === end) {
    const current = axis === 0 ? byX[start] : byY[start];
    const bounds = getNodeBounds(current);
    return {
      node: current,
      left: null,
      right: null,
      axis,
      minX: bounds.minX,
      maxX: bounds.maxX,
      minY: bounds.minY,
      maxY: bounds.maxY,
      subMinX: bounds.minX,
      subMaxX: bounds.maxX,
      subMinY: bounds.minY,
      subMaxY: bounds.maxY,
    };
  }

  const len = end - start + 1;
  const mid = start + (len >> 1);

  const primary = axis === 0 ? byX : byY;
  const secondary = axis === 0 ? byY : byX;

  const current = primary[mid];

  // Mark which elements belong to the left partition [start .. mid - 1]
  // Using a Set of object references for exact O(1) membership while preserving secondary sort order
  const leftSet = new Set<SyncTeXNode>();
  for (let i = start; i < mid; i++) {
    leftSet.add(primary[i]);
  }

  let leftWrite = start;
  let rightWrite = mid + 1;
  for (let i = start; i <= end; i++) {
    const item = secondary[i];
    if (item === current) continue;
    if (leftSet.has(item)) {
      scratch[leftWrite++] = item;
    } else {
      scratch[rightWrite++] = item;
    }
  }
  scratch[mid] = current;
  for (let i = start; i <= end; i++) {
    secondary[i] = scratch[i];
  }

  const bounds = getNodeBounds(current);
  const left = buildKdTreeFromPresorted(byX, byY, scratch, start, mid - 1, depth + 1);
  const right = buildKdTreeFromPresorted(byX, byY, scratch, mid + 1, end, depth + 1);

  let subMinX = bounds.minX;
  let subMaxX = bounds.maxX;
  let subMinY = bounds.minY;
  let subMaxY = bounds.maxY;

  if (left) {
    if (left.subMinX < subMinX) subMinX = left.subMinX;
    if (left.subMaxX > subMaxX) subMaxX = left.subMaxX;
    if (left.subMinY < subMinY) subMinY = left.subMinY;
    if (left.subMaxY > subMaxY) subMaxY = left.subMaxY;
  }

  if (right) {
    if (right.subMinX < subMinX) subMinX = right.subMinX;
    if (right.subMaxX > subMaxX) subMaxX = right.subMaxX;
    if (right.subMinY < subMinY) subMinY = right.subMinY;
    if (right.subMaxY > subMaxY) subMaxY = right.subMaxY;
  }

  return {
    node: current,
    left,
    right,
    axis,
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY,
    subMinX,
    subMaxX,
    subMinY,
    subMaxY,
  };
}

/**
 * Constructs a 2D k-d Tree from an array of SyncTeX page nodes.
 * Uses pre-sorted dual-axis arrays (Wald / Brown algorithm) for O(N log N) build
 * while preserving secondary-axis spatial locality for optimal branch-and-bound pruning.
 */
export function buildKdTree2D(
  nodes: SyncTeXNode[],
  depth = 0,
): KdTreeNode | null {
  if (!nodes || nodes.length === 0) return null;
  const byX = nodes.slice().sort((a, b) => a.x - b.x);
  const byY = nodes.slice().sort((a, b) => a.y - b.y);
  const scratch = new Array<SyncTeXNode>(nodes.length);
  return buildKdTreeFromPresorted(byX, byY, scratch, 0, nodes.length - 1, depth);
}

export interface KdTreeSearchResult {
  bestNode: SyncTeXNode | null;
  bestDistSq: number;
  visitedCount: number;
}

/**
 * High-performance 2D Nearest Neighbor search with branch-and-bound pruning and containment priority.
 * Average time complexity: O(log N).
 */
export function searchKdTreeNearest(
  root: KdTreeNode | null,
  px: number,
  py: number,
): KdTreeSearchResult {
  if (!root) return { bestNode: null, bestDistSq: Infinity, visitedCount: 0 };

  let bestNode: SyncTeXNode | null = null;
  let bestDistSq = Infinity;
  let bestArea = Infinity;
  let visitedCount = 0;

  const stack: KdTreeNode[] = [root];
  let stackTop = 1;

  while (stackTop > 0) {
    const curr = stack[--stackTop]!;

    // Prune branch if minimum distance to the entire subtree bounding box exceeds current best
    const dxSub = px < curr.subMinX ? curr.subMinX - px : px > curr.subMaxX ? px - curr.subMaxX : 0;
    const dySub = py < curr.subMinY ? curr.subMinY - py : py > curr.subMaxY ? py - curr.subMaxY : 0;
    const subtreeMinDistSq = dxSub * dxSub + dySub * dySub;

    if (subtreeMinDistSq > bestDistSq || (bestDistSq === 0 && subtreeMinDistSq > 0)) {
      continue;
    }

    visitedCount++;

    // Distance from query point to current node's bounding box
    const dx = px < curr.minX ? curr.minX - px : px > curr.maxX ? px - curr.maxX : 0;
    const dy = py < curr.minY ? curr.minY - py : py > curr.maxY ? py - curr.maxY : 0;
    const distSq = dx * dx + dy * dy;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestNode = curr.node;
      const area = (curr.maxX - curr.minX) * (curr.maxY - curr.minY);
      bestArea = area > 1 ? area : 1;
    } else if (distSq === bestDistSq && distSq === 0) {
      const area = (curr.maxX - curr.minX) * (curr.maxY - curr.minY);
      const currArea = area > 1 ? area : 1;
      if (currArea < bestArea) {
        // Containment tie-breaker: prioritize tighter inner box (e.g., inline math/token over line)
        bestNode = curr.node;
        bestArea = currArea;
      }
    }

    // Traverse closest child subtree first for faster branch-and-bound pruning
    // Since we use a LIFO stack, push `second` first and `first` last so `first` is popped first.
    const goLeftFirst = (curr.axis === 0 ? px : py) < (curr.axis === 0 ? curr.node.x : curr.node.y);
    const first = goLeftFirst ? curr.left : curr.right;
    const second = goLeftFirst ? curr.right : curr.left;

    if (second) {
      const sdx = px < second.subMinX ? second.subMinX - px : px > second.subMaxX ? px - second.subMaxX : 0;
      const sdy = py < second.subMinY ? second.subMinY - py : py > second.subMaxY ? py - second.subMaxY : 0;
      const secondMinDistSq = sdx * sdx + sdy * sdy;
      if (secondMinDistSq <= bestDistSq) {
        stack[stackTop++] = second;
      }
    }

    if (first) {
      const fdx = px < first.subMinX ? first.subMinX - px : px > first.subMaxX ? px - first.subMaxX : 0;
      const fdy = py < first.subMinY ? first.subMinY - py : py > first.subMaxY ? py - first.subMaxY : 0;
      const firstMinDistSq = fdx * fdx + fdy * fdy;
      if (firstMinDistSq <= bestDistSq) {
        stack[stackTop++] = first;
      }
    }
  }

  return { bestNode, bestDistSq, visitedCount };
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

      if (bestCandidate === null) {
        bestCandidate = tagSorted[0];
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

  if (bestCandidate === null) {
    bestCandidate = sorted[0];
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
export function isBase64GzipSyncTeX(payload: string | null | undefined): boolean {
  return typeof payload === 'string' && payload.trimStart().startsWith('H4sI');
}

export async function decompressSyncTeXData(payload: string): Promise<string> {
  if (!payload || typeof payload !== 'string') return '';
  const trimmed = payload.trim();

  const isRawGzip = trimmed.charCodeAt(0) === 0x1f && trimmed.charCodeAt(1) === 0x8b;
  if (!isBase64GzipSyncTeX(trimmed) && !isRawGzip) {
    // Plain-text SyncTeX path
    return trimmed;
  }

  try {
    const g = globalThis as typeof globalThis & { atob?: (s: string) => string };
    if (typeof DecompressionStream === 'undefined') {
      console.warn('[SyncTeX] DecompressionStream unavailable; cannot decode gzip SyncTeX payload');
      return '';
    }
    let binaryString: string;
    if (isRawGzip) {
      binaryString = trimmed;
    } else if (typeof g.atob === 'function') {
      binaryString = g.atob(trimmed.replace(/\s+/g, ''));
    } else {
      return '';
    }
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i) & 0xff;
    }
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const stream = source.pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return new TextDecoder('utf-8').decode(out);
  } catch (err) {
    console.debug('[SyncTeX] Client-side gzip decompression failed:', err);
    return '';
  }
}

const PAGE_START_REGEX = /^\{(\d+)/;
const NODE_LINE_REGEX = /^([\[\(\)hvgxk$])(\d+)[:,\.](\d+)(?:[:,\.](\d+))?:(-?\d+),(-?\d+)(?::(-?\d+),(-?\d+))?/;

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
  let scaleFactor = (unit / TEX_SP_PER_PT) * TEX_PT_TO_BP;
  let currentPage = 0;

  forEachLine(text, (raw) => {
    const s = raw.trimEnd();
    if (!s) return;

    if (s.startsWith("Unit:")) {
      const parsedUnit = parseFloat(s.substring(5).trim());
      if (!isNaN(parsedUnit) && parsedUnit > 0) {
        unit = parsedUnit;
        scaleFactor = (unit / TEX_SP_PER_PT) * TEX_PT_TO_BP;
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
      const m = PAGE_START_REGEX.exec(s);
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

    const m = NODE_LINE_REGEX.exec(s);
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

  const pageToKdTree = new Map<number, KdTreeNode>();
  for (const [page, nodes] of pageToNodes.entries()) {
    const root = buildKdTree2D(nodes);
    if (root) {
      pageToKdTree.set(page, root);
    }
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
    pageToKdTree,
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
        let low = 0;
        let high = sorted.length - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (sorted[mid] <= line) {
            bestLine = sorted[mid];
            low = mid + 1;
          } else {
            high = mid - 1;
          }
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

export interface SyncTeXReverseResult {
  sourcePath: string | null;
  line: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

/**
 * SyncTeX reverse resolution (PDF double-click -> LaTeX source line and file)
 * Utilizes 2D k-d Tree spatial index for O(log N) nearest neighbor search with bounding box containment
 * and two-column layout disambiguation. Falls back to 1D search for legacy maps or undefined ptX.
 */
export function resolveReverse(
  clickFraction: number,
  pageNum: number,
  synctexMap: SyncTeXMap | null | undefined,
  ptX?: number,
  ptY?: number,
  pageHeightPt: number = DEFAULT_PDF_PAGE_HEIGHT_PT,
): SyncTeXReverseResult | null {
  if (!synctexMap) return null;

  const targetY = ptY !== undefined ? ptY : clickFraction * pageHeightPt;

  // 1. High-Performance 2D k-d Tree Spatial Resolution (O(log N) with Bounding Box Containment)
  if (ptX !== undefined && synctexMap.pageToKdTree?.has(pageNum)) {
    const kdRoot = synctexMap.pageToKdTree.get(pageNum)!;
    const { bestNode } = searchKdTreeNearest(kdRoot, ptX, targetY);
    if (bestNode) {
      const sourcePath = synctexMap.tagToPath?.get(bestNode.tag) || null;
      return {
        sourcePath,
        line: bestNode.line,
        x: bestNode.x,
        y: bestNode.y,
        w: bestNode.w,
        h: bestNode.h,
      };
    }
  }

  // 2. Direct page node mapping (fallback for legacy maps or undefined ptX)
  const nodes = synctexMap.pageToNodes?.get(pageNum);
  if (nodes && nodes.length > 0) {
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
      return {
        sourcePath,
        line: bestNode.line,
        x: bestNode.x,
        y: bestNode.y,
        w: bestNode.w,
        h: bestNode.h,
      };
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

