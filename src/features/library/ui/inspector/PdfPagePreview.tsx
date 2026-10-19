"use client";

import React, { useState, useRef, useEffect } from "react";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page } from "react-pdf";
import {
  setupPdfWorker,
  getSharedPdfDocumentOptions,
  getCappedDevicePixelRatio,
  releaseCanvasMemory,
} from "@/shared/lib/pdfjs-worker";
import { usePdf } from "@/features/library/ui/reader/hooks/use-pdf";
import type { Item } from "@/features/library/domain/types/library.types";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();

export interface PdfPagePreviewProps {
  paper: Item;
  paperUrl: string;
  onOpenReader: () => void;
}

export function PdfPagePreview({
  paperUrl,
  onOpenReader,
}: PdfPagePreviewProps) {
  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: retryPdf,
  } = usePdf(paperUrl || null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<{
    cleanup?: () => Promise<void> | void;
    destroy?: () => Promise<void> | void;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(280);

  useEffect(() => {
    return () => {
      if (pageCanvasRef.current) {
        pageCanvasRef.current.width = 0;
        pageCanvasRef.current.height = 0;
        pageCanvasRef.current = null;
      }
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      void doc?.cleanup?.();
      void doc?.destroy?.();
    };
  }, [paperUrl, pdfBlobUrl]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const updateWidth = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (previewRef.current) {
          const w = Math.floor(previewRef.current.getBoundingClientRect().width);
          if (w > 0) {
            setContainerWidth((prev) => (Math.abs(prev - w) >= 4 ? w : prev));
          }
        }
      });
    };
    updateWidth();
    const obs = new ResizeObserver(updateWidth);
    obs.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      obs.disconnect();
      if (pageCanvasRef.current) {
        pageCanvasRef.current.width = 0;
        pageCanvasRef.current.height = 0;
        pageCanvasRef.current = null;
      }
      releaseCanvasMemory(el);
    };
  }, []);

  return (
    <div
      ref={previewRef}
      onClick={onOpenReader}
      className="relative w-full rounded-md border border-border bg-background overflow-hidden shadow-none flex flex-col items-center justify-center min-h-[220px] cursor-pointer group"
    >
      {pdfLoading ? (
        <div className="h-60 flex flex-col items-center justify-center gap-2 text-foreground">
          <Loader2 className="size-5 animate-spin text-foreground shrink-0" />
          <span className="text-xs font-medium">Loading document...</span>
        </div>
      ) : pdfBlobUrl ? (
        <Document
          file={pdfBlobUrl}
          options={SHARED_PDF_OPTIONS}
          onLoadSuccess={(doc) => {
            pdfDocRef.current = doc;
            setNumPages(doc.numPages);
            setCurrentPage(1);
          }}
          loading={
            <div className="h-60 flex flex-col items-center justify-center gap-2 text-foreground">
              <Loader2 className="size-5 animate-spin text-foreground shrink-0" />
              <span className="text-xs font-medium">Loading preview...</span>
            </div>
          }
          error={
            <div className="h-60 flex flex-col items-center justify-center p-4 text-center text-xs text-foreground">
              <span>Document preview unavailable</span>
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            width={Math.max(200, containerWidth)}
            devicePixelRatio={getCappedDevicePixelRatio(1.5)}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            canvasRef={(node) => {
              if (node) {
                pageCanvasRef.current = node;
              } else if (pageCanvasRef.current) {
                pageCanvasRef.current.width = 0;
                pageCanvasRef.current.height = 0;
                pageCanvasRef.current = null;
              }
            }}
          />
        </Document>
      ) : (
        <div className="h-60 flex flex-col items-center justify-center gap-2 px-4 text-center text-xs text-foreground">
          <span>{pdfError || "Preview unavailable"}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              retryPdf();
            }}
            className="h-7 px-2.5 rounded-md border border-border text-foreground hover:bg-muted"
          >
            Retry preview
          </button>
        </div>
      )}

      {/* Navigation Arrows: [<] [>] floating at bottom center */}
      {numPages > 1 && (
        <div
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage((p) => Math.max(1, p - 1));
            }}
            aria-label="Previous page"
            className="size-7 rounded-md bg-background border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer shadow-xs transition-colors"
          >
            <ChevronLeft className="size-4 shrink-0" />
          </button>
          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage((p) => Math.min(numPages, p + 1));
            }}
            aria-label="Next page"
            className="size-7 rounded-md bg-background border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer shadow-xs transition-colors"
          >
            <ChevronRight className="size-4 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}

export default PdfPagePreview;
