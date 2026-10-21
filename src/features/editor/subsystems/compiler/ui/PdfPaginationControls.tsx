'use client';

/**
 * PdfPaginationControls.tsx
 *
 * Page navigation controls for PDF viewing (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PdfPaginationControls.tsx`
 */

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useViewerStore, type DocumentViewerState } from '@/features/editor/subsystems/compiler/coordinator/viewer.store';

export interface PdfPaginationControlsProps {
  pageNumber?: number;
  numPages?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  onJumpToPage?: (page: number) => void;
  className?: string;
}

export const PdfPaginationControls = React.memo(function PdfPaginationControls({
  pageNumber: propPageNumber,
  numPages: propNumPages,
  onPrevPage: propOnPrevPage,
  onNextPage: propOnNextPage,
  onJumpToPage: propOnJumpToPage,
  className,
}: PdfPaginationControlsProps) {
  const storePageNumber = useViewerStore((s: DocumentViewerState) => s.pageNumber);
  const storeNumPages = useViewerStore((s: DocumentViewerState) => s.numPages);
  const storePrevPage = useViewerStore((s: DocumentViewerState) => s.prevPage);
  const storeNextPage = useViewerStore((s: DocumentViewerState) => s.nextPage);
  const storeSetPage = useViewerStore((s: DocumentViewerState) => s.setPageNumber);

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
    <div className={cn("flex items-center gap-1.5 select-none shrink-0", className)}>
      {/* 1. Prev page [<] */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onPrevPage}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border shrink-0 relative after:absolute after:-inset-1.5 after:content-['']"
          >
            <ChevronLeft className="size-3.5 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>Previous page</TooltipContent>
      </Tooltip>

      {/* 2. Direct page input */}
      <div className="flex items-center gap-1.5 text-xs shrink-0 whitespace-nowrap">
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
          className="w-9 h-7 text-center rounded-md border border-border bg-sidebar text-foreground text-xs font-medium focus:bg-background focus:outline-none focus:ring-1 focus:ring-border tabular-nums shrink-0"
        />
        <span className="text-muted-foreground font-mono text-xs whitespace-nowrap shrink-0 pr-1 select-none">
          / {numPages || 1}
        </span>
      </div>

      {/* 3. Next page [>] */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onNextPage}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
            className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border shrink-0 relative after:absolute after:-inset-1.5 after:content-['']"
          >
            <ChevronRight className="size-3.5 shrink-0" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>Next page</TooltipContent>
      </Tooltip>
    </div>
  );
});
