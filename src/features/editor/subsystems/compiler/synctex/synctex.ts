/**
 * synctex.ts
 *
 * SyncTeX Coordinate Types & Thin Client Contract.
 * SyncTeX decompression, parsing, and 2D k-d tree spatial indexing are owned by
 * the backend CLSI SyncTeX domain service (`resolveForwardRemote` / `resolveReverseRemote`).
 */

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

export interface SyncTeXReverseResult {
  line: number;
  sourcePath: string | null;
}

export interface SyncTeXForwardDetail {
  page: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

export function resolveForwardDetail(
  line: number,
  map?: SyncTeXMap | Record<number, number> | null,
  _filePath?: string,
  numPages?: number,
): SyncTeXForwardDetail | null {
  if (!map) return null;
  const clampPage = (p: number) =>
    numPages && numPages > 0 ? Math.max(1, Math.min(numPages, p)) : Math.max(1, p);

  if ('lineToPage' in map) {
    const page = map.lineToPage.get(line);
    return page ? { page: clampPage(page) } : null;
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
  _xPt?: number,
  yPt?: number,
  pageHeightPt: number = DEFAULT_PDF_PAGE_HEIGHT_PT,
): SyncTeXReverseResult | null {
  if (!map || !('pageToLines' in map)) return null;

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
