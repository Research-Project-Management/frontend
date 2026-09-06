'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Loader2, AlertTriangle, StickyNote, Copy, Check, Highlighter } from 'lucide-react';
import Toolbar from './Toolbar';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { copyToClipboard } from '@/shared/lib/clipboard';

// Configure worker matching exact react-pdf bundled pdfjs-dist version
if (typeof window !== 'undefined' && pdfjs && typeof pdfjs === 'object' && 'GlobalWorkerOptions' in pdfjs && pdfjs.GlobalWorkerOptions) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  } catch {
    // Ignore worker assignment error
  }
}

export function DocumentPageSkeleton({ width }: { width?: number }) {
  const w = width || 600;
  const h = w * 1.414;
  return (
    <div
      className="flex flex-col gap-3 p-8 bg-card border border-border/80 rounded-md animate-pulse select-none"
      style={{ width: w, height: h }}
      aria-hidden="true"
    >
      <div className="h-4 w-3/4 bg-muted/80 rounded-sm mb-4" />
      <div className="h-2.5 w-1/2 bg-muted/60 rounded-sm mb-6" />
      <div className="space-y-2.5 flex-1">
        <div className="h-2 w-full bg-muted/50 rounded-sm" />
        <div className="h-2 w-full bg-muted/50 rounded-sm" />
        <div className="h-2 w-11/12 bg-muted/50 rounded-sm" />
        <div className="h-2 w-full bg-muted/50 rounded-sm" />
        <div className="h-2 w-4/5 bg-muted/50 rounded-sm" />
        <div className="h-2 w-full bg-muted/50 rounded-sm mt-4" />
        <div className="h-2 w-full bg-muted/50 rounded-sm" />
        <div className="h-2 w-9/12 bg-muted/50 rounded-sm" />
      </div>
      <div className="h-2 w-1/4 bg-muted/40 rounded-sm self-center mt-auto" />
    </div>
  );
}

interface ViewerProps {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onAskAi: (selectedText: string) => void;
  onAddToNote?: (selectedText: string) => void;
  onAnnotate?: (selectedText: string, pageNumber: number) => void;
}

