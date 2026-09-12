'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2, AlertTriangle, StickyNote, Copy, Check, Highlighter, Quote } from 'lucide-react';
import type { DocumentFulltext, ReaderDocument } from '../../types/reader.types';
import type { ReaderAnnotationTool } from '../../store/reader.store';
import { formatInTextCitation } from '../../utils/reader.util';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { copyToClipboard, cn } from "@/shared/lib/utils";

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
      className="flex flex-col gap-3 p-8 bg-card border border-border rounded-md animate-pulse select-none"
      style={{ width: w, height: h }}
      aria-hidden="true"
    >
      <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
      <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
      <div className="space-y-2.5 flex-1">
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-11/12 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-4/5 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm mt-4" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-9/12 bg-muted rounded-sm" />
      </div>
      <div className="h-2 w-1/4 bg-muted rounded-sm self-center mt-auto" />
    </div>
  );
}

interface ViewerProps {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onAskAi: (selectedText: string) => void;
  onAddToNote?: (selectedText: string, pageNumber?: number) => void;
  onAnnotate?: (selectedText: string, pageNumber: number, colorHex?: string) => void;
  fulltext?: DocumentFulltext | null;
  isLoadingFulltext?: boolean;
  targetPage?: { pageNumber: number; timestamp: number } | null;
  paper?: ReaderDocument;
  onVisiblePageChange?: (page: number) => void;
  onTotalPagesChange?: (total: number) => void;
  zoom?: number;
  rotation?: number;
  themeMode?: 'normal' | 'sepia' | 'dark';
  interactionMode?: 'select' | 'hand';
  activeColor?: string;
  activeTool?: ReaderAnnotationTool;
}

