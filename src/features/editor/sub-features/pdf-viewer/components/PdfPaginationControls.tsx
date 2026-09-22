'use client';

/**
 * PdfPaginationControls.tsx
 *
 * Page navigation controls for PDF viewing:
 * - Previous / Next page buttons
 * - Direct page number input
 * - Total page count indicator
 */

import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';

export interface PdfPaginationControlsProps {
  pageNumber: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage?: (page: number) => void;
}

export const PdfPaginationControls = React.memo(function PdfPaginationControls({
  pageNumber,
  numPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
}: PdfPaginationControlsProps) {
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
    <div className="flex items-center gap-1 select-none">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onPrevPage}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronUp className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Previous page
        </TooltipContent>
      </Tooltip>

      <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
        <input
          type="text"
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handlePageCommit();
            if (e.key === 'Escape') setInputPage(String(pageNumber));
          }}
          onBlur={handlePageCommit}
          className="w-8 h-6 text-center text-xs font-mono bg-muted/60 border border-border rounded-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label="Current page number"
        />
        <span>/ {numPages || 1}</span>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onNextPage}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
            className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronDown className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Next page
        </TooltipContent>
      </Tooltip>
    </div>
  );
});
