'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X, Loader2, AlertTriangle, StickyNote, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import PdfViewerToolbar from './pdf-toolbar';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Configure worker matching exact react-pdf bundled pdfjs-dist version
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
}

interface PdfViewerProps {
  blobUrl: string | null;
  filename: string;
  isLoading: boolean;
  error: string | null;
  onAskAi: (selectedText: string) => void;
  onAddToNote?: (selectedText: string) => void;
}

export default function PdfViewer({
  blobUrl,
  filename,
  isLoading,
  error,
  onAskAi,
  onAddToNote,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [docLoading, setDocLoading] = useState<boolean>(true);
  const [docError, setDocError] = useState<string | null>(null);

  const fileSource = useMemo(() => (blobUrl ? { url: blobUrl } : null), [blobUrl]);

  // Text selection floating menu
  const [selectedText, setSelectedText] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);
  const [copiedSelection, setCopiedSelection] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Track container width for fit-to-width ────────────────────────────────
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Intersection Observer: track which page is most visible ───────────────
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

  // ── Document load handlers ────────────────────────────────────────────────
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

  // ── Scroll to page ────────────────────────────────────────────────────────
  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ── Text selection → floating menu ────────────────────────────────────────
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

  const handleCopySelection = () => {
    if (!selectedText) return;
    navigator.clipboard.writeText(selectedText);
    setCopiedSelection(true);
    toast.success('Text copied to clipboard');
    setTimeout(() => {
      setCopiedSelection(false);
      setShowFloatingMenu(false);
    }, 1200);
  };

  // ── Computed page width ───────────────────────────────────────────────────
  const pageWidth = fitWidth ? Math.max(320, containerWidth - 56) : undefined;
  const pageScale = fitWidth ? undefined : zoom;

  // ── Derived loading state: blob loading OR document rendering ─────────────
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
            <AlertTriangle className="size-9 text-destructive" />
            <p className="text-sm font-semibold text-foreground">{error || docError}</p>
            <p className="text-xs text-muted-foreground">
              Download the paper from the reader header to view it in an external reader.
            </p>
          </div>
        ) : !blobUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground animate-pulse">
              Loading document…
            </p>
          </div>
        ) : (
          <Document
            file={fileSource}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground animate-pulse">
                  Rendering pages…
                </p>
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
                  className="bg-card border border-border rounded shadow-sm"
                >
                  <Page
                    pageNumber={pageNum}
                    scale={pageScale}
                    width={pageWidth}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={
                      <div
                        className="flex items-center justify-center"
                        style={{ width: pageWidth || 600, height: (pageWidth || 600) * 1.414 }}
                      >
                        <Loader2 className="size-5 animate-spin text-primary/40" />
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </Document>
        )}

        {/* Floating AI & Action menu */}
        {showFloatingMenu && selectedText && (
          <div
            className="pdf-floating-selection-menu absolute z-50 flex items-center gap-1 bg-foreground text-background px-2 py-1.5 rounded-lg shadow-xl border border-border/30 backdrop-blur animate-in fade-in zoom-in-95 duration-150 select-none"
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
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold hover:bg-background/20 transition-colors"
              title="Ask AI about selected text"
            >
              <img src="/Chat.svg" alt="AI" className="size-3.5" />
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
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-background/20 transition-colors"
                title="Add selected text to a new note"
              >
                <StickyNote className="size-3.5 text-primary" />
                Note
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleCopySelection}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium hover:bg-background/20 transition-colors"
              title="Copy selection"
            >
              {copiedSelection ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copiedSelection ? 'Copied' : 'Copy'}
            </button>

            <div className="w-px h-3.5 bg-background/20 mx-0.5" />
            <button
              type="button"
              onClick={() => setShowFloatingMenu(false)}
              className="p-1 rounded hover:bg-background/20 transition-colors opacity-70 hover:opacity-100"
              aria-label="Close menu"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <PdfViewerToolbar
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
