import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";
import PdfViewerToolbar from "./PdfViewerToolbar";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Use exact versioned unpkg CDN for the worker to guarantee absolute cross-environment reliability
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  filename: string;
  onAskAi: (selectedText: string) => void;
}

export default function PdfViewer({ url, filename, onAskAi }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Text selection floating menu
  const [selectedText, setSelectedText] = useState<string>("");
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Authenticated blob fetch ──────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    let currentBlobUrl: string | null = null;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);
        setBlobUrl(null);

        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF (${response.status}): ${response.statusText}`);
        }

        // Validate content type - if it's JSON, the server returned an error payload instead of a PDF binary
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const text = await response.text();
          try {
            const parsed = JSON.parse(text);
            throw new Error(parsed.message || parsed.error || "Server returned an authorization/access error");
          } catch {
            throw new Error("Server returned an invalid JSON response instead of a PDF");
          }
        }

        const blob = await response.blob();
        if (blob.type.includes("application/json") || blob.size < 100) {
          // Extra guard for small blobs or text/json files masquerading as PDF responses
          const text = await blob.text();
          if (text.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(text);
              throw new Error(parsed.message || parsed.error || "Invalid response payload");
            } catch {}
          }
        }

        if (active) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
        }
      } catch (err: any) {
        if (active) {
          console.error("PDF load error:", err);
          setError(err.message || "Failed to load PDF file.");
          setLoading(false);
        }
      }
    }

    if (url) loadPdf();

    return () => {
      active = false;
      if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    };
  }, [url]);

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
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    pageRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [numPages]);

  // ── Document load handlers ────────────────────────────────────────────────
  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("PDF render error:", err);
    setError("Failed to render PDF. The file may be corrupted.");
    setLoading(false);
  };

  // ── Navigate to page (scroll into view) ───────────────────────────────────
  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── Text selection → floating menu ────────────────────────────────────────
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    const container = scrollContainerRef.current;
    if (!text || !container) return;

    // Make sure selection is inside our scroll container
    if (!container.contains(selection.anchorNode)) return;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const menuHeight = 36;
      const menuGap = 8;
      const menuHalfWidth = 72;
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

      setMenuPosition({
        top,
        left,
      });
      setSelectedText(text);
      setShowFloatingMenu(true);
    } catch {
      setShowFloatingMenu(false);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".pdf-floating-ask-ai")) {
      setShowFloatingMenu(false);
    }
  }, []);

  // ── Computed page width ───────────────────────────────────────────────────
  const pageWidth = fitWidth ? Math.max(320, containerWidth - 56) : undefined;
  const pageScale = fitWidth ? undefined : zoom;

  return (
    <div className="relative flex-1 flex flex-col min-w-0 h-full bg-muted/45 overflow-hidden">
      {/* Scrollable PDF area */}
      <div
        ref={scrollContainerRef}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        className="flex-1 overflow-auto relative select-text"
      >
        {error ? (
          <div className="flex flex-col items-center justify-center text-center p-10 max-w-md mx-auto mt-20 gap-3">
            <AlertTriangle className="size-9 text-destructive" />
            <p className="text-sm font-semibold text-foreground">{error}</p>
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
            file={blobUrl}
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
                  className="bg-card border border-border"
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

        {/* Floating Flux AI menu */}
        {showFloatingMenu && selectedText && (
          <div
            className="pdf-floating-ask-ai absolute z-50 flex items-center gap-1 bg-foreground text-background px-2.5 py-1.5 rounded-lg shadow-md border border-border/30"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              transform: "translateX(-50%)",
            }}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onAskAi(selectedText);
                setShowFloatingMenu(false);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-opacity"
            >
              <img src="/Chat.svg" alt="Flux AI" className="size-3.5" />
              Flux AI
            </button>
            <div className="w-px h-3.5 bg-background/20 mx-1" />
            <button
              onClick={() => setShowFloatingMenu(false)}
              className="hover:opacity-70 transition-opacity"
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
          onZoomChange={(z) => { setZoom(z); setFitWidth(false); }}
          onFitWidth={() => setFitWidth(true)}
          loading={loading}
        />
      </div>
    </div>
  );
}
