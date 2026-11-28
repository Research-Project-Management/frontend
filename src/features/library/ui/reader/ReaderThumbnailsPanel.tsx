'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ListTree, LayoutGrid, Highlighter, ChevronRight, RotateCw, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { setupPdfWorker, getSharedPdfDocumentOptions, isPdfDocumentValid } from '@/shared/lib/pdfjs-worker';
import { cn } from '@/shared/lib/utils';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/shared/components/ui/context-menu';
import type { FlattenedOutlineSection } from '@/features/library/domain/reader/search-outline';

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();

export const LazyThumbnailPage = React.memo(function LazyThumbnailPage({
  pageNum,
  isCurrent,
  showPdfCanvas = true,
  pdfDocument,
  onJumpToPage,
  onRotatePageRight,
  onRotatePageLeft,
}: {
  pageNum: number;
  isCurrent: boolean;
  showPdfCanvas?: boolean;
  pdfDocument?: unknown;
  onJumpToPage: (page: number) => void;
  onRotatePageRight?: (page: number) => void;
  onRotatePageLeft?: (page: number) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "relative flex flex-col items-center p-1 rounded-md border transition-colors group overflow-hidden select-none",
            isCurrent
              ? "border-primary bg-muted/40"
              : "border-border hover:border-border/80 bg-card",
          )}
        >
          <button
            type="button"
            onClick={() => onJumpToPage(pageNum)}
            className="w-full flex flex-col items-center cursor-pointer outline-none"
          >
            <div className="w-full aspect-[1/1.4] rounded-sm bg-background border border-border overflow-hidden flex items-center justify-center">
              {showPdfCanvas && isPdfDocumentValid(pdfDocument) ? (
                <Page
                  pdf={isPdfDocumentValid(pdfDocument) ? (pdfDocument as never) : undefined}
                  pageNumber={pageNum}
                  width={100}
                  devicePixelRatio={1}
                  canvasBackground="#fcfcfb"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadError={() => {}}
                  loading={
                    <div className="size-full flex items-center justify-center text-foreground text-11 font-mono">
                      {pageNum}
                    </div>
                  }
                />
              ) : (
                <div className="size-full flex items-center justify-center text-muted-foreground text-11 font-mono tabular-nums">
                  {pageNum}
                </div>
              )}
            </div>
            <span
              className={cn(
                "text-11 font-mono tabular-nums mt-1",
                isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              Page {pageNum}
            </span>
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 text-12">
        {onRotatePageRight && (
          <ContextMenuItem
            onClick={() => onRotatePageRight(pageNum)}
            className="cursor-pointer gap-2"
          >
            <RotateCw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Rotate Page Right</span>
          </ContextMenuItem>
        )}
        {onRotatePageLeft && (
          <ContextMenuItem
            onClick={() => onRotatePageLeft(pageNum)}
            className="cursor-pointer gap-2"
          >
            <RotateCcw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Rotate Page Left</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

export interface ThumbnailsViewProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  totalPages: number;
  currentPage: number;
  isEnabled: boolean;
  pdfDocument?: unknown;
  pdfBlobUrl?: string | null;
  onJumpToPage: (page: number) => void;
  onRotatePageRight?: (page: number) => void;
  onRotatePageLeft?: (page: number) => void;
}

export function ThumbnailsView({
  scrollContainerRef,
  totalPages,
  currentPage,
  isEnabled,
  pdfDocument,
  pdfBlobUrl,
  onJumpToPage,
  onRotatePageRight,
  onRotatePageLeft,
}: ThumbnailsViewProps) {
  const thumbPdfDocRef = useRef<{ cleanup?: () => Promise<void> | void } | null>(
    null,
  );

  const [loadedThumbPdfDoc, setLoadedThumbPdfDoc] = React.useState<unknown>(null);

  useEffect(() => {
    setLoadedThumbPdfDoc(null);
    return () => {
      try {
        void thumbPdfDocRef.current?.cleanup?.();
      } catch {
        // Ignore cleanup errors on unmount
      }
      thumbPdfDocRef.current = null;
    };
  }, [pdfBlobUrl]);

  const pageNumbers = useMemo(() => {
    return Array.from({ length: Math.max(0, totalPages) }, (_, i) => i + 1);
  }, [totalPages]);

  const numRows = Math.ceil(pageNumbers.length / 2);
  const thumbVirtualizer = useVirtualizer({
    count: numRows,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 196,
    overscan: 4,
    enabled: isEnabled,
  });

  const validSharedDoc = isPdfDocumentValid(pdfDocument) ? pdfDocument : null;
  const validThumbDoc = isPdfDocumentValid(loadedThumbPdfDoc) ? loadedThumbPdfDoc : null;
  const effectivePdfDoc = validSharedDoc || validThumbDoc;
  const hasSharedPdfDoc = Boolean(validSharedDoc);
  const showPdfCanvas = Boolean(effectivePdfDoc);

  useEffect(() => {
    if (hasSharedPdfDoc && thumbPdfDocRef.current) {
      try {
        void thumbPdfDocRef.current.cleanup?.();
      } catch {
        // Ignore cleanup errors when transitioning to shared PdfDocument
      }
      thumbPdfDocRef.current = null;
      setLoadedThumbPdfDoc(null);
    }
  }, [hasSharedPdfDoc]);

  if (totalPages === 0) {
    return (
      <PlaneEmptyState
        variant="document"
        title="No pages found"
        description="Unable to detect pages for thumbnail rendering."
        isCompact
      />
    );
  }

  const gridElement = (
    <div
      className="relative w-full p-1"
      style={{ height: `${thumbVirtualizer.getTotalSize()}px` }}
    >
      {thumbVirtualizer.getVirtualItems().map((virtualRow) => {
        const p1 = pageNumbers[virtualRow.index * 2];
        const p2 = pageNumbers[virtualRow.index * 2 + 1] ?? null;
        if (p1 === undefined) return null;
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={thumbVirtualizer.measureElement}
            className="absolute top-0 left-0 w-full grid grid-cols-2 gap-2 pb-2"
            style={{
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <LazyThumbnailPage
              pageNum={p1}
              isCurrent={p1 === currentPage}
              showPdfCanvas={showPdfCanvas}
              pdfDocument={effectivePdfDoc}
              onJumpToPage={onJumpToPage}
              onRotatePageRight={onRotatePageRight}
              onRotatePageLeft={onRotatePageLeft}
            />
            {p2 !== null && (
              <LazyThumbnailPage
                pageNum={p2}
                isCurrent={p2 === currentPage}
                showPdfCanvas={showPdfCanvas}
                pdfDocument={effectivePdfDoc}
                onJumpToPage={onJumpToPage}
                onRotatePageRight={onRotatePageRight}
                onRotatePageLeft={onRotatePageLeft}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  if (hasSharedPdfDoc && validSharedDoc) {
    return gridElement;
  }

  return pdfBlobUrl ? (
    <Document
      key={pdfBlobUrl}
      file={pdfBlobUrl}
      options={SHARED_PDF_OPTIONS}
      onLoadSuccess={(doc) => {
        thumbPdfDocRef.current = doc;
        setLoadedThumbPdfDoc(doc);
      }}
      onLoadError={() => {
        setLoadedThumbPdfDoc(null);
      }}
      loading={
        <div className="grid grid-cols-2 gap-3 p-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="aspect-[3/4] w-full rounded-sm" />
              <Skeleton className="h-2.5 w-8 mx-auto rounded-sm" />
            </div>
          ))}
        </div>
      }
      error={
        <PlaneErrorState
          title="Unable to load thumbnails"
          error="Failed to render PDF page previews."
        />
      }
    >
      {gridElement}
    </Document>
  ) : (
    gridElement
  );
}
