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

export function buildKdTree2D(_nodes: SyncTeXNode[], _depth = 0): KdTreeNode | null {
  return null;
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
  return map.lineToPage.get(line) ?? null;
}

export function parseSyncTeX(
  _rawText: string,
  _pageDimensions?: PdfPageDimensions,
): SyncTeXMap {
  return {
    lineToPage: new Map(),
    tagLineToPage: new Map(),
    pageToLines: new Map(),
    sortedLines: [],
    pageToNodes: new Map(),
    tagLineToNode: new Map(),
    tagToPath: new Map(),
    pathToTag: new Map(),
    tagToSortedLines: new Map(),
    pageToKdTree: new Map(),
  };
}

export async function decompressSyncTeXData(_base64OrRaw: string): Promise<string> {
  return '';
}

export function resolveForwardDetail(
  line: number,
  map?: SyncTeXMap | Record<number, number> | null,
  _filePath?: string,
  _numPages = 1,
): { page: number; x?: number; y?: number; w?: number; h?: number } | null {
  if (!map) return null;
  if ('lineToPage' in map) {
    const page = map.lineToPage.get(line);
    return page ? { page } : null;
  }
  const page = (map as Record<number, number>)[line];
  return page ? { page } : null;
}

export function resolveForward(
  line: number,
  map?: SyncTeXMap | Record<number, number> | null,
  filePath?: string,
  numPages = 1,
): number | null {
  return resolveForwardDetail(line, map, filePath, numPages)?.page ?? null;
}

export function resolveReverse(
  _yFraction: number,
  pageNumber: number,
  map?: SyncTeXMap | Record<number, number> | null,
  _xPt?: number,
  _yPt?: number,
  _pageHeightPt: number = DEFAULT_PDF_PAGE_HEIGHT_PT,
): SyncTeXReverseResult | null {
  if (!map || !('pageToLines' in map)) return null;
  const lines = map.pageToLines.get(pageNumber);
  if (lines && lines.length > 0) {
    return { line: lines[0], sourcePath: null };
  }
  return null;
}
