'use client';

/**
 * PdfSurface.tsx
 *
 * Virtualized PDF.js Render Canvas with SyncTeX Double-Click Interactivity (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PdfSurface.tsx`
 *
 * Capabilities:
 * - Single-page & multi-page continuous vertical virtualized scrolling.
 * - Spread two-page side-by-side view.
 * - SyncTeX forward & inverse jump (double-click to navigate back to exact line in LaTeX source).
 * - Animated radar target marker for visual jump feedback.
 * - High-DPI canvas scaling with devicePixelRatio awareness.
 * - Invert colors / dark preview mode for eye comfort.
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
import { useIntersectionObserver } from "@/shared/hooks/use-intersection-observer";
import { logger, cn } from "@/shared/lib/utils";
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { useViewerStore } from '@/features/editor/subsystems/compiler/coordinator/viewer.store';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  setupPdfWorker,
  getSharedPdfDocumentOptions,
  getCappedDevicePixelRatio,
  releaseCanvasMemory,
} from '@/shared/lib/pdfjs-worker';

// Ensure PDF.js worker is registered with absolute origin URL
setupPdfWorker();

export type { PdfPageDimensions };

function extractPageDimensionsPt(page: {
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

// ── Optimized PDF Page with IntersectionObserver ──────────────────────────────

export interface SynctexHighlightState {
  page: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  id: number;
  type?: 'forward' | 'backward';
}

export type ClickIndicator = SynctexHighlightState;

export interface PdfSyncTeXHighlightBoxProps {
  indicator: SynctexHighlightState;
  pageWidth: number;
  scale: number;
  pageDimensions?: PdfPageDimensions;
}

export const PdfSyncTeXHighlightBox = React.memo(function PdfSyncTeXHighlightBox({
  indicator,
  pageWidth,
  scale,
  pageDimensions,
}: PdfSyncTeXHighlightBoxProps) {
  const isForward = indicator.type === 'forward' || (indicator.w !== undefined && indicator.h !== undefined);

  if (isForward) {
    const widthPt =
      pageDimensions?.widthPt && pageDimensions.widthPt > 0
        ? pageDimensions.widthPt
        : DEFAULT_PDF_PAGE_WIDTH_PT;
    const effectivePageWidth = pageWidth > 0 ? pageWidth : Math.round(widthPt * (scale > 0 ? scale : 1));
    const left = Math.max(8, indicator.x - 4);
    const width =
      indicator.w !== undefined && indicator.w > 0
        ? Math.max(indicator.w + 8, 48)
        : Math.max(160, Math.min(effectivePageWidth - left - 24, 480));
    const rawH =
      indicator.h !== undefined && indicator.h > 0
        ? indicator.h
        : Math.max(14 * (scale > 0 ? scale : 1), 14);
    const height = Math.max(rawH + 6, 16);
    // In SyncTeX, y is the text baseline measured from the top of the page, while glyphs extend upward by ascent (~0.8 * rawH)
    const top = Math.max(0, indicator.y - rawH * 0.8);

    return (
      <div
        key={indicator.id}
        data-testid="synctex-pdf-highlight-box"
        role="presentation"
        aria-hidden="true"
        className="synctex-pdf-highlight-box pointer-events-none"
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Left Accent Indicator / Baseline Pin (Overleaf Parity) */}
        <div
          data-testid="synctex-pdf-accent-bar"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-4/5 max-h-5 rounded-full bg-warning shadow-none"
        />
      </div>
    );
  }

  return (
    <div
      key={indicator.id}
      data-testid="synctex-pdf-backward-ripple"
      role="presentation"
      aria-hidden="true"
      className="pointer-events-none absolute z-30 transition-opacity duration-300"
      style={{
        left: `${indicator.x}px`,
        top: `${indicator.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <span className="relative flex size-9 items-center justify-center">
        <span className="absolute inline-flex size-full rounded-full bg-primary/60 opacity-80" />
        <span className="absolute inline-flex size-6 rounded-full border-2 border-primary bg-primary/20" />
        <span className="relative inline-flex size-2 rounded-full bg-primary" />
      </span>
    </div>
  );
});

interface OptimizedPDFPageProps {
  pageIndex: number; // 0-based
  scale: number;
  autoFit?: boolean;
  containerWidth?: number;
  pageDimensions?: PdfPageDimensions;
  onPageDimensionsResolved?: (pageNum: number, dims: PdfPageDimensions) => void;
  pageElemRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
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

const normalizePdfTextItem = (item: { str: string }) =>
  item.str && item.str.includes('—') ? item.str.replace(/—/g, '-') : item.str;

const OptimizedPDFPage = React.memo(function OptimizedPDFPage({
  pageIndex,
  scale,
  autoFit = true,
  containerWidth,
  pageDimensions,
  onPageDimensionsResolved,
  pageElemRefs,
  approxHeightRef,
  onDoubleClickPage,
  clickIndicator,
  invertColors = false,
  isSpreadView = false,
  onRenderTextLayer,
}: OptimizedPDFPageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { isIntersecting: isVisible } = useIntersectionObserver(containerRef, {
    rootMargin: '450px 0px 450px 0px',
    threshold: 0.01,
    onChange: (entry) => {
      if (entry.isIntersecting && entry.boundingClientRect.height > 0) {
        approxHeightRef.current = entry.boundingClientRect.height;
      }
    },
  });

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
  const pageWidth = isSpreadView && containerWidth
    ? Math.floor((containerWidth - 8) / 2)
    : (autoFit && containerWidth
        ? containerWidth
        : Math.round(widthPt * scale));

  const estimatedHeight = approxHeightRef.current > 0
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
    const pageRefs = pageElemRefs.current;
    const container = containerRef.current;
    return () => {
      // 1. Clean up stale DOM node reference from parent registry
      delete pageRefs[pageNum];

      // 2. Explicitly release GPU canvas pixel buffers
      releaseCanvasMemory(container);
    };
  }, [pageNum, pageElemRefs]);

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (el) {
          pageElemRefs.current[pageNum] = el;
        } else {
          delete pageElemRefs.current[pageNum];
        }
      }}
      onClickCapture={handleClickCapture}
      onDoubleClickCapture={handleDoubleClick}
      className={cn(
        "bg-canvas dark:bg-card relative flex items-center justify-center cursor-text shrink-0",
        isSpreadView ? "my-0" : "border-b border-border/60 last:border-b-0"
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
          width={autoFit ? containerWidth : undefined}
          scale={autoFit ? undefined : scale}
          renderTextLayer
          renderAnnotationLayer
          customTextRenderer={normalizePdfTextItem}
          onLoadSuccess={(page) => {
            if (onPageDimensionsResolved) {
              const dims = extractPageDimensionsPt(page);
              onPageDimensionsResolved(pageNum, dims);
            }
          }}
          onRenderTextLayerSuccess={onRenderTextLayer}
          devicePixelRatio={getCappedDevicePixelRatio(2)}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-canvas dark:bg-card">
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground/30 shrink-0" />
            </div>
          }
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-muted-foreground/30 select-none">
          <span className="text-xs font-mono font-medium">Page {pageNum}</span>
        </div>
      )}
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

// ── Surface Imperative Handle ─────────────────────────────────────────────────

export interface PdfSurfaceHandle {
  scrollToPage: (pageNum: number) => void;
  scrollToCoords?: (page: number, y: number, behavior?: ScrollBehavior) => void;
  highlightTarget?: (page: number, x: number, y: number, w?: number, h?: number) => void;
  clearHighlight?: () => void;
  getContainer: () => HTMLDivElement | null;
}

// ── Surface Props ─────────────────────────────────────────────────────────────

export interface PdfSurfaceProps {
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
    compileStatus,
    onPageNumberChange,
    onNumPagesChange,
    onDocumentLoadSuccess: parentOnLoadSuccess,
    onJumpToSource,
    onCompile,
    invertColors = false,
    isSpreadView = false,
    onScroll,
    onRenderTextLayer,
  },
  ref,
) {
  // Guarantee workerSrc is initialized before <Document> mounts
  setupPdfWorker();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const approxHeightRef = useRef<number>(0);
  const [clickIndicator, setClickIndicator] = useState<SynctexHighlightState | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [docLoadError, setDocLoadError] = useState<Error | null>(null);
  const [defaultPageDimensions, setDefaultPageDimensions] = useState<PdfPageDimensions>({
    widthPt: DEFAULT_PDF_PAGE_WIDTH_PT,
    heightPt: DEFAULT_PDF_PAGE_HEIGHT_PT,
  });
  const [perPageDimensions, setPerPageDimensions] = useState<Record<number, PdfPageDimensions>>({});

  const effectiveDefaultDimensions = useMemo<PdfPageDimensions>(() => {
    const w = externalPageDimensions?.widthPt && externalPageDimensions.widthPt > 0
      ? externalPageDimensions.widthPt
      : defaultPageDimensions.widthPt;
    const h = externalPageDimensions?.heightPt && externalPageDimensions.heightPt > 0
      ? externalPageDimensions.heightPt
      : defaultPageDimensions.heightPt;
    return { widthPt: w, heightPt: h };
  }, [externalPageDimensions, defaultPageDimensions]);

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
  }, []);

  const documentOptions = useMemo(
    () => getSharedPdfDocumentOptions(pdfjs.version || '5.4.296'),
    [],
  );

  const scrollRafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const isRestoringScrollRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  useEffect(() => {
    setDocLoadError(null);
    if (lastScrollTopRef.current > 0) {
      isRestoringScrollRef.current = true;
    }
  }, [pdfUrl]);

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

  const pagePairs = useMemo(() => {
    if (!isSpreadView) return [];
    const pairs: number[][] = [];
    for (let i = 0; i < numPages; i += 2) {
      if (i + 1 < numPages) {
        pairs.push([i, i + 1]);
      } else {
        pairs.push([i]);
      }
    }
    return pairs;
  }, [numPages, isSpreadView]);

  // Expose container, scrollToPage, scrollToCoords, and target highlighting via ref
  useImperativeHandle(ref, () => ({
    scrollToPage(pageNum: number) {
      const el = pageElemRefs.current[pageNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    scrollToCoords(page: number, y: number, behavior: ScrollBehavior = 'smooth') {
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

  const handleContainerScroll = useCallback(() => {
    if (
      !isRestoringScrollRef.current &&
      scrollContainerRef.current &&
      scrollContainerRef.current.scrollTop > 0
    ) {
      lastScrollTopRef.current = scrollContainerRef.current.scrollTop;
    }
    if (!onScroll) return;
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = scrollContainerRef.current;
      if (!container) return;
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const scrollFocus = containerTop + containerHeight / 4;

      let low = 1;
      let high = numPages;
      let candidatePage = 1;

      while (low <= high) {
        const mid = (low + high) >>> 1;
        const midEl = pageElemRefs.current[mid];
        if (!midEl) {
          break;
        }
        if (midEl.offsetTop <= scrollFocus) {
          candidatePage = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      // Check candidatePage first (O(1) in sorted vertical layout), fallback to linear scan if refs are sparse
      const checkPage = (p: number): boolean => {
        const el = pageElemRefs.current[p];
        if (!el) return false;
        const elTop = el.offsetTop;
        const elHeight = el.offsetHeight;
        if (scrollFocus >= elTop && scrollFocus <= elTop + elHeight) {
          const relativeY = scrollFocus - elTop;
          const pageDims = perPageDimensions[p] || effectiveDefaultDimensions;
          const widthPt = pageDims.widthPt > 0 ? pageDims.widthPt : DEFAULT_PDF_PAGE_WIDTH_PT;
          const effectiveScale = el.offsetWidth > 0 ? el.offsetWidth / widthPt : (scale > 0 ? scale : 1);
          const ptY = relativeY / effectiveScale;
          const fraction = elHeight > 0 ? relativeY / elHeight : 0;
          onScroll({ page: p, y: ptY, fraction });
          return true;
        }
        return false;
      };

      if (!checkPage(candidatePage) && !checkPage(candidatePage + 1)) {
        for (let p = 1; p <= numPages; p++) {
          const el = pageElemRefs.current[p];
          if (el && el.offsetTop > scrollFocus) break;
          if (checkPage(p)) break;
        }
      }
    });
  }, [onScroll, numPages, scale, perPageDimensions, effectiveDefaultDimensions]);

  const handleDocumentLoadSuccess = useCallback((pdf: {
    numPages: number;
    getPage?: (pageNum: number) => Promise<{
      getViewport?: (params: { scale: number }) => { width?: number; height?: number };
      view?: number[];
      originalWidth?: number;
      originalHeight?: number;
    }>;
  }) => {
    const savedTop = lastScrollTopRef.current;
    if (typeof pdf.getPage === 'function' && pdf.numPages >= 1) {
      Promise.resolve(pdf.getPage(1))
        .then((page) => {
          if (page) {
            const dims = extractPageDimensionsPt(page);
            handlePageDimensionsResolved(1, dims);
            (page as { cleanup?: () => void })?.cleanup?.();
          }
        })
        .catch(() => {
          // ignore and rely on Page onLoadSuccess or default A4
        });
    }
    queueMicrotask(() => {
      setDocLoadError(null);
      onNumPagesChange?.(pdf.numPages);
      parentOnLoadSuccess?.(pdf);

      // Overleaf Parity: Restore scroll position across recompiles after React mounts page placeholders
      if (savedTop > 0) {
        const restoreScroll = () => {
          if (scrollContainerRef.current && scrollContainerRef.current.scrollHeight > savedTop) {
            scrollContainerRef.current.scrollTop = savedTop;
            lastScrollTopRef.current = savedTop;
            isRestoringScrollRef.current = false;
          }
        };
        requestAnimationFrame(() => {
          restoreScroll();
          requestAnimationFrame(restoreScroll);
        });
        setTimeout(() => {
          restoreScroll();
          isRestoringScrollRef.current = false;
        }, 120);
      } else {
        isRestoringScrollRef.current = false;
      }
    });
  }, [onNumPagesChange, parentOnLoadSuccess, handlePageDimensionsResolved]);

  const handleDocumentLoadError = useCallback((error: unknown) => {
    logger.warn('[Surface] Document load error', { error });
    queueMicrotask(() => {
      setDocLoadError(
        error instanceof Error
          ? error
          : new Error(
              typeof error === 'object' && error !== null && 'message' in error
                ? String((error as { message: unknown }).message)
                : 'The compiled PDF document could not be decoded by the viewer engine.',
            ),
      );
    });
  }, []);

  // SyncTeX inverse search (PDF double-click -> LaTeX source jump)
  const handleDoubleClickPage = useCallback((
    pageNum: number,
    clickFraction: number,
    ptX?: number,
    ptY?: number,
    pixelX?: number,
    pixelY?: number,
  ) => {
    if (pixelX !== undefined && pixelY !== undefined) {
      triggerClickIndicator(pageNum, pixelX, pixelY, undefined, undefined, 'backward');
    }
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
  }, [triggerClickIndicator, onJumpToSource, synctexMap, perPageDimensions, effectiveDefaultDimensions]);

  const [containerWidthState, setContainerWidthState] = useState<number>(0);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const updateWidth = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (el.clientWidth > 0) {
          setContainerWidthState((prev) => {
            // 2px deadband prevents layout thrashing during panel dragging
            return Math.abs(prev - el.clientWidth) >= 2 ? el.clientWidth : prev;
          });
        }
      });
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      ro.disconnect();
    };
  }, []);

  const currentContainerWidth =
    containerWidthState || containerWidth || scrollContainerRef.current?.clientWidth || 600;

  const effectivePageNumber = pageNumber ?? useViewerStore.getState().pageNumber ?? 1;
  const singlePageDims = perPageDimensions[effectivePageNumber] || effectiveDefaultDimensions;
  const singlePageWidthPt = singlePageDims.widthPt > 0 ? singlePageDims.widthPt : DEFAULT_PDF_PAGE_WIDTH_PT;

  return (
    <div
      ref={scrollContainerRef}
      role="region"
      aria-label="PDF document preview"
      onScroll={handleContainerScroll}
      className={cn(
        "flex-1 h-full min-h-0 overflow-y-auto flex flex-col items-center justify-start select-text relative transition-colors duration-200 thin-scrollbar",
        autoFit ? "overflow-x-hidden" : "overflow-x-auto",
        invertColors ? "dark bg-background text-foreground" : "bg-canvas text-foreground"
      )}
    >
      {!pdfUrl ? (
        <PlaneEmptyState
          variant="preview"
          className={invertColors ? "dark bg-background text-foreground" : undefined}
        />
      ) : (
        /* PDF Document Canvas */
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
                className="flex flex-col gap-3 transition-[filter] duration-200 items-center w-full"
                style={invertColors ? { filter: 'invert(0.9) hue-rotate(180deg) contrast(1.25)' } : undefined}
              >
                {pagePairs.map((pair: number[], rowIdx: number) => (
                  <div
                    key={`spread_row_${rowIdx}`}
                    className="flex flex-row justify-center gap-3 w-full"
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
                        pageElemRefs={pageElemRefs}
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
                className="flex flex-col transition-[filter] duration-200 w-full items-center"
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
                    pageElemRefs={pageElemRefs}
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
                "bg-canvas dark:bg-card relative flex items-center justify-center cursor-text transition-[filter] duration-200 shrink-0"
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
