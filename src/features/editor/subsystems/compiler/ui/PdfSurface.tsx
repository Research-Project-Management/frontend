'use client';

/**
 * PdfSurface.tsx
 *
 * Virtualized PDF.js Render Canvas with SyncTeX Double-Click Interactivity (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/compiler/ui/PdfSurface.tsx`
 */

import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';
import {
  DEFAULT_PDF_PAGE_WIDTH_PT,
  DEFAULT_PDF_PAGE_HEIGHT_PT,
  type PdfPageDimensions,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import { cn } from '@/shared/lib/utils';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { useViewerStore } from '@/features/editor/subsystems/compiler/coordinator/viewer.store';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  setupPdfWorker,
  getSharedPdfDocumentOptions,
  getCappedDevicePixelRatio,
} from '@/shared/lib/pdfjs-worker';
import {
  PdfSyncTeXHighlightBox,
  type SynctexHighlightState,
  type ClickIndicator,
  type PdfSyncTeXHighlightBoxProps,
} from './PdfSyncTeXHighlightBox';
import {
  OptimizedPDFPage,
  extractPageDimensionsPt,
  normalizePdfTextItem,
} from './OptimizedPdfPage';
import { usePdfViewportVirtualizer } from './hooks/usePdfViewportVirtualizer';

if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
}
setupPdfWorker();

export {
  PdfSyncTeXHighlightBox,
  type PdfPageDimensions,
  type SynctexHighlightState,
  type ClickIndicator,
  type PdfSyncTeXHighlightBoxProps,
};

export interface PdfSurfaceHandle {
  scrollToPage: (pageNum: number) => void;
  scrollToCoords?: (page: number, y: number, behavior?: ScrollBehavior) => void;
  highlightTarget?: (page: number, x: number, y: number, w?: number, h?: number) => void;
  clearHighlight?: () => void;
  getContainer: () => HTMLDivElement | null;
}

interface PdfSurfaceProps {
  pdfUrl: string | null;
  synctexMap: SyncTeXMap | null;
  scale: number;
  autoFit?: boolean;
  containerWidth?: number;
  pageDimensions?: PdfPageDimensions;
  onPageDimensionsChange?: (dims: PdfPageDimensions) => void;
  scrollMode?: boolean;
  pageNumber?: number;
  numPages: number;
  compileStatus: string;
  onPageNumberChange?: (page: number) => void;
  onNumPagesChange?: (num: number) => void;
  onDocumentLoadSuccess?: (pdf: { numPages: number }) => void;
  onJumpToSource?: (
    file: string | null,
    line: number,
    pageNum?: number,
    x?: number,
    y?: number,
  ) => void;
  onCompile?: () => void;
  invertColors?: boolean;
  isSpreadView?: boolean;
  onScroll?: (info: { page: number; y: number; fraction: number }) => void;
  onRenderTextLayer?: () => void;
}

