/**
 * Pure PDF Viewport Math and Geometric Calculations
 */

export interface ViewportParams {
  containerWidth: number;
  containerHeight: number;
  zoom: number;
  fitMode?: 'fit-width' | 'fit-page' | 'page-width' | 'page-fit' | 'auto' | 'custom';
  viewMode?: 'continuous' | 'single' | 'spread';
}

export function calculateEffectiveViewportDimensions(params: ViewportParams): {
  effectivePageWidth: number;
  scale: number;
} {
  const { containerWidth, containerHeight, fitMode, viewMode } = params;
  if (viewMode === 'spread') {
    return {
      effectivePageWidth: Math.round((containerWidth - 32) / 2),
      scale: 1.0,
    };
  }

  if (fitMode === 'fit-page' || fitMode === 'page-fit') {
    return {
      effectivePageWidth: Math.round((containerHeight - 72) / 1.414),
      scale: 1.0,
    };
  }

  // default fit-width / page-width
  return {
    effectivePageWidth: containerWidth - 16,
    scale: 1.0,
  };
}

export function computeEffectivePdfPageWidth(params: ViewportParams): number {
  const {
    containerWidth,
    containerHeight,
    zoom = 1.0,
    fitMode = 'fit-width',
    viewMode = 'continuous',
  } = params;
  const containerH = containerHeight || 800;
  const fitPageWidth = Math.max(260, Math.round(((containerH - 72) / 1.414) * zoom));
  const fitWidthWidth = Math.max(320, Math.round(containerWidth * zoom));
  const spreadPageWidth = Math.max(260, Math.round((containerWidth / 2) * zoom));

  const isFitPage = fitMode === 'fit-page' || fitMode === 'page-fit';
  const standardPageWidth = isFitPage ? fitPageWidth : fitWidthWidth;
  return viewMode === 'spread' ? spreadPageWidth : standardPageWidth;
}

export function computeSpreadPairs(totalPages: number): Array<[number, number | null]> {
  const pairs: Array<[number, number | null]> = [];
  if (totalPages <= 0) return pairs;

  for (let p = 1; p <= totalPages; p += 2) {
    const next = p + 1 <= totalPages ? p + 1 : null;
    pairs.push([p, next]);
  }
  return pairs;
}

export function isPageInVirtualWindow(params: {
  pageNum: number;
  visiblePage: number;
  totalPages: number;
  viewMode?: string;
  pinnedPage?: number;
}): boolean {
  const { pageNum, visiblePage, pinnedPage } = params;
  if (pinnedPage !== undefined && pageNum === pinnedPage) return true;
  return Math.abs(pageNum - visiblePage) <= 2;
}

export function calculatePageAspectRatio(
  dims: { width: number; height: number },
  rotation: number = 0,
): number {
  const isRotated = (rotation / 90) % 2 !== 0;
  const w = isRotated ? dims.height : dims.width;
  const h = isRotated ? dims.width : dims.height;
  return h / Math.max(1, w);
}

export function normalizeRectCoordinates(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  pageWidth: number,
  pageHeight: number,
): { x1: number; y1: number; width: number; height: number } | null {
  if (pageWidth <= 0 || pageHeight <= 0) return null;
  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return {
    x1: Number((left / pageWidth).toFixed(4)),
    y1: Number((top / pageHeight).toFixed(4)),
    width: Number((width / pageWidth).toFixed(4)),
    height: Number((height / pageHeight).toFixed(4)),
  };
}
