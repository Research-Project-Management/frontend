/**
 * OptimizedPdfPage.tsx
 *
 * Virtualized individual PDF page shell with IntersectionObserver registration,
 * canvas memory cleanup on off-screen exit, and SyncTeX double-click/Ctrl-click capture.
 */

'use client';

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Page } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  DEFAULT_PDF_PAGE_HEIGHT_PT,
  type PdfPageDimensions,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { cn } from '@/shared/lib/utils';
import {
  getCappedDevicePixelRatio,
  releaseCanvasMemory,
} from '@/shared/lib/pdfjs-worker';
import {
  PdfSyncTeXHighlightBox,
  type SynctexHighlightState,
} from './PdfSyncTeXHighlightBox';

export function extractPageDimensionsPt(page: {
  getViewport?: (params: { scale: number }) => { width?: number; height?: number };
  view?: number[];
  originalWidth?: number;
  originalHeight?: number;
  width?: number;
  height?: number;
}): PdfPageDimensions {
  let widthPt = 0;
  let heightPt = 0;

  if (typeof page.getViewport === 'function') {
    try {
      const vp = page.getViewport({ scale: 1 });
      if (vp?.width && vp.width > 0) widthPt = vp.width;
      if (vp?.height && vp.height > 0) heightPt = vp.height;
    } catch {
      // fallback to view or originalWidth/Height
    }
  }

  if ((!widthPt || !heightPt) && Array.isArray(page.view) && page.view.length >= 4) {
    const vw = page.view[2] - page.view[0];
    const vh = page.view[3] - page.view[1];
    if (!widthPt && vw > 0) widthPt = vw;
    if (!heightPt && vh > 0) heightPt = vh;
  }

  if (!widthPt && page.originalWidth && page.originalWidth > 0) {
    widthPt = page.originalWidth;
  }
  if (!heightPt && page.originalHeight && page.originalHeight > 0) {
    heightPt = page.originalHeight;
  }

  return {
    widthPt: widthPt > 0 ? widthPt : DEFAULT_PDF_PAGE_WIDTH_PT,
    heightPt: heightPt > 0 ? heightPt : DEFAULT_PDF_PAGE_HEIGHT_PT,
  };
}

export const normalizePdfTextItem = (item: { str: string }) =>
  item.str && item.str.includes('—') ? item.str.replace(/—/g, '-') : item.str;

export interface OptimizedPDFPageProps {
  pageIndex: number;
  scale: number;
  autoFit?: boolean;
  containerWidth?: number;
  pageDimensions?: PdfPageDimensions;
  onPageDimensionsResolved?: (pageNum: number, dims: PdfPageDimensions) => void;
  isVisible: boolean;
  registerPageShell: (pageNum: number, el: HTMLDivElement | null) => void;
  approxHeightRef: React.MutableRefObject<number>;
  onDoubleClickPage: (
    pageNum: number,
    clickFraction: number,
    ptX?: number,
    ptY?: number,
    pixelX?: number,
    pixelY?: number,
  ) => void;
  clickIndicator?: SynctexHighlightState | null;
  invertColors?: boolean;
  isSpreadView?: boolean;
  onRenderTextLayer?: () => void;
}