export default function Viewer({
  blobUrl,
  isLoading,
  error,
  onRetry,
  onAskAi,
  onAddToNote,
  onAnnotate,
  fulltext,
  isLoadingFulltext,
  targetPage,
  paper,
  onVisiblePageChange,
  onTotalPagesChange,
  zoom: zoomProp,
  rotation = 0,
  themeMode = 'normal',
  interactionMode = 'select',
  activeColor,
  activeTool = 'highlight',
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
  const [copiedCitation, setCopiedCitation] = useState<boolean>(false);

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
        if (best && best.ratio > 0) {
          setVisiblePage(best.page);
          onVisiblePageChange?.(best.page);
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    pageRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [numPages, onVisiblePageChange]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    onTotalPagesChange?.(n);
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

  useEffect(() => {
    if (targetPage && targetPage.pageNumber >= 1) {
      scrollToPage(targetPage.pageNumber);
    }
  }, [targetPage, scrollToPage]);

  const handleJumpToPage = useCallback(
    (page: number, _coords?: { x: number; y: number; width: number; height: number }) => {
      scrollToPage(page);
    },
    [scrollToPage],
  );

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
      setCopiedCitation(false);
    } catch {
      setShowFloatingMenu(false);
    }
  }, []);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (interactionMode === 'hand') {
      isPanningRef.current = true;
      if (scrollContainerRef.current) {
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: scrollContainerRef.current.scrollLeft,
          scrollTop: scrollContainerRef.current.scrollTop,
        };
      }
      return;
    }
    const target = e.target as HTMLElement;
    if (!target.closest('.pdf-floating-selection-menu')) {
      setShowFloatingMenu(false);
    }
  }, [interactionMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (interactionMode === 'hand' && isPanningRef.current && scrollContainerRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    }
  }, [interactionMode]);

  const handleMouseUpCombined = useCallback(() => {
    if (interactionMode === 'hand') {
      isPanningRef.current = false;
      return;
    }
    handleMouseUp();
  }, [interactionMode, handleMouseUp]);

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

  const handleCopyCitation = async () => {
    if (!paper || !selectedText) return;
    const citation = formatInTextCitation(paper, visiblePage);
    const citeText = `${citation} "${selectedText}"`;
    const ok = await copyToClipboard(citeText);
    if (ok) {
      setCopiedCitation(true);
      setTimeout(() => {
        setCopiedCitation(false);
        setShowFloatingMenu(false);
      }, 1200);
    }
  };

  const currentZoom = zoomProp ?? zoom;
  const pageWidth = Math.max(320, Math.round((containerWidth - 56) * currentZoom));
  const showLoading = isLoading || (blobUrl && docLoading);

  return (
    <div
      className={cn(
        "relative flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-colors",
        themeMode === 'dark' ? "bg-zinc-950" : themeMode === 'sepia' ? "bg-[#efe7d7]" : "bg-muted"
      )}
    >
      {/* Scrollable PDF area */}
      <div
        ref={scrollContainerRef}
        onMouseUp={handleMouseUpCombined}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className={cn(
          "flex-1 overflow-auto relative",
          interactionMode === 'hand' ? "cursor-grab active:cursor-grabbing select-none" : "select-text"
        )}
      >
        {error || docError ? (
          <div className="flex flex-col items-center justify-center text-center p-10 max-w-md mx-auto mt-20 gap-3">
            <div className="size-12 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <AlertTriangle className="size-6 shrink-0" />
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
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary-hover focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors shadow-none cursor-pointer"
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
                  <AlertTriangle className="size-6 shrink-0" />
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
                  className={cn(
                    "bg-card border border-border rounded-md overflow-hidden transition-all shadow-xs",
                    themeMode === 'dark' && "invert-[0.9] hue-rotate-180 contrast-90 brightness-95",
                    themeMode === 'sepia' && "sepia-[0.3] contrast-95 brightness-95"
                  )}
                >
                  <Page
                    pageNumber={pageNum}
                    width={pageWidth}
                    rotate={rotation}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    loading={<DocumentPageSkeleton width={pageWidth} />}
                  />
                </div>
              ))}
            </div>
          </Document>
        )}

        {/* Floating selection action menu: highlight colors, note, ask AI, cite, copy */}
        {showFloatingMenu && selectedText && (
          <div
            className="pdf-floating-selection-menu absolute z-50 flex items-center gap-1.5 bg-card text-foreground px-2 py-1 rounded-md border border-border shadow-raised-200 duration-150 select-none"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              transform: 'translateX(-50%)',
            }}
            onMouseUp={(e) => e.stopPropagation()}
          >
            {/* 8 Zotero Color Highlight Dots */}
            {onAnnotate && (
              <div className="flex items-center gap-1 pr-1.5 border-r border-border">
                {[
                  { id: 'yellow', label: 'Yellow', hex: '#ffd400' },
                  { id: 'red', label: 'Red', hex: '#ff6666' },
                  { id: 'green', label: 'Green', hex: '#5fb236' },
                  { id: 'blue', label: 'Blue', hex: '#2ea8e5' },
                  { id: 'purple', label: 'Purple', hex: '#a28ae5' },
                  { id: 'magenta', label: 'Magenta', hex: '#e56eee' },
                  { id: 'orange', label: 'Orange', hex: '#f19837' },
                  { id: 'gray', label: 'Gray', hex: '#aaaaaa' },
                ].map((c) => {
                  const isSelected = activeColor === c.hex;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={`Highlight in ${c.label}`}
                      onClick={() => {
                        onAnnotate(selectedText, visiblePage, c.hex);
                        setShowFloatingMenu(false);
                        window.getSelection()?.removeAllRanges();
                      }}
                      title={`Highlight in ${c.label}`}
                      className={cn(
                        "size-3.5 rounded-full border border-border hover:scale-125 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isSelected && "ring-2 ring-primary ring-offset-1 scale-110"
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  );
                })}
              </div>
            )}

            {/* Note Action */}
            {onAddToNote && (
              <button
                type="button"
                aria-label="Add selected text to Note"
                onClick={() => {
                  onAddToNote(selectedText, visiblePage);
                  setShowFloatingMenu(false);
                  window.getSelection()?.removeAllRanges();
                }}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md text-12 font-medium hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                title="Add selected text to Note"
              >
                <StickyNote className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span>Note</span>
              </button>
            )}

            {/* Ask AI Action */}
            <button
              type="button"
              aria-label="Ask AI about selected text"
              onClick={() => {
                onAskAi(selectedText);
                setShowFloatingMenu(false);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-12 font-medium hover:bg-muted text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Ask AI about selected text"
            >
              <img src="/Chat.svg" alt="AI" className="size-3.5 shrink-0 rounded-full" />
              <span>Ask AI</span>
            </button>

            {/* Cite Action */}
            {paper && (
              <button
                type="button"
                aria-label="Copy in-text citation"
                onClick={handleCopyCitation}
                className="flex items-center gap-1 px-1.5 py-1 rounded-md text-12 font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                title="Copy in-text citation: (Author, Year, p. X)"
              >
                {copiedCitation ? (
                  <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                ) : (
                  <Quote className="size-3.5 shrink-0" strokeWidth={1.5} />
                )}
                <span>{copiedCitation ? 'Cited' : 'Cite'}</span>
              </button>
            )}

            {/* Copy Action */}
            <button
              type="button"
              aria-label="Copy selected text"
              onClick={handleCopySelection}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-12 font-medium hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Copy text"
            >
              {copiedSelection ? (
                <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
              ) : (
                <Copy className="size-3.5 shrink-0" strokeWidth={1.5} />
              )}
              <span>{copiedSelection ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
