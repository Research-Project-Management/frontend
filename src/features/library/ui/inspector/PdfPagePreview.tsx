'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Document, Page } from 'react-pdf';
import { cn } from '@/shared/lib/utils';
import {
  setupPdfWorker,
  getSharedPdfDocumentOptions,
  getCappedDevicePixelRatio,
  releaseCanvasMemory,
} from '@/shared/lib/pdfjs-worker';
import { usePdf } from '@/features/library/core/coordinator/reader/use-reader';
import type { Item } from '@/features/library/types/core.types';

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();

export interface PdfPageCanvasProps {
  paperUrl: string;
  spaceId?: string;
}

export function PdfPageCanvas({
  paperUrl,
  spaceId,
}: PdfPageCanvasProps) {
  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: retryPdf,
  } = usePdf(paperUrl || null, spaceId);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [loadedBlobUrl, setLoadedBlobUrl] = useState<string | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<{
    cleanup?: () => Promise<void> | void;
    destroy?: () => Promise<void> | void;
  } | null>(null);
  const [ containerWidth, setContainerWidth ] = useState<number>(280);

  useEffect(() => {
    setLoadedBlobUrl(null);
    setNumPages(0);
    setCurrentPage(1);
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
    const el = canvasContainerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const updateWidth = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (canvasContainerRef.current) {
          const w = Math.floor(canvasContainerRef.current.getBoundingClientRect().width);
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
    <div ref={canvasContainerRef} className="relative w-full flex flex-col items-center justify-center min-h-[220px]">
      {pdfLoading ? (
        <div className="h-60 w-full rounded-md border border-border bg-card p-5 flex flex-col gap-3">
          <Skeleton className="h-4 w-2/3 rounded-sm mx-auto" />
          <Skeleton className="h-3 w-full rounded-sm" />
          <Skeleton className="h-3 w-5/6 rounded-sm" />
          <Skeleton className="h-3 w-full rounded-sm" />
          <Skeleton className="h-3 w-3/4 rounded-sm" />
        </div>
      ) : pdfBlobUrl ? (
        <Document
          key={pdfBlobUrl}
          file={pdfBlobUrl}
          options={SHARED_PDF_OPTIONS}
          onLoadSuccess={(doc) => {
            pdfDocRef.current = doc;
            setNumPages(doc.numPages);
            setCurrentPage(1);
            setLoadedBlobUrl(pdfBlobUrl);
          }}
          onLoadError={() => {
            setLoadedBlobUrl(null);
            setNumPages(0);
          }}
          loading={
            <div className="h-60 w-full rounded-md border border-border bg-card p-5 flex flex-col gap-3">
              <Skeleton className="h-4 w-2/3 rounded-sm mx-auto" />
              <Skeleton className="h-3 w-full rounded-sm" />
              <Skeleton className="h-3 w-5/6 rounded-sm" />
              <Skeleton className="h-3 w-full rounded-sm" />
              <Skeleton className="h-3 w-3/4 rounded-sm" />
            </div>
          }
          error={
            <div className="h-60 flex flex-col items-center justify-center p-4 text-center text-12 text-foreground">
              <span>Document preview unavailable</span>
            </div>
          }
        >
          {loadedBlobUrl === pdfBlobUrl && numPages > 0 && pdfDocRef.current ? (
            <Page
              pdf={pdfDocRef.current as never}
              pageNumber={Math.min(Math.max(1, currentPage), numPages)}
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
          ) : null}
        </Document>
      ) : (
        <div className="h-60 flex flex-col items-center justify-center gap-2 px-4 text-center text-12 text-foreground">
          <span>{pdfError || "Preview unavailable"}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              retryPdf();
            }}
            className="h-7 px-2.5 rounded-md border border-border text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            Retry preview
          </button>
        </div>
      )}

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
            className="size-7 rounded-md bg-background border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
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
            className="size-7 rounded-md bg-background border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronRight className="size-4 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}

export interface PdfPagePreviewProps {
  paper: Item;
  paperUrl: string;
  spaceId?: string | null;
  previewTitle?: string;
  onOpenReader: () => void;
}

export function PdfPagePreview({
  paper,
  paperUrl,
  spaceId,
  previewTitle,
  onOpenReader,
}: PdfPagePreviewProps) {
  const [previewRequested, setPreviewRequested] = useState(false);

  useEffect(() => {
    setPreviewRequested(false);
  }, [paperUrl, paper.id]);

  return (
    <div
      onClick={onOpenReader}
      className="relative w-full rounded-md border border-border bg-background overflow-hidden shadow-none flex flex-col items-center justify-center min-h-[220px] cursor-pointer group"
    >
      {!previewRequested ? (
        <div className="h-52 w-full flex flex-col items-center justify-center gap-2.5 px-4 text-center select-none">
          <div className="size-9 rounded-md border border-border bg-muted/60 flex items-center justify-center text-muted-foreground">
            <FileText className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          </div>
          <div className="space-y-0.5 max-w-[220px]">
            <p className="text-12 font-medium text-foreground truncate">
              {previewTitle || paper.filename || paper.title || "PDF Document"}
            </p>
            <p className="text-11 text-muted-foreground">
              Click to open in Reader or load page preview
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewRequested(true);
            }}
            className="h-7 px-2.5 rounded-md border border-border bg-background text-11 font-medium text-foreground hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Eye className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <span>Load Preview</span>
          </button>
        </div>
      ) : (
        <PdfPageCanvas
          key={paperUrl}
          paperUrl={paperUrl}
          spaceId={spaceId || paper.projectId || undefined}
        />
      )}
    </div>
  );
}
