import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Sparkles, X, ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";
import PdfViewerToolbar from "./PdfViewerToolbar";

// Import react-pdf styles for text layer and annotation layer
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
  filename: string;
  onAskAi: (selectedText: string) => void;
}

export default function PdfViewer({ url, filename, onAskAi }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Fetch PDF file as Blob using authenticated request to bypass session credentials issues
  useEffect(() => {
    let active = true;
    let currentBlobUrl: string | null = null;

    async function loadPdf() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF (${response.status})`);
        }

        const blob = await response.blob();
        if (active) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          console.error("Error loading PDF blob:", err);
          setError(err.message || "Failed to load PDF file.");
          setLoading(false);
        }
      }
    }

    if (url) {
      loadPdf();
    }

    return () => {
      active = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [url]);

  // Text selection floating menu state
  const [selectedText, setSelectedText] = useState<string>("");
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  // Dynamically calculate container width for "Fit Width" zoom setting
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.getBoundingClientRect().width);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error("PDF loading error:", err);
    setError("Failed to render PDF. Please verify the file is not corrupted or try downloading it.");
    setLoading(false);
  };

  // Monitor text selection to show/hide "Ask AI" floating action menu
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    if (text && pdfWrapperRef.current?.contains(selection.anchorNode)) {
      setSelectedText(text);

      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();

        if (containerRect) {
          // Position menu above selection center
          setMenuPosition({
            top: rect.top - containerRect.top - 46 + (containerRef.current.scrollTop || 0),
            left: rect.left - containerRect.left + rect.width / 2,
          });
          setShowFloatingMenu(true);
        }
      } catch (e) {
        // Fallback for range extraction errors
        setShowFloatingMenu(false);
      }
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Hide menu if user clicks elsewhere (excluding floating menu click itself)
    const target = e.target as HTMLElement;
    if (!target.closest(".pdf-floating-ask-ai")) {
      setShowFloatingMenu(false);
    }
  }, []);

  // Keyboard navigation for PDF pages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Ignore inside input fields
      }
      if (e.key === "ArrowLeft") {
        setPageNumber((prev) => Math.max(1, prev - 1));
      } else if (e.key === "ArrowRight") {
        setPageNumber((prev) => (numPages ? Math.min(numPages, prev + 1) : prev));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [numPages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-w-0 h-full bg-zinc-100 dark:bg-zinc-900 overflow-hidden relative"
      onMouseDown={handleMouseDown}
    >
      <PdfViewerToolbar
        pageNumber={pageNumber}
        numPages={numPages}
        zoom={zoom}
        onPageChange={setPageNumber}
        onZoomChange={(z) => {
          setZoom(z);
          setFitWidth(false);
        }}
        onFitWidth={() => setFitWidth(true)}
        downloadUrl={blobUrl || url}
        filename={filename}
        loading={loading}
      />

      {/* PDF Pages View Area */}
      <div 
        ref={pdfWrapperRef}
        onMouseUp={handleMouseUp}
        className="flex-1 overflow-auto p-6 flex flex-col items-center relative select-text"
      >
        {error ? (
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-md my-auto gap-3">
            <AlertTriangle className="size-10 text-destructive animate-bounce" />
            <p className="text-sm font-semibold text-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              You can download the paper directly using the toolbar to view it in an external PDF reader.
            </p>
          </div>
        ) : loading || !blobUrl ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3 my-auto">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground animate-pulse">Loading paper pages...</p>
          </div>
        ) : (
          <div className="shadow-lg border border-border bg-white dark:bg-zinc-950 rounded-sm relative">
            <Document
              file={blobUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex flex-col items-center justify-center p-20 gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground animate-pulse">Loading paper pages...</p>
                </div>
              }
            >
              <Page
                pageNumber={pageNumber}
                scale={fitWidth ? undefined : zoom}
                width={fitWidth ? Math.max(320, containerWidth - 48) : undefined}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={
                  <div className="flex items-center justify-center p-16">
                    <Loader2 className="size-6 animate-spin text-primary/45" />
                  </div>
                }
              />
            </Document>
          </div>
        )}

        {/* Floating Menu for "Ask Flux AI" about selected text */}
        {showFloatingMenu && selectedText && (
          <div
            className="pdf-floating-ask-ai absolute z-50 flex items-center gap-1 bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950 px-2.5 py-1.5 rounded-lg shadow-xl animate-in scale-in duration-100 ease-out border border-zinc-700/30"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              transform: "translateX(-50%)",
            }}
            onMouseUp={(e) => e.stopPropagation()} // Prevent resetting selection on click
          >
            <button
              onClick={() => {
                onAskAi(selectedText);
                setShowFloatingMenu(false);
                // Clear selection
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-85 transition-opacity"
            >
              <Sparkles className="size-3.5 text-blue-400" />
              Ask AI about selection
            </button>
            <div className="w-px h-3.5 bg-zinc-700 dark:bg-zinc-300 mx-1" />
            <button
              onClick={() => setShowFloatingMenu(false)}
              className="hover:opacity-75"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {numPages && (
        <div className="h-6 shrink-0 border-t border-border bg-card flex items-center justify-between px-4 text-[10px] text-muted-foreground select-none">
          <span className="font-medium truncate pr-4">Document: {filename}</span>
          <span className="font-mono">Page {pageNumber} of {numPages}</span>
        </div>
      )}
    </div>
  );
}