export const OptimizedPDFPage = React.memo(function OptimizedPDFPage({
  pageIndex,
  scale,
  autoFit = true,
  containerWidth,
  pageDimensions,
  onPageDimensionsResolved,
  isVisible,
  registerPageShell,
  approxHeightRef,
  onDoubleClickPage,
  clickIndicator,
  isSpreadView = false,
  onRenderTextLayer,
}: OptimizedPDFPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const widthPt =
    pageDimensions?.widthPt && pageDimensions.widthPt > 0
      ? pageDimensions.widthPt
      : DEFAULT_PDF_PAGE_WIDTH_PT;
  const heightPt =
    pageDimensions?.heightPt && pageDimensions.heightPt > 0
      ? pageDimensions.heightPt
      : DEFAULT_PDF_PAGE_HEIGHT_PT;

  const resolvedPageDimensions = useMemo<PdfPageDimensions>(
    () => ({ widthPt, heightPt }),
    [widthPt, heightPt],
  );

  const pageNum = pageIndex + 1;
  const pageWidth =
    isSpreadView && containerWidth
      ? Math.floor((containerWidth - 8) / 2)
      : autoFit && containerWidth
        ? containerWidth
        : Math.round(widthPt * scale);

  const estimatedHeight =
    approxHeightRef.current > 0
      ? approxHeightRef.current
      : Math.round(pageWidth * (heightPt / widthPt));

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const pageHeight = rect.height;
    const clickFraction = pageHeight > 0 ? Math.max(0, Math.min(1, clickY / pageHeight)) : 0;
    const effectiveScale = rect.width > 0 ? rect.width / widthPt : (scale > 0 ? scale : 1);
    const ptX = Math.round(clickX / effectiveScale);
    const ptY = Math.round(clickY / effectiveScale);
    onDoubleClickPage(pageNum, clickFraction, ptX, ptY, clickX, clickY);
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      handleDoubleClick(e);
    }
  };

  useEffect(() => {
    if (!isVisible && containerRef.current) {
      releaseCanvasMemory(containerRef.current);
    }
  }, [isVisible]);

  useEffect(() => {
    const container = containerRef.current;
    return () => {
      registerPageShell(pageNum, null);
      releaseCanvasMemory(container);
    };
  }, [pageNum, registerPageShell]);

  const setShellRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      registerPageShell(pageNum, el);
    },
    [pageNum, registerPageShell],
  );

  const handlePageLoadSuccess = useCallback(
    (page: {
      getViewport?: (params: { scale: number }) => { width?: number; height?: number };
      view?: number[];
      originalWidth?: number;
      originalHeight?: number;
    }) => {
      if (onPageDimensionsResolved) {
        const dims = extractPageDimensionsPt(page);
        onPageDimensionsResolved(pageNum, dims);
      }
    },
    [onPageDimensionsResolved, pageNum],
  );

  return (
    <div
      ref={setShellRef}
      data-page-num={pageNum}
      data-page-label={`Page ${pageNum}`}
      onClickCapture={handleClickCapture}
      onDoubleClickCapture={handleDoubleClick}
      className={cn(
        'relative flex items-center justify-center cursor-text shrink-0',
        isVisible
          ? 'bg-canvas dark:bg-card'
          : 'bg-background/50 after:content-[attr(data-page-label)] after:text-xs after:font-mono after:font-medium after:text-muted-foreground/30 after:select-none after:pointer-events-none',
        isSpreadView ? 'my-0' : 'border-b border-border/60 last:border-b-0',
      )}
      style={{
        width: autoFit ? '100%' : pageWidth,
        maxWidth: '100%',
        minHeight: isVisible ? undefined : estimatedHeight,
        aspectRatio: isVisible ? undefined : `${widthPt} / ${heightPt}`,
      }}
    >
      {isVisible ? (
        <Page
          pageNumber={pageNum}
          width={autoFit ? pageWidth : undefined}
          scale={autoFit ? undefined : scale}
          canvasBackground="#ffffff"
          renderTextLayer
          renderAnnotationLayer
          customTextRenderer={normalizePdfTextItem}
          onLoadSuccess={handlePageLoadSuccess}
          onRenderTextLayerSuccess={onRenderTextLayer}
          devicePixelRatio={getCappedDevicePixelRatio(2)}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-canvas dark:bg-card">
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground/30 shrink-0" />
            </div>
          }
        />
      ) : null}
      {clickIndicator && clickIndicator.page === pageNum && (
        <PdfSyncTeXHighlightBox
          indicator={clickIndicator}
          pageWidth={pageWidth}
          scale={scale}
          pageDimensions={resolvedPageDimensions}
        />
      )}
    </div>
  );
});
