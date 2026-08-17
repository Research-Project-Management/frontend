'use client';

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AlertCircle, Loader2, Play } from 'lucide-react';
import { LatexCompilerEngine, type SyncTeXMap } from '@/features/editor/utils/viewer.util';
import { toast } from 'sonner';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ── Optimized PDF Page with IntersectionObserver ──────────────────────────────

interface OptimizedPDFPageProps {
  pageIndex: number; // 0-based
  scale: number;
  pageElemRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  approxHeightRef: React.MutableRefObject<number>;
  onDoubleClickPage: (pageNum: number, clickFraction: number) => void;
}

function OptimizedPDFPage({
  pageIndex,
  scale,
  pageElemRefs,
  approxHeightRef,
  onDoubleClickPage,
}: OptimizedPDFPageProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting);
          if (entry.isIntersecting && entry.boundingClientRect.height > 0) {
            approxHeightRef.current = entry.boundingClientRect.height;
          }
        });
      },
      {
        root: null,
        rootMargin: '450px 0px 450px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, [approxHeightRef]);

  const pageNum = pageIndex + 1;
  const estimatedHeight = approxHeightRef.current > 0 ? approxHeightRef.current : 840 * scale;

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const pageHeight = (e.currentTarget as HTMLDivElement).offsetHeight;
    const clickFraction = pageHeight > 0 ? e.nativeEvent.offsetY / pageHeight : 0;
    onDoubleClickPage(pageNum, clickFraction);
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        pageElemRefs.current[pageNum] = el;
      }}
      onDoubleClickCapture={handleDoubleClick}
      title="Double-click anywhere to jump to LaTeX source"
      className="shadow-lg bg-background rounded-sm transition-shadow relative overflow-hidden flex items-center justify-center border border-border/10 cursor-text"
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
          devicePixelRatio={Math.max(2, window.devicePixelRatio || 2)}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-muted/10">
              <Loader2 className="size-5 animate-spin text-muted-foreground/30" />
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
  onJumpToSource?: (file: string | null, line: number) => void;
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
  const handleDoubleClickPage = (pageNum: number, clickFraction: number) => {
    if (!synctexMap || !onJumpToSource) return;
    const resolved = LatexCompilerEngine.resolveReverse(clickFraction, pageNum, synctexMap);
    if (resolved) {
      onJumpToSource(resolved.sourcePath, resolved.line);
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-auto bg-muted/40 p-4 flex flex-col items-center justify-start select-text relative"
    >
      {!pdfUrl ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
          <div className="text-center">
            <p className="text-sm font-medium">No PDF yet</p>
            <p className="text-xs mt-1">
              Click <strong>Compile</strong> or press{' '}
              <kbd className="px-1 py-0.5 text-[10px] bg-muted border rounded">Ctrl+Enter</kbd> to
              generate the PDF
            </p>
          </div>
          {onCompile && (
            <button
              onClick={onCompile}
              disabled={
                compileStatus !== 'idle' &&
                compileStatus !== 'done' &&
                compileStatus !== 'error'
              }
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {compileStatus === 'compiling' ||
              compileStatus === 'flushing' ||
              compileStatus === 'syncing' ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
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
      ) : (
        /* PDF Document Canvas */
        <Document
          file={pdfUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          onLoadError={(error) => {
            console.warn('[Surface] Document load error:', error);
            toast.error('Could not render PDF. Check compilation log.');
          }}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-full gap-2 p-6 text-center text-muted-foreground select-none">
              <AlertCircle className="size-6 text-muted-foreground/60" />
              <p className="text-xs font-medium">Failed to load PDF file.</p>
              {onCompile && (
                <button
                  type="button"
                  onClick={onCompile}
                  className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 mt-2 transition-colors"
                >
                  Compile again
                </button>
              )}
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
              className="shadow-lg"
              renderTextLayer
              renderAnnotationLayer
              devicePixelRatio={Math.max(2, window.devicePixelRatio || 2)}
            />
          )}
        </Document>
      )}
    </div>
  );
});

export const PdfSurface = Surface;
export default Surface;
