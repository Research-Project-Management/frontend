'use client';

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
import { AlertCircle, FileText, Loader2, Play } from 'lucide-react';
import { LatexCompilerEngine, type SyncTeXMap } from '@/features/editor/utils/viewer.util';
import { useIntersectionObserver } from "@/shared/hooks";
import { logger, cn } from "@/shared/lib/utils";
import { PlaneErrorState, PlaneEmptyState } from '@/shared/components/ui';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { setupPdfWorker } from '@/shared/lib/pdfjs-worker';

// Ensure PDF.js worker is properly configured
setupPdfWorker();

// ── Optimized PDF Page with IntersectionObserver ──────────────────────────────

interface ClickIndicator {
  page: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
  id: number;
}

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
  clickIndicator?: ClickIndicator | null;
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
              <Loader2 className="size-5 animate-spin text-muted-foreground/30 shrink-0" />
            </div>
          }
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 text-muted-foreground/30 select-none animate-pulse">
          <span className="text-xs font-mono font-medium">Page {pageNum}</span>
        </div>
      )}
      {clickIndicator && clickIndicator.page === pageNum && (
        <div
          key={clickIndicator.id}
          className="pointer-events-none absolute z-30 transition-opacity duration-300"
          style={
            clickIndicator.w && clickIndicator.h
              ? {
                  left: `${clickIndicator.x}px`,
                  top: `${clickIndicator.y}px`,
                  width: `${Math.max(clickIndicator.w, 48)}px`,
                  height: `${Math.max(clickIndicator.h, 16)}px`,
                  transform: 'translate(0, -50%)',
                }
              : {
                  left: `${clickIndicator.x}px`,
                  top: `${clickIndicator.y}px`,
                  transform: 'translate(-50%, -50%)',
                }
          }
        >
          {clickIndicator.w && clickIndicator.h ? (
            <div className="relative w-full h-full">
              <div className="absolute inset-0 rounded-sm bg-primary/20 border-y-2 border-primary animate-pulse" />
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-2 rounded-full bg-primary ring-2 ring-background" />
            </div>
          ) : (
            <span className="relative flex size-9 items-center justify-center">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500/60 opacity-80" />
              <span className="absolute inline-flex size-6 rounded-full border-2 border-emerald-500 bg-emerald-500/20" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-600" />
            </span>
          )}
        </div>
      )}
    </div>
  );
});

// ── Surface Imperative Handle ─────────────────────────────────────────────────

export interface SurfaceHandle {
  scrollToPage: (pageNum: number) => void;
  highlightTarget?: (page: number, x: number, y: number, w?: number, h?: number) => void;
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
  },
  ref,
) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const approxHeightRef = useRef<number>(0);
  const [clickIndicator, setClickIndicator] = useState<ClickIndicator | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  setupPdfWorker();
  useEffect(() => {
    setupPdfWorker();
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

  const triggerClickIndicator = useCallback(
    (page: number, x: number, y: number, w?: number, h?: number) => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      setClickIndicator({ page, x, y, w, h, id: Date.now() });
      clickTimerRef.current = setTimeout(() => {
        setClickIndicator(null);
      }, 2000);
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

  // Expose container, scrollToPage, and target highlighting via ref
  useImperativeHandle(ref, () => ({
    scrollToPage(pageNum: number) {
      const el = pageElemRefs.current[pageNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    highlightTarget(page: number, x: number, y: number, w?: number, h?: number) {
      triggerClickIndicator(page, x, y, w, h);
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
    getContainer() {
      return scrollContainerRef.current;
    },
  }));

  const handleDocumentLoadSuccess = useCallback((pdf: any) => {
    onNumPagesChange?.(pdf.numPages);
    parentOnLoadSuccess?.(pdf);
  }, [onNumPagesChange, parentOnLoadSuccess]);

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
      triggerClickIndicator(pageNum, pixelX, pixelY);
    }
    if (!onJumpToSource) return;
    const resolved = synctexMap
      ? LatexCompilerEngine.resolveReverse(clickFraction, pageNum, synctexMap, ptX, ptY)
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
        className={cn(
          "flex-1 h-full min-h-0 overflow-y-auto flex flex-col items-center justify-start select-text relative transition-colors duration-200 thin-scrollbar",
          autoFit ? "overflow-x-hidden" : "overflow-x-auto",
          invertColors ? "bg-neutral-950 text-neutral-100" : "bg-background text-foreground"
        )}
      >
        {!pdfUrl ? (
          <PlaneEmptyState
            variant="preview"
            className={invertColors ? "bg-neutral-950 text-neutral-100" : undefined}
          />
        ) : (
          /* PDF Document Canvas */
          <Document
            file={pdfUrl}
            options={documentOptions}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={(error) => {
              logger.warn('[Surface] Document load error', { error });
            }}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-8 animate-spin text-primary shrink-0" />
              </div>
            }
            error={
              <PlaneErrorState
                title="Failed to load PDF file"
                description="An issue occurred while rendering the compiled document canvas."
                error={new Error('The compiled PDF document could not be decoded by the viewer engine.')}
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
                <div
                  key={clickIndicator.id}
                  className="pointer-events-none absolute z-30 transition-opacity duration-300"
                  style={{
                    left: `${clickIndicator.x}px`,
                    top: `${clickIndicator.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <span className="relative flex size-9 items-center justify-center">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-70" />
                    <span className="absolute inline-flex size-6 rounded-full border-2 border-primary bg-primary/20" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                </div>
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
