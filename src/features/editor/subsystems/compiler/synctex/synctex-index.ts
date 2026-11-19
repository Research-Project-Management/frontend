/**
 * synctex-index.ts
 *
 * SyncTeX Coordinate Types & Thin Client Contract (Domain Layer).
 * SyncTeX decompression, parsing, and 2D k-d tree spatial indexing are owned by
 * the backend CLSI SyncTeX domain service (`resolveForwardRemote` / `resolveReverseRemote`).
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
  axis: number;
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

export interface SyncTeXReverseResult {
  line: number;
  sourcePath: string | null;
}

export function getNodeBounds(node: SyncTeXNode): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  area: number;
} {
  const w = Math.max(0, node.w ?? 0);
  const h = Math.max(0, node.h ?? 0);
  const minX = node.x;
  const maxX = node.x + w;
  const minY = node.y - h;
  const maxY = node.y + h;
  return {
    minX,
    maxX,
    minY,
    maxY,
    area: Math.max(0, maxX - minX) * Math.max(0, maxY - minY),
  };
}

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

export function buildKdTree2D(nodes: SyncTeXNode[], depth = 0): KdTreeNode | null {
  if (!nodes || nodes.length === 0) return null;

  const axis = depth % 2;
  const sorted = [...nodes].sort((a, b) =>
    axis === 0 ? a.x - b.x : a.y - b.y,
  );
  const mid = Math.floor(sorted.length / 2);
  const current = sorted[mid];
  const bounds = getNodeBounds(current);

  const left = buildKdTree2D(sorted.slice(0, mid), depth + 1);
  const right = buildKdTree2D(sorted.slice(mid + 1), depth + 1);

  return {
    node: current,
    left,
    right,
    axis,
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY,
    subMinX: Math.min(
      bounds.minX,
      left?.subMinX ?? Infinity,
      right?.subMinX ?? Infinity,
    ),
    subMaxX: Math.max(
      bounds.maxX,
      left?.subMaxX ?? -Infinity,
      right?.subMaxX ?? -Infinity,
    ),
    subMinY: Math.min(
      bounds.minY,
      left?.subMinY ?? Infinity,
      right?.subMinY ?? Infinity,
    ),
    subMaxY: Math.max(
      bounds.maxY,
      left?.subMaxY ?? -Infinity,
      right?.subMaxY ?? -Infinity,
    ),
  };
}

export function searchKdTreeNearest(
  root: KdTreeNode | null,
  px: number,
  py: number,
): { bestNode: SyncTeXNode | null; bestDistSq: number; visitedCount: number } {
  if (!root) {
    return { bestNode: null, bestDistSq: Infinity, visitedCount: 0 };
  }

  let bestNode: SyncTeXNode | null = null;
  let bestDistSq = Infinity;
  let bestArea = Infinity;
  let visitedCount = 0;

  const visit = (kNode: KdTreeNode | null): void => {
    if (!kNode) return;
    const subDistSq = pointToAabbDistSq(
      px,
      py,
      kNode.subMinX,
      kNode.subMaxX,
      kNode.subMinY,
      kNode.subMaxY,
    );
    if (subDistSq > bestDistSq) return;

    visitedCount++;

    const distSq = pointToAabbDistSq(
      px,
      py,
      kNode.minX,
      kNode.maxX,
      kNode.minY,
      kNode.maxY,
    );
    const area =
      Math.max(0, kNode.maxX - kNode.minX) *
      Math.max(0, kNode.maxY - kNode.minY);

    if (
      distSq < bestDistSq ||
      (distSq === bestDistSq && area < bestArea)
    ) {
      bestDistSq = distSq;
      bestArea = area;
      bestNode = kNode.node;
    }

    const goLeftFirst =
      kNode.axis === 0 ? px <= kNode.node.x : py <= kNode.node.y;
    const first = goLeftFirst ? kNode.left : kNode.right;
    const second = goLeftFirst ? kNode.right : kNode.left;

    visit(first);
    visit(second);
  };

  visit(root);
  return { bestNode, bestDistSq, visitedCount };
}

export function forEachLine(
  text: string,
  callback: (line: string, lineNumber: number) => void | boolean,
): void {
  if (!text) return;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (callback(lines[i], i + 1) === false) break;
  }
}

export function resolvePageForLine(
  map: SyncTeXMap | null | undefined,
  line: number,
  tag?: number,
): number | null {
  if (!map) return null;
  if (tag !== undefined) {
    const tagged = map.tagLineToPage.get(`${tag}:${line}`);
    if (tagged !== undefined) return tagged;
  }
  const direct = map.lineToPage.get(line);
  if (direct !== undefined) return direct;

  const candidates =
    tag !== undefined ? map.tagToSortedLines.get(tag) : map.sortedLines;
  if (!candidates || candidates.length === 0) return null;

  let lo = 0;
  let hi = candidates.length - 1;
  let bestIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candidates[mid] <= line) {
      bestIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (bestIdx === -1) return null;
  const bestLine = candidates[bestIdx];
  if (line - bestLine > 100) {
    return null;
  }
  if (tag !== undefined) {
    return map.tagLineToPage.get(`${tag}:${bestLine}`) ?? map.lineToPage.get(bestLine) ?? null;
  }
  return map.lineToPage.get(bestLine) ?? null;
}

function spToPt(sp: number): number {
  return Math.round((sp / TEX_SP_PER_PT) * TEX_PT_TO_BP);
}

function cleanNormalizePath(rawPath: string): string {
  let clean = rawPath.trim().replace(/\\/g, '/');
  while (/^(\.\/+|\/+)/.test(clean)) {
    clean = clean.replace(/^(\.\/+|\/+)/, '');
  }
  return clean;
}

export function parseSyncTeX(
  rawText: string,
  _pageDimensions?: PdfPageDimensions,
): SyncTeXMap {
  const lineToPage = new Map<number, number>();
  const tagLineToPage = new Map<string, number>();
  const pageToLines = new Map<number, number[]>();
  const pageLineSets = new Map<number, Set<number>>();
  const pageToNodes = new Map<number, SyncTeXNode[]>();
  const tagLineToNode = new Map<string, SyncTeXNode & { page: number }>();
  const tagToPath = new Map<number, string>();
  const pathToTag = new Map<string, number>();
  const tagLineSets = new Map<number, Set<number>>();
  const allLineSet = new Set<number>();

  if (!rawText || !rawText.trim() || isBase64GzipSyncTeX(rawText)) {
    return {
      lineToPage,
      tagLineToPage,
      pageToLines,
      sortedLines: [],
      pageToNodes,
      tagLineToNode,
      tagToPath,
      pathToTag,
      tagToSortedLines: new Map(),
      pageToKdTree: new Map(),
    };
  }

  let currentPage = 0;
  const recordRegex =
    /^([(\[xhvgk])(\d+)[:,](\d+)(?:,\d+)?:(-?\d+),(-?\d+)(?::(-?\d+),(-?\d+)(?:[,:]-?\d+)?)?/;

  forEachLine(rawText, (line) => {
    if (!line) return;

    if (line.startsWith('Input:')) {
      const m = line.match(/^Input:(\d+):(.+)$/);
      if (m) {
        const tag = Number(m[1]);
        const rawPath = m[2].trim();
        tagToPath.set(tag, rawPath);

        const noLead = cleanNormalizePath(rawPath);
        const basename = noLead.split('/').pop() || noLead;
        const noExt = noLead.replace(/\.(tex|bib|sty|cls)$/i, '');
        const baseNoExt = basename.replace(/\.(tex|bib|sty|cls)$/i, '');

        for (const variant of [rawPath, noLead, basename, noExt, baseNoExt]) {
          if (variant && !pathToTag.has(variant)) {
            pathToTag.set(variant, tag);
          }
        }
      }
      return;
    }

    const pageStart = line.match(/^\{(\d+)\s*$/);
    if (pageStart) {
      currentPage = Number(pageStart[1]);
      return;
    }

    if (/^\}\d*\s*$/.test(line)) {
      currentPage = 0;
      return;
    }

    if (currentPage <= 0) return;

    const rec = line.match(recordRegex);
    if (!rec) return;

    const kind = rec[1];
    const tag = Number(rec[2]);
    const srcLine = Number(rec[3]);
    const xPt = spToPt(Number(rec[4]));
    const yPt = spToPt(Number(rec[5]));
    const hasDims = rec[6] !== undefined && rec[7] !== undefined;
    const rawW = hasDims ? spToPt(Math.abs(Number(rec[6]))) : undefined;
    const rawH = hasDims ? spToPt(Math.abs(Number(rec[7]))) : undefined;
    const w = hasDims && kind !== 'x' ? rawW : undefined;
    const h =
      hasDims && kind !== 'x' && rawH !== undefined && rawH > 0
        ? kind === '(' || kind === '['
          ? Math.max(12, rawH)
          : rawH
        : undefined;

    const node: SyncTeXNode & { page: number } = {
      line: srcLine,
      tag,
      x: xPt,
      y: yPt,
      ...(w !== undefined ? { w } : {}),
      ...(h !== undefined ? { h } : {}),
      page: currentPage,
    };

    if (!pageToNodes.has(currentPage)) pageToNodes.set(currentPage, []);
    pageToNodes.get(currentPage)!.push(node);

    const tagKey = `${tag}:${srcLine}`;
    if (!tagLineToPage.has(tagKey)) tagLineToPage.set(tagKey, currentPage);
    if (!tagLineToNode.has(tagKey)) tagLineToNode.set(tagKey, node);
    if (!lineToPage.has(srcLine)) lineToPage.set(srcLine, currentPage);

    if (!pageLineSets.has(currentPage)) pageLineSets.set(currentPage, new Set());
    pageLineSets.get(currentPage)!.add(srcLine);

    if (!tagLineSets.has(tag)) tagLineSets.set(tag, new Set());
    tagLineSets.get(tag)!.add(srcLine);
    allLineSet.add(srcLine);
  });

  for (const [pg, lineSet] of pageLineSets.entries()) {
    pageToLines.set(
      pg,
      Array.from(lineSet).sort((a, b) => a - b),
    );
  }

  const tagToSortedLines = new Map<number, number[]>();
  for (const [t, set] of tagLineSets.entries()) {
    tagToSortedLines.set(
      t,
      Array.from(set).sort((a, b) => a - b),
    );
  }

  const pageToKdTree = new Map<number, KdTreeNode>();
  for (const [pg, nodes] of pageToNodes.entries()) {
    const tree = buildKdTree2D(nodes);
    if (tree) pageToKdTree.set(pg, tree);
  }

  return {
    lineToPage,
    tagLineToPage,
    pageToLines,
    sortedLines: Array.from(allLineSet).sort((a, b) => a - b),
    pageToNodes,
    tagLineToNode,
    tagToPath,
    pathToTag,
    tagToSortedLines,
    pageToKdTree,
  };
}

export function isBase64GzipSyncTeX(raw: string): boolean {
  return typeof raw === 'string' && raw.trimStart().startsWith('H4sI');
}

function decodeBase64ToBytes(b64: string): Uint8Array | null {
  const clean = b64.replace(/\s+/g, '');
  if (!clean || !/^[A-Za-z0-9+/=]+$/.test(clean)) return null;
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function decompressSyncTeXData(base64OrRaw: string): Promise<string> {
  if (!base64OrRaw || !base64OrRaw.trim()) return '';
  if (!isBase64GzipSyncTeX(base64OrRaw)) {
    return base64OrRaw.includes('SyncTeX') || base64OrRaw.includes('Input:')
      ? base64OrRaw
      : '';
  }

  const bytes = decodeBase64ToBytes(base64OrRaw);
  if (!bytes || bytes.length === 0) return '';

  try {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      await writer.write(new Uint8Array(bytes));
      await writer.close();
      const response = new Response(ds.readable);
      return await response.text();
    }
  } catch {
    return '';
  }

  try {
    const zlib = await import('node:zlib');
    return zlib.gunzipSync(Buffer.from(bytes)).toString('utf8');
  } catch {
    return '';
  }
}

export async function decompressSyncTeXBytes(input: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength === 0) return '';

  const isGzip = bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) {
    const decoded = typeof TextDecoder !== 'undefined'
      ? new TextDecoder().decode(bytes)
      : Buffer.from(bytes).toString('utf8');
    return decoded.includes('SyncTeX') || decoded.includes('Input:') ? decoded : '';
  }

  try {
    if (typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      await writer.write(new Uint8Array(bytes));
      await writer.close();
      const response = new Response(ds.readable);
      return await response.text();
    }
  } catch {
    return '';
  }

  try {
    const zlib = await import('node:zlib');
    return zlib.gunzipSync(Buffer.from(bytes)).toString('utf8');
  } catch {
    return '';
  }
}

export function resolveForwardDetail(
  line: number,
  map?: SyncTeXMap | Record<number, number> | null,
  filePath?: string,
  numPages?: number,
): { page: number; x?: number; y?: number; w?: number; h?: number } | null {
  if (!map) return null;
  const clampPage = (pageNum: number): number =>
    numPages !== undefined && numPages > 0
      ? Math.min(numPages, Math.max(1, pageNum))
      : pageNum;
  if ('lineToPage' in map) {
    if (filePath) {
      const clean = cleanNormalizePath(filePath);
      const basename = clean.split('/').pop() || clean;
      const noExt = clean.replace(/\.(tex|bib|sty|cls)$/i, '');
      const baseNoExt = basename.replace(/\.(tex|bib|sty|cls)$/i, '');
      let tag =
        map.pathToTag.get(filePath.trim()) ??
        map.pathToTag.get(clean) ??
        map.pathToTag.get(basename) ??
        map.pathToTag.get(noExt) ??
        map.pathToTag.get(baseNoExt);
      if (tag === undefined) {
        for (const [k, t] of map.pathToTag.entries()) {
          if (k.endsWith('/' + clean) || clean.endsWith('/' + k)) {
            tag = t;
            break;
          }
        }
      }
      if (tag !== undefined) {
        const key = `${tag}:${line}`;
        const node = map.tagLineToNode.get(key);
        if (node) {
          return {
            page: clampPage(node.page),
            x: node.x,
            y: node.y,
            ...(node.w !== undefined ? { w: node.w } : {}),
            ...(node.h !== undefined ? { h: node.h } : {}),
          };
        }
        const taggedPage = map.tagLineToPage.get(key);
        if (taggedPage !== undefined) {
          return {
            page: clampPage(taggedPage),
          };
        }
        return null;
      }
    }
    const page = map.lineToPage.get(line);
    if (!page) return null;
    for (const [k, n] of map.tagLineToNode.entries()) {
      if (k.endsWith(`:${line}`) && n.page === page) {
        return {
          page: clampPage(n.page),
          x: n.x,
          y: n.y,
          ...(n.w !== undefined ? { w: n.w } : {}),
          ...(n.h !== undefined ? { h: n.h } : {}),
        };
      }
    }
    return {
      page: clampPage(page),
    };
  }
  const page = (map as Record<number, number>)[line];
  return page ? { page: clampPage(page) } : null;
}

export function resolveForward(
  line: number,
  map?: SyncTeXMap | Record<number, number> | null,
  filePath?: string,
  numPages?: number,
): number | null {
  return resolveForwardDetail(line, map, filePath, numPages)?.page ?? null;
}

export function resolveReverse(
  yFraction: number,
  pageNumber: number,
  map?: SyncTeXMap | Record<number, number> | null,
  xPt?: number,
  yPt?: number,
  pageHeightPt: number = DEFAULT_PDF_PAGE_HEIGHT_PT,
): SyncTeXReverseResult | null {
  if (!map || !('pageToLines' in map)) return null;

  if (xPt !== undefined && yPt !== undefined) {
    const kdTree = map.pageToKdTree?.get(pageNumber);
    if (kdTree) {
      const { bestNode } = searchKdTreeNearest(kdTree, xPt, yPt);
      if (bestNode) {
        return {
          line: bestNode.line,
          sourcePath: map.tagToPath.get(bestNode.tag) ?? null,
        };
      }
    }

    const pageNodes = map.pageToNodes.get(pageNumber);
    if (pageNodes && pageNodes.length > 0) {
      let best = pageNodes[0];
      let bestDistSq = Infinity;
      let bestArea = Infinity;
      for (const n of pageNodes) {
        const b = getNodeBounds(n);
        const dSq = pointToAabbDistSq(xPt, yPt, b.minX, b.maxX, b.minY, b.maxY);
        if (dSq < bestDistSq || (dSq === bestDistSq && b.area < bestArea)) {
          bestDistSq = dSq;
          bestArea = b.area;
          best = n;
        }
      }
      return {
        line: best.line,
        sourcePath: map.tagToPath.get(best.tag) ?? null,
      };
    }
  }

  const pageNodes = map.pageToNodes.get(pageNumber);
  if (pageNodes && pageNodes.length > 0) {
    const targetY =
      yPt ?? Math.max(0, Math.min(1, yFraction)) * (pageHeightPt || DEFAULT_PDF_PAGE_HEIGHT_PT);
    let best = pageNodes[0];
    let bestDelta = Math.abs(best.y - targetY);
    for (let i = 1; i < pageNodes.length; i++) {
      const delta = Math.abs(pageNodes[i].y - targetY);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = pageNodes[i];
      }
    }
    return {
      line: best.line,
      sourcePath: map.tagToPath.get(best.tag) ?? null,
    };
  }

  const lines = map.pageToLines.get(pageNumber);
  if (lines && lines.length > 0) {
    return { line: lines[0], sourcePath: null };
  }
  return null;
}