export const PdfSurface = React.memo(forwardRef<PdfSurfaceHandle, PdfSurfaceProps>(function PdfSurface(
  {
    pdfUrl,
    synctexMap,
    scale,
    autoFit = true,
    containerWidth,
    pageDimensions: externalPageDimensions,
    onPageDimensionsChange,
    scrollMode = true,
    pageNumber,
    numPages,
    onNumPagesChange,
    onDocumentLoadSuccess: parentOnLoadSuccess,
    onJumpToSource,
    invertColors = false,
    isSpreadView = false,
    onScroll,
    onRenderTextLayer,
  },
  ref,
) {
  setupPdfWorker();

  const [clickIndicator, setClickIndicator] = useState<SynctexHighlightState | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [defaultPageDimensions, setDefaultPageDimensions] = useState<PdfPageDimensions>({
    widthPt: DEFAULT_PDF_PAGE_WIDTH_PT,
    heightPt: DEFAULT_PDF_PAGE_HEIGHT_PT,
  });
  const [perPageDimensions, setPerPageDimensions] = useState<Record<number, PdfPageDimensions>>({});

  const extWidthPt = externalPageDimensions?.widthPt;
  const extHeightPt = externalPageDimensions?.heightPt;
  const defWidthPt = defaultPageDimensions.widthPt;
  const defHeightPt = defaultPageDimensions.heightPt;

  const effectiveDefaultDimensions = useMemo<PdfPageDimensions>(() => {
    const w = extWidthPt && extWidthPt > 0 ? extWidthPt : defWidthPt;
    const h = extHeightPt && extHeightPt > 0 ? extHeightPt : defHeightPt;
    return { widthPt: w, heightPt: h };
  }, [extWidthPt, extHeightPt, defWidthPt, defHeightPt]);

  const handlePageDimensionsResolved = useCallback(
    (pageNum: number, dims: PdfPageDimensions) => {
      setPerPageDimensions((prev) => {
        const existing = prev[pageNum];
        if (existing && existing.widthPt === dims.widthPt && existing.heightPt === dims.heightPt) {
          return prev;
        }
        return { ...prev, [pageNum]: dims };
      });
      if (pageNum === 1) {
        setDefaultPageDimensions((prev) => {
          if (prev.widthPt === dims.widthPt && prev.heightPt === dims.heightPt) {
            return prev;
          }
          return dims;
        });
        onPageDimensionsChange?.(dims);
      }
    },
    [onPageDimensionsChange],
  );

  useEffect(() => {
    setupPdfWorker();
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const documentOptions = useMemo(
    () => getSharedPdfDocumentOptions(pdfjs.version || '5.4.296'),
    [],
  );

  const effectivePageNumber = pageNumber ?? useViewerStore.getState().pageNumber ?? 1;

  const {
    scrollContainerRef,
    pageElemRefs,
    approxHeightRef,
    docLoadError,
    currentContainerWidth,
    inWindowPages,
    pagePairs,
    registerPageShell,
    pinTargetPage,
    handleContainerScroll,
    handleDocumentLoadSuccess,
    handleDocumentLoadError,
  } = usePdfViewportVirtualizer({
    pdfUrl,
    numPages,
    scrollMode,
    isSpreadView,
    containerWidth,
    effectivePageNumber,
    scale,
    perPageDimensions,
    effectiveDefaultDimensions,
    onScroll,
    onNumPagesChange,
    onDocumentLoadSuccess: parentOnLoadSuccess,
    onPageDimensionsResolved: handlePageDimensionsResolved,
  });

  const triggerClickIndicator = useCallback(
    (
      page: number,
      x: number,
      y: number,
      w?: number,
      h?: number,
      type: 'forward' | 'backward' = 'backward',
    ) => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      setClickIndicator({ page, x, y, w, h, id: Date.now(), type });
      clickTimerRef.current = setTimeout(() => {
        setClickIndicator(null);
      }, 1900);
    },
    [],
  );

  useImperativeHandle(ref, () => ({
    scrollToPage(pageNum: number) {
      pinTargetPage(pageNum);
      const el = pageElemRefs.current[pageNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    scrollToCoords(page: number, y: number, behavior: ScrollBehavior = 'smooth') {
      pinTargetPage(page);
      const el = pageElemRefs.current[page];
      if (el) {
        const container = scrollContainerRef.current;
        if (container) {
          const elTop = el.offsetTop;
          const targetScrollTop = Math.max(0, elTop + y - container.clientHeight / 4);
          container.scrollTo({ top: targetScrollTop, behavior });
        } else {
          el.scrollIntoView({ behavior, block: 'center' });
        }
      }
    },
    highlightTarget(page: number, x: number, y: number, w?: number, h?: number) {
      pinTargetPage(page);
      triggerClickIndicator(page, x, y, w, h, 'forward');
      const el = pageElemRefs.current[page];
      if (el) {
        const container = scrollContainerRef.current;
        if (container) {
          const elTop = el.offsetTop;
          const targetScrollTop = Math.max(0, elTop + y - container.clientHeight / 3);
          container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },
    clearHighlight() {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      setClickIndicator(null);
    },
    getContainer() {
      return scrollContainerRef.current;
    },
  }));

  const handleDoubleClickPage = useCallback(
    (
      pageNum: number,
      clickFraction: number,
      ptX?: number,
      ptY?: number,
      _pixelX?: number,
      _pixelY?: number,
    ) => {
      if (!onJumpToSource) return;
      const pageDims = perPageDimensions[pageNum] || effectiveDefaultDimensions;
      const heightPt = pageDims.heightPt > 0 ? pageDims.heightPt : DEFAULT_PDF_PAGE_HEIGHT_PT;
      const resolved = compilerCoordinator.resolveReverse(
        clickFraction,
        pageNum,
        ptX,
        ptY,
        synctexMap,
        heightPt,
      );
      onJumpToSource(
        resolved?.sourcePath ?? null,
        resolved?.line ?? 1,
        pageNum,
        ptX,
        ptY,
      );
    },
    [onJumpToSource, synctexMap, perPageDimensions, effectiveDefaultDimensions],
  );

  const singlePageDims = perPageDimensions[effectivePageNumber] || effectiveDefaultDimensions;
  const singlePageWidthPt = singlePageDims.widthPt > 0 ? singlePageDims.widthPt : DEFAULT_PDF_PAGE_WIDTH_PT;

  return (
    <div
      ref={scrollContainerRef}
      role="region"
      aria-label="PDF document preview"
      onScroll={handleContainerScroll}
      className={cn(
        'flex-1 h-full min-h-0 overflow-y-auto pb-6 flex flex-col items-center justify-start select-text relative transition-colors duration-200 thin-scrollbar',
        autoFit ? 'overflow-x-hidden' : 'overflow-x-auto',
        invertColors ? 'dark bg-background text-foreground' : 'bg-canvas text-foreground',
      )}
    >
      {!pdfUrl ? (
        <PlaneEmptyState
          variant="preview"
          className={invertColors ? 'dark bg-background text-foreground' : undefined}
        />
      ) : (
        <Document
          file={pdfUrl}
          options={documentOptions}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={handleDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-8 animate-spin motion-reduce:animate-none text-primary shrink-0" />
            </div>
          }
          error={
            <PlaneErrorState
              title="Failed to load PDF file"
              description="An issue occurred while rendering the compiled document canvas."
              error={docLoadError ?? new Error('The compiled PDF document could not be decoded by the viewer engine.')}
            />
          }
        >
          {scrollMode ? (
            isSpreadView ? (
              <div
                className="flex flex-col gap-[10px] py-[10px] transition-[filter] duration-200 items-center w-full"
                style={invertColors ? { filter: 'invert(0.9) hue-rotate(180deg) contrast(1.25)' } : undefined}
              >
                {pagePairs.map((pair: number[], rowIdx: number) => (
                  <div
                    key={`spread_row_${rowIdx}`}
                    className="flex flex-row justify-center gap-[10px] w-full"
                  >
                    {pair.map((pageIdx: number) => (
                      <OptimizedPDFPage
                        key={`page_${pageIdx + 1}`}
                        pageIndex={pageIdx}
                        scale={scale}
                        autoFit={autoFit}
                        containerWidth={currentContainerWidth}
                        pageDimensions={perPageDimensions[pageIdx + 1] || effectiveDefaultDimensions}
                        onPageDimensionsResolved={handlePageDimensionsResolved}
                        isSpreadView={true}
                        isVisible={inWindowPages.has(pageIdx + 1)}
                        registerPageShell={registerPageShell}
                        approxHeightRef={approxHeightRef}
                        onDoubleClickPage={handleDoubleClickPage}
                        clickIndicator={clickIndicator?.page === pageIdx + 1 ? clickIndicator : null}
                        onRenderTextLayer={onRenderTextLayer}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="flex flex-col gap-[10px] py-[10px] transition-[filter] duration-200 w-full items-center"
                style={invertColors ? { filter: 'invert(0.9) hue-rotate(180deg) contrast(1.25)' } : undefined}
              >
                {Array.from({ length: numPages }, (_, i) => (
                  <OptimizedPDFPage
                    key={`page_${i + 1}`}
                    pageIndex={i}
                    scale={scale}
                    autoFit={autoFit}
                    containerWidth={currentContainerWidth}
                    pageDimensions={perPageDimensions[i + 1] || effectiveDefaultDimensions}
                    onPageDimensionsResolved={handlePageDimensionsResolved}
                    isSpreadView={false}
                    isVisible={inWindowPages.has(i + 1)}
                    registerPageShell={registerPageShell}
                    approxHeightRef={approxHeightRef}
                    onDoubleClickPage={handleDoubleClickPage}
                    clickIndicator={clickIndicator?.page === i + 1 ? clickIndicator : null}
                    onRenderTextLayer={onRenderTextLayer}
                  />
                ))}
              </div>
            )
          ) : (
            <div
              data-page-num={effectivePageNumber}
              ref={(el) => {
                pageElemRefs.current[effectivePageNumber] = el;
              }}
              onDoubleClickCapture={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const pageHeight = rect.height;
                const clickFraction = pageHeight > 0 ? Math.max(0, Math.min(1, clickY / pageHeight)) : 0;
                const effectiveScale = rect.width > 0 ? rect.width / singlePageWidthPt : (scale > 0 ? scale : 1);
                const ptX = Math.round(clickX / effectiveScale);
                const ptY = Math.round(clickY / effectiveScale);
                handleDoubleClickPage(effectivePageNumber, clickFraction, ptX, ptY, clickX, clickY);
              }}
              className={cn(
                'bg-canvas dark:bg-card relative flex items-center justify-center cursor-text transition-[filter] duration-200 shrink-0',
              )}
              style={invertColors ? { filter: 'invert(0.9) hue-rotate(180deg) contrast(1.25)' } : undefined}
            >
              <Page
                pageNumber={effectivePageNumber}
                width={autoFit ? currentContainerWidth : undefined}
                scale={autoFit ? undefined : scale}
                className=""
                renderTextLayer
                renderAnnotationLayer
                customTextRenderer={normalizePdfTextItem}
                onLoadSuccess={(page) => {
                  const dims = extractPageDimensionsPt(page);
                  handlePageDimensionsResolved(effectivePageNumber, dims);
                }}
                onRenderTextLayerSuccess={onRenderTextLayer}
                devicePixelRatio={getCappedDevicePixelRatio(2)}
              />
              {clickIndicator && clickIndicator.page === effectivePageNumber && (
                <PdfSyncTeXHighlightBox
                  indicator={clickIndicator}
                  pageWidth={autoFit ? currentContainerWidth : Math.round(singlePageWidthPt * scale)}
                  scale={scale}
                  pageDimensions={singlePageDims}
                />
              )}
            </div>
          )}
        </Document>
      )}
    </div>
  );
}));

export default PdfSurface;
