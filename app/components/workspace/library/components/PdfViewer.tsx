import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Sparkles, X, Loader2, AlertTriangle } from "lucide-react";
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

      // Position relative to the scroll container's viewport + scroll offset
      setMenuPosition({
        top: rect.top - containerRect.top + container.scrollTop - 44,
        left: rect.left - containerRect.left + rect.width / 2,
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
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#f1f3f4] dark:bg-zinc-900 overflow-hidden">
      <PdfViewerToolbar
        pageNumber={visiblePage}
        numPages={numPages || null}
        zoom={zoom}
        onPageChange={scrollToPage}
        onZoomChange={(z) => { setZoom(z); setFitWidth(false); }}
        onFitWidth={() => setFitWidth(true)}
        downloadUrl={blobUrl || url}
        filename={filename}
        loading={loading}
      />

      {/* Scrollable PDF area */}
      <div
        ref={scrollContainerRef}
        onMouseUp={handleMouseUp}
        onMouseDown={handleMouseDown}
        className="flex-1 overflow-auto relative select-text"
      >
        {error ? (
          <div className="flex flex-col items-center justify-center text-center p-10 max-w-md mx-auto mt-20 gap-3">
            <AlertTriangle className="size-9 text-[#d93025]" />
            <p className="text-sm font-semibold text-[#202222] dark:text-zinc-100">{error}</p>
            <p className="text-xs text-[#5f6368] dark:text-zinc-400">
              Download the paper using the toolbar to view in an external reader.
            </p>
          </div>
        ) : !blobUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="size-7 animate-spin text-[#3370ff]" />
            <p className="text-xs text-[#5f6368] dark:text-zinc-400 animate-pulse">
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
                <Loader2 className="size-7 animate-spin text-[#3370ff]" />
                <p className="text-xs text-[#5f6368] dark:text-zinc-400 animate-pulse">
                  Rendering pages…
                </p>
              </div>
            }
          >
            <div className="flex flex-col items-center gap-2 py-4 px-4">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div
                  key={pageNum}
                  data-page-num={pageNum}
                  ref={(el) => {
                    if (el) pageRefs.current.set(pageNum, el);
                    else pageRefs.current.delete(pageNum);
                  }}
                  className="bg-white dark:bg-zinc-950 shadow-[0_1px_4px_rgba(0,0,0,0.08)] border border-[#dadce0] dark:border-zinc-700/50"
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
                        <Loader2 className="size-5 animate-spin text-[#3370ff]/40" />
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          </Document>
        )}

        {/* Floating "Ask AI" menu */}
        {showFloatingMenu && selectedText && (
          <div
            className="pdf-floating-ask-ai absolute z-50 flex items-center gap-1 bg-[#202222] text-white dark:bg-white dark:text-[#202222] px-2.5 py-1.5 rounded-lg shadow-[0_6px_16px_rgba(32,34,34,0.16)] border border-white/10 dark:border-[#dadce0]"
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
              <Sparkles className="size-3.5 text-[#3370ff]" />
              Ask AI
            </button>
            <div className="w-px h-3.5 bg-white/20 dark:bg-[#dadce0] mx-1" />
            <button
              onClick={() => setShowFloatingMenu(false)}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