export default function Viewer({
  blobUrl,
  isLoading,
  error,
  onRetry,
  onAskAi,
  onAddToNote,
  onAnnotate,
}: ViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [docLoading, setDocLoading] = useState<boolean>(true);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    if (blobUrl) {
      setDocLoading(true);
      setDocError(null);
    }
  }, [blobUrl]);

  // Text selection floating menu
  const [selectedText, setSelectedText] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);
  const [copiedSelection, setCopiedSelection] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Track container width for fit-to-width layout
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Track most visible page in viewport
  useEffect(() => {
    if (numPages === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const obs = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.pageNum);
          if (isNaN(page)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { page, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) setVisiblePage(best.page);
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    pageRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [numPages]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setDocLoading(false);
    setDocError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('PDF render error:', err);
    setDocError('Failed to render PDF. The file may be corrupted.');
    setDocLoading(false);
  };

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Text selection floating menu
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    const container = scrollContainerRef.current;
    if (!text || !container) return;

    if (!container.contains(selection.anchorNode)) return;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const menuHeight = 40;
      const menuGap = 10;
      const menuHalfWidth = 110;
      const selectionTop = rect.top - containerRect.top + container.scrollTop;
      const selectionBottom = rect.bottom - containerRect.top + container.scrollTop;
      const visibleTop = container.scrollTop + menuGap;
      const visibleBottom = container.scrollTop + container.clientHeight - menuHeight - menuGap;
      const preferredTop = selectionTop - menuHeight - menuGap;
      const fallbackTop = selectionBottom + menuGap;
      const top = Math.max(
        visibleTop,
        Math.min(preferredTop >= visibleTop ? preferredTop : fallbackTop, visibleBottom),
      );
      const left = Math.max(
        menuHalfWidth + menuGap,
        Math.min(
          rect.left - containerRect.left + rect.width / 2,
          container.clientWidth - menuHalfWidth - menuGap,
        ),
      );

      setMenuPosition({ top, left });
      setSelectedText(text);
      setShowFloatingMenu(true);
      setCopiedSelection(false);
    } catch {
      setShowFloatingMenu(false);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.pdf-floating-selection-menu')) {
      setShowFloatingMenu(false);
    }
  }, []);

  const handleCopySelection = async () => {
    if (!selectedText) return;
    const ok = await copyToClipboard(selectedText);
    if (ok) {
      setCopiedSelection(true);
      setTimeout(() => {
        setCopiedSelection(false);
        setShowFloatingMenu(false);
      }, 1200);
    }
  };

  const pageWidth = fitWidth ? Math.max(320, containerWidth - 56) : undefined;
  const pageScale = fitWidth ? undefined : zoom;
  const showLoading = isLoading || (blobUrl && docLoading);

  return (
    <div className="relative flex-1 flex flex-col min-w-0 h-full bg-muted/45 overflow-hidden">
      {/* Scrollable PDF area */}
      <div
        ref={scrollContainerRef}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        className="flex-1 overflow-auto relative select-text"
      >
        {error || docError ? (
          <div className="flex flex-col items-center justify-center text-center p-10 max-w-md mx-auto mt-20 gap-3">
            <div className="size-12 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <AlertTriangle className="size-6" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Unable to load document
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{error || docError}</p>
            {onRetry && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors shadow-none cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : !blobUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <DocumentPageSkeleton width={pageWidth} />
              </div>
            ) : (
              <>
                <div className="size-12 rounded-md bg-card border border-border flex items-center justify-center text-muted-foreground">
                  <AlertTriangle className="size-6" />
                </div>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  No valid PDF document path found for this entry.
                </p>
              </>
            )}
          </div>
        ) : (
          <Document
            file={blobUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center gap-4 py-5 px-4">
                <DocumentPageSkeleton width={pageWidth} />
              </div>
            }
          >
            <div className="flex flex-col items-center gap-3 py-5 px-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  data-page-num={pageNum}
                  ref={(el) => {
                    if (el) pageRefs.current.set(pageNum, el);
                    else pageRefs.current.delete(pageNum);
                  }}
                  className="bg-card border border-border/80 rounded-md overflow-hidden"
                >
                  <Page
                    pageNumber={pageNum}
                    scale={pageScale}
                    width={pageWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={<DocumentPageSkeleton width={pageWidth} />}
                  />
                </div>
              ))}
            </div>
          </Document>
        )}

        {/* Floating AI & Action menu */}
        {showFloatingMenu && selectedText && (
          <div
            className="pdf-floating-selection-menu absolute z-50 flex items-center gap-1 bg-foreground text-background px-2 py-1.5 rounded-md border border-border/40 backdrop-blur animate-in fade-in zoom-in-95 duration-150 select-none"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              transform: 'translateX(-50%)',
            }}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                onAskAi(selectedText);
                setShowFloatingMenu(false);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold hover:bg-background/20 focus-visible:ring-1 focus-visible:ring-background focus-visible:outline-none transition-colors cursor-pointer"
              title="Ask AI about selected text"
            >
              Ask AI
            </button>

            {onAddToNote ? (
              <button
                type="button"
                onClick={() => {
                  onAddToNote(selectedText);
                  setShowFloatingMenu(false);
                  window.getSelection()?.removeAllRanges();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-background/20 focus-visible:ring-1 focus-visible:ring-background focus-visible:outline-none transition-colors cursor-pointer"
                title="Add selected text to a new note"
              >
                <StickyNote className="size-3.5 text-background" />
                Note
              </button>
            ) : null}

            {onAnnotate ? (
              <button
                type="button"
                onClick={() => {
                  onAnnotate(selectedText, visiblePage);
                  setShowFloatingMenu(false);
                  window.getSelection()?.removeAllRanges();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-background/20 focus-visible:ring-1 focus-visible:ring-background focus-visible:outline-none transition-colors cursor-pointer"
                title="Highlight & annotate selected text"
              >
                <Highlighter className="size-3.5 text-background" />
                Highlight
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleCopySelection}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-background/20 focus-visible:ring-1 focus-visible:ring-background focus-visible:outline-none transition-colors cursor-pointer"
              title="Copy selection"
            >
              {copiedSelection ? (
                <Check className="size-3.5 text-background" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copiedSelection ? 'Copied' : 'Copy'}
            </button>

            <div className="w-px h-3.5 bg-background/20 mx-0.5" />
            <button
              type="button"
              onClick={() => setShowFloatingMenu(false)}
              className="p-1 rounded hover:bg-background/20 focus-visible:ring-1 focus-visible:ring-background focus-visible:outline-none transition-colors opacity-70 hover:opacity-100 cursor-pointer"
              aria-label="Close menu"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Docked bottom toolbar - never obscures document text */}
      <div className="h-8 shrink-0 flex items-center border-t border-border bg-background px-3 select-none">
        <Toolbar
          pageNumber={visiblePage}
          numPages={numPages || null}
          zoom={zoom}
          onPageChange={scrollToPage}
          onZoomChange={(z: number) => { setZoom(z); setFitWidth(false); }}
          onFitWidth={() => setFitWidth(true)}
          loading={!!showLoading}
        />
      </div>
    </div>
  );
}
