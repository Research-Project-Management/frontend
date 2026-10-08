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
import { LatexCompilerEngine } from '@/features/editor/coordinators/services/latex-compiler-engine.service';
import type { SyncTeXMap } from '@/features/editor/domain';
import { compilerCoordinator } from '@/features/editor/coordinators/compiler.coordinator';
import { useIntersectionObserver } from "@/shared/hooks";
import { logger, cn } from "@/shared/lib/utils";
import { PlaneErrorState, PlaneEmptyState } from '@/shared/components/ui';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Official React-PDF standard: configure workerSrc directly in the module where <Document> is rendered
if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
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
}

export const PdfSyncTeXHighlightBox = React.memo(function PdfSyncTeXHighlightBox({
  indicator,
  pageWidth,
  scale,
}: PdfSyncTeXHighlightBoxProps) {
  const isForward = indicator.type === 'forward' || (indicator.w !== undefined && indicator.h !== undefined);

  if (isForward) {
    const left = Math.max(8, indicator.x - 4);
    const width =
      indicator.w !== undefined && indicator.w > 0
        ? Math.max(indicator.w + 8, 48)
        : Math.max(160, Math.min(pageWidth - left - 24, 480));
    const height =
      indicator.h !== undefined && indicator.h > 0
        ? Math.max(indicator.h + 4, 16)
        : Math.max(18 * (scale > 0 ? scale : 1), 18);

    return (
      <div
        key={indicator.id}
        data-testid="synctex-pdf-highlight-box"
        role="presentation"
        aria-hidden="true"
        className="synctex-pdf-highlight-box pointer-events-none"
        style={{
          left: `${left}px`,
          top: `${indicator.y}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        {/* Left Accent Indicator / Baseline Pin (Overleaf Parity) */}
        <div
          data-testid="synctex-pdf-accent-bar"
          className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-4/5 max-h-5 rounded-full bg-amber-500 dark:bg-amber-400 shadow-sm"
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
        <span className="absolute inline-flex size-full animate-ping motion-reduce:animate-none rounded-full bg-primary/60 opacity-80" />
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
}

const OptimizedPDFPage = React.memo(function OptimizedPDFPage({
  pageIndex,
  scale,
  autoFit = true,
  containerWidth,
  pageElemRefs,
  approxHeightRef,
  onDoubleClickPage,
  clickIndicator,
  invertColors = false,
  isSpreadView = false,
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

  const pageNum = pageIndex + 1;
  const pageWidth = isSpreadView && containerWidth
    ? Math.floor((containerWidth - 8) / 2)
    : (autoFit && containerWidth
        ? containerWidth
        : Math.round(595 * scale));

  const estimatedHeight = approxHeightRef.current > 0
    ? approxHeightRef.current
    : Math.round(pageWidth * (842 / 595));

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const pageHeight = rect.height;
    const clickFraction = pageHeight > 0 ? Math.max(0, Math.min(1, clickY / pageHeight)) : 0;
    const effectiveScale = rect.width > 0 ? rect.width / 595 : (scale > 0 ? scale : 1);
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

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        pageElemRefs.current[pageNum] = el;
      }}
      onClickCapture={handleClickCapture}
      onDoubleClickCapture={handleDoubleClick}
      title="Double-click or Ctrl/Cmd+Click to jump to LaTeX source (SyncTeX)"
      className={cn(
        "bg-canvas dark:bg-card relative flex items-center justify-center cursor-text transition-all shrink-0",
        isSpreadView ? "my-0" : "border-b border-border/60 last:border-b-0"
      )}
      style={{
        width: autoFit ? '100%' : pageWidth,
        maxWidth: '100%',
        minHeight: isVisible ? undefined : estimatedHeight,
        aspectRatio: isVisible ? undefined : '595 / 842',
      }}
    >
      {isVisible ? (
        <Page
          pageNumber={pageNum}
          width={autoFit ? containerWidth : undefined}
          scale={autoFit ? undefined : scale}
          renderTextLayer
          renderAnnotationLayer
          onRenderTextLayerSuccess={() => {
            if (containerRef.current) {
              const textLayers = containerRef.current.querySelectorAll('.textLayer, .react-pdf__Page__textContent');
              textLayers.forEach((tl) => {
                tl.querySelectorAll('span').forEach((span) => {
                  if (span.textContent && span.textContent.includes('—')) {
                    span.textContent = span.textContent.replace(/—/g, '-');
                  }
                });
              });
            }
          }}
          devicePixelRatio={typeof window !== 'undefined' ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-canvas dark:bg-card">
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none text-muted-foreground/30 shrink-0" />
            </div>
          }
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-muted-foreground/30 select-none animate-pulse motion-reduce:animate-none">
          <span className="text-xs font-mono font-medium">Page {pageNum}</span>
        </div>
      )}
      {clickIndicator && clickIndicator.page === pageNum && (
        <PdfSyncTeXHighlightBox
          indicator={clickIndicator}
          pageWidth={pageWidth}
          scale={scale}
        />
      )}
    </div>
  );
});

// ── Surface Imperative Handle ─────────────────────────────────────────────────

export interface SurfaceHandle {
  scrollToPage: (pageNum: number) => void;
  scrollToCoords?: (page: number, y: number, behavior?: ScrollBehavior) => void;
  highlightTarget?: (page: number, x: number, y: number, w?: number, h?: number) => void;
  clearHighlight?: () => void;
  getContainer: () => HTMLDivElement | null;
}

export type PdfSurfaceHandle = SurfaceHandle;

// ── Surface Props ─────────────────────────────────────────────────────────────

export interface SurfaceProps {
  pdfUrl: string | null;
  synctexMap: SyncTeXMap | null;
  scale: number;
  autoFit?: boolean;
  containerWidth?: number;
  scrollMode?: boolean;
  pageNumber: number;
  numPages: number;
  compileStatus: string;
  onPageNumberChange?: (page: number) => void;
  onNumPagesChange?: (num: number) => void;
  onDocumentLoadSuccess?: (pdf: any) => void;
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
}

export type PdfSurfaceProps = SurfaceProps;

export const Surface = React.memo(forwardRef<SurfaceHandle, SurfaceProps>(function Surface(
  {
    pdfUrl,
    synctexMap,
    scale,
    autoFit = true,
    containerWidth,
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
  },
  ref,
) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const approxHeightRef = useRef<number>(0);
  const [clickIndicator, setClickIndicator] = useState<SynctexHighlightState | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [docLoadError, setDocLoadError] = useState<Error | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
  }, []);

  const documentOptions = useMemo(
    () => ({
      cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/cmaps/',
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/standard_fonts/',
    }),
    [],
  );

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setDocLoadError(null);
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
    if (!onScroll) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const containerTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const scrollFocus = containerTop + containerHeight / 4;

    for (let p = 1; p <= numPages; p++) {
      const el = pageElemRefs.current[p];
      if (el) {
        const elTop = el.offsetTop;
        const elHeight = el.offsetHeight;
        if (scrollFocus >= elTop && scrollFocus <= elTop + elHeight) {
          const relativeY = scrollFocus - elTop;
          const effectiveScale = el.offsetWidth > 0 ? el.offsetWidth / 595 : (scale > 0 ? scale : 1);
          const ptY = relativeY / effectiveScale;
          const fraction = elHeight > 0 ? relativeY / elHeight : 0;
          onScroll({ page: p, y: ptY, fraction });
          break;
        }
      }
    }
  }, [onScroll, numPages, scale]);

  const handleDocumentLoadSuccess = useCallback((pdf: any) => {
    queueMicrotask(() => {
      setDocLoadError(null);
      onNumPagesChange?.(pdf.numPages);
      parentOnLoadSuccess?.(pdf);
    });
  }, [onNumPagesChange, parentOnLoadSuccess]);

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
    const effectiveMap = synctexMap || compilerCoordinator.getSynctexMap();
    const resolved = effectiveMap
      ? LatexCompilerEngine.resolveReverse(clickFraction, pageNum, effectiveMap, ptX, ptY)
      : null;
    onJumpToSource(
      resolved?.sourcePath ?? null,
      resolved?.line ?? 1,
      pageNum,
      ptX,
      ptY,
    );
  }, [triggerClickIndicator, onJumpToSource, synctexMap]);

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
                        isSpreadView={true}
                        pageElemRefs={pageElemRefs}
                        approxHeightRef={approxHeightRef}
                        onDoubleClickPage={handleDoubleClickPage}
                        clickIndicator={clickIndicator}
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
                    isSpreadView={false}
                    pageElemRefs={pageElemRefs}
                    approxHeightRef={approxHeightRef}
                    onDoubleClickPage={handleDoubleClickPage}
                    clickIndicator={clickIndicator}
                  />
                ))}
              </div>
            )
          ) : (
            <div
              ref={(el) => {
                pageElemRefs.current[pageNumber] = el;
              }}
              onDoubleClickCapture={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const pageHeight = rect.height;
                const clickFraction = pageHeight > 0 ? Math.max(0, Math.min(1, clickY / pageHeight)) : 0;
                const effectiveScale = rect.width > 0 ? rect.width / 595 : (scale > 0 ? scale : 1);
                const ptX = Math.round(clickX / effectiveScale);
                const ptY = Math.round(clickY / effectiveScale);
                handleDoubleClickPage(pageNumber, clickFraction, ptX, ptY, clickX, clickY);
              }}
              className={cn(
                "bg-canvas dark:bg-card relative flex items-center justify-center cursor-text transition-[filter] duration-200 shrink-0"
              )}
              style={invertColors ? { filter: 'invert(0.9) hue-rotate(180deg) contrast(1.25)' } : undefined}
            >
              <Page
                pageNumber={pageNumber}
                width={autoFit ? currentContainerWidth : undefined}
                scale={autoFit ? undefined : scale}
                className=""
                renderTextLayer
                renderAnnotationLayer
                onRenderTextLayerSuccess={() => {
                  const el = pageElemRefs.current[pageNumber];
                  if (el) {
                    const textLayers = el.querySelectorAll('.textLayer, .react-pdf__Page__textContent');
                    textLayers.forEach((tl) => {
                      tl.querySelectorAll('span').forEach((span) => {
                        if (span.textContent && span.textContent.includes('—')) {
                          span.textContent = span.textContent.replace(/—/g, '-');
                        }
                      });
                    });
                  }
                }}
                devicePixelRatio={typeof window !== 'undefined' ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1}
              />
              {clickIndicator && clickIndicator.page === pageNumber && (
                <PdfSyncTeXHighlightBox
                  indicator={clickIndicator}
                  pageWidth={autoFit ? currentContainerWidth : Math.round(595 * scale)}
                  scale={scale}
                />
              )}
            </div>
          )}
        </Document>
      )}
    </div>
  );
}));

export const PdfSurface = Surface;
export default Surface;
