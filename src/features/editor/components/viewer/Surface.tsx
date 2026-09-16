'use client';

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AlertCircle, FileText, Loader2, Play } from 'lucide-react';
import { LatexCompilerEngine, type SyncTeXMap } from '@/features/editor/utils/viewer.util';
import { useIntersectionObserver } from "@/shared/hooks";
import { toast } from 'sonner';
import { logger } from "@/shared/lib/utils";

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
if (typeof window !== 'undefined' && pdfjs && typeof pdfjs === 'object' && 'GlobalWorkerOptions' in pdfjs && pdfjs.GlobalWorkerOptions) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  } catch (err) {
    logger.debug('[Surface] Failed to assign workerSrc', { err });
  }
}

// ── Optimized PDF Page with IntersectionObserver ──────────────────────────────

interface OptimizedPDFPageProps {
  pageIndex: number; // 0-based
  scale: number;
  pageElemRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  approxHeightRef: React.MutableRefObject<number>;
  onDoubleClickPage: (
    pageNum: number,
    clickFraction: number,
    x?: number,
    y?: number,
  ) => void;
}

function OptimizedPDFPage({
  pageIndex,
  scale,
  pageElemRefs,
  approxHeightRef,
  onDoubleClickPage,
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
  const estimatedHeight = approxHeightRef.current > 0 ? approxHeightRef.current : 840 * scale;

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const pageHeight = (e.currentTarget as HTMLDivElement).offsetHeight;
    const clickFraction = pageHeight > 0 ? e.nativeEvent.offsetY / pageHeight : 0;
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    (onDoubleClickPage as any)(pageNum, clickFraction, x, y);
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        pageElemRefs.current[pageNum] = el;
      }}
      onDoubleClickCapture={handleDoubleClick}
      title="Double-click anywhere to jump to LaTeX source"
      className="bg-card rounded-sm border border-border relative overflow-hidden flex items-center justify-center cursor-text"
      style={{
        width: 595 * scale,
        minHeight: isVisible ? undefined : estimatedHeight,
        aspectRatio: isVisible ? undefined : '595 / 842',
      }}
    >
      {isVisible ? (
        <Page
          pageNumber={pageNum}
          scale={scale}
          renderTextLayer
          renderAnnotationLayer
          devicePixelRatio={Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2)}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="size-5 animate-spin text-muted-foreground/30 shrink-0" />
            </div>
          }
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary/10 text-muted-foreground/30 select-none animate-pulse">
          <span className="text-xs font-mono font-medium">Page {pageNum}</span>
        </div>
      )}
    </div>
  );
}

// ── Surface Imperative Handle ─────────────────────────────────────────────────

export interface SurfaceHandle {
  scrollToPage: (pageNum: number) => void;
  getContainer: () => HTMLDivElement | null;
}

export type PdfSurfaceHandle = SurfaceHandle;

// ── Surface Props ─────────────────────────────────────────────────────────────

export interface SurfaceProps {
  pdfUrl: string | null;
  synctexMap: SyncTeXMap | null;
  scale: number;
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
}

export type PdfSurfaceProps = SurfaceProps;

export const Surface = forwardRef<SurfaceHandle, SurfaceProps>(function Surface(
  {
    pdfUrl,
    synctexMap,
    scale,
    scrollMode = true,
    pageNumber,
    numPages,
    compileStatus,
    onPageNumberChange,
    onNumPagesChange,
    onDocumentLoadSuccess: parentOnLoadSuccess,
    onJumpToSource,
    onCompile,
  },
  ref,
) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageElemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const approxHeightRef = useRef<number>(0);

  // Expose container and scrollToPage via ref
  useImperativeHandle(ref, () => ({
    scrollToPage(pageNum: number) {
      const el = pageElemRefs.current[pageNum];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    getContainer() {
      return scrollContainerRef.current;
    },
  }));

  const handleDocumentLoadSuccess = (pdf: any) => {
    onNumPagesChange?.(pdf.numPages);
    parentOnLoadSuccess?.(pdf);
  };

  // SyncTeX inverse search (PDF double-click -> LaTeX source jump)
  const handleDoubleClickPage = (
    pageNum: number,
    clickFraction: number,
    x?: number,
    y?: number,
  ) => {
    if (!onJumpToSource) return;
    const resolved = synctexMap
      ? LatexCompilerEngine.resolveReverse(clickFraction, pageNum, synctexMap)
      : null;
    onJumpToSource(
      resolved?.sourcePath ?? null,
      resolved?.line ?? 1,
      pageNum,
      x,
      y,
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto bg-background p-4 flex flex-col items-center justify-start select-text relative"
    >
      {!pdfUrl ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center h-full w-full select-none">
          <div className="flex flex-col items-center justify-center text-center max-w-sm rounded-xl border border-border bg-background p-8 shadow-xs gap-4">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-foreground">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No PDF yet</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Click <strong className="font-semibold text-foreground">Compile</strong> or press{' '}
                <kbd className="px-1.5 py-0.5 text-11 font-mono font-medium bg-muted border border-border rounded text-foreground">
                  Ctrl+Enter
                </kbd>{' '}
                to generate the PDF
              </p>
            </div>
            {onCompile && (
              <button
                type="button"
                onClick={onCompile}
                disabled={
                  compileStatus !== 'idle' &&
                  compileStatus !== 'done' &&
                  compileStatus !== 'error'
                }
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {compileStatus === 'compiling' ||
                compileStatus === 'flushing' ||
                compileStatus === 'syncing' ? (
                  <Loader2 className="size-4 animate-spin shrink-0" />
                ) : (
                  <Play className="size-4 shrink-0" />
                )}
                {compileStatus === 'flushing'
                  ? 'Saving…'
                  : compileStatus === 'syncing'
                    ? 'Syncing…'
                    : compileStatus === 'compiling'
                      ? 'Compiling…'
                      : 'Compile'}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* PDF Document Canvas */
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={(error) => {
            logger.warn('[Surface] Document load error', { error });
            toast.error('Could not render PDF. Check compilation log.');
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-8 animate-spin text-muted-foreground shrink-0" />
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-full select-none">
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center bg-background rounded-xl border border-border shadow-xs max-w-sm">
                <AlertCircle className="size-6 text-destructive shrink-0" />
                <p className="text-sm font-medium text-foreground">Failed to load PDF file.</p>
                {onCompile && (
                  <button
                    type="button"
                    onClick={onCompile}
                    className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 mt-1 font-medium transition-colors"
                  >
                    Compile again
                  </button>
                )}
              </div>
            </div>
          }
        >
          {scrollMode ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: numPages }, (_, i) => (
                <OptimizedPDFPage
                  key={`page_${i + 1}`}
                  pageIndex={i}
                  scale={scale}
                  pageElemRefs={pageElemRefs}
                  approxHeightRef={approxHeightRef}
                  onDoubleClickPage={handleDoubleClickPage}
                />
              ))}
            </div>
          ) : (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              className=""
              renderTextLayer
              renderAnnotationLayer
              devicePixelRatio={Math.max(2, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2)}
            />
          )}
        </Document>
      )}
    </div>
  );
});

export const PdfSurface = Surface;
export default Surface;
