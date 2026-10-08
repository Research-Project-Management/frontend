'use client';

/**
 * PdfPaginationControls.tsx
 *
 * Page navigation controls for PDF viewing (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PdfPaginationControls.tsx`
 */

import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Minus, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useViewerStore } from '../../../store/viewer.store';

export interface PdfPaginationControlsProps {
  pageNumber?: number;
  numPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onJumpToPage?: (page: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  className?: string;
}

export const PdfPaginationControls = React.memo(function PdfPaginationControls({
  pageNumber: propPageNumber,
  numPages: propNumPages,
  onPrevPage: propOnPrevPage,
  onNextPage: propOnNextPage,
  onJumpToPage: propOnJumpToPage,
  onZoomIn,
  onZoomOut,
  className,
}: PdfPaginationControlsProps) {
  const storePageNumber = useViewerStore((s) => s.pageNumber);
  const storeNumPages = useViewerStore((s) => s.numPages);
  const storePrevPage = useViewerStore((s) => s.prevPage);
  const storeNextPage = useViewerStore((s) => s.nextPage);
  const storeSetPage = useViewerStore((s) => s.setPageNumber);

  const pageNumber = propPageNumber ?? storePageNumber;
  const numPages = propNumPages ?? storeNumPages;
  const onPrevPage = propOnPrevPage ?? storePrevPage;
  const onNextPage = propOnNextPage ?? storeNextPage;
  const onJumpToPage = propOnJumpToPage ?? storeSetPage;

  const [inputPage, setInputPage] = useState(String(pageNumber));

  useEffect(() => {
    setInputPage(String(pageNumber));
  }, [pageNumber]);

  const handlePageCommit = () => {
    const p = parseInt(inputPage, 10);
    if (!isNaN(p) && p >= 1 && p <= numPages && onJumpToPage) {
      onJumpToPage(p);
    } else {
      setInputPage(String(pageNumber));
    }
  };

  return (
    <div className={cn("flex items-center gap-1 select-none", className)}>
      {/* 1. Prev page [^] */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onPrevPage}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ChevronUp className="size-4 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>Previous page</TooltipContent>
      </Tooltip>

      {/* 2. Direct page input */}
      <div className="flex items-center gap-1 text-xs">
        <input
          type="text"
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handlePageCommit();
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={handlePageCommit}
          aria-label="Current page number"
          className="w-10 h-7 text-center rounded-md border border-border bg-sidebar text-foreground text-xs font-medium focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <span className="text-muted-foreground font-mono">/ {numPages || 1}</span>
      </div>

      {/* 3. Next page [v] */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onNextPage}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
            className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ChevronDown className="size-4 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>Next page</TooltipContent>
      </Tooltip>
    </div>
  );
});
