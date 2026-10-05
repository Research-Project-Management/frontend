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
import { ChevronUp, ChevronDown, Minus, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export interface PdfPaginationControlsProps {
  pageNumber: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage?: (page: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  className?: string;
}

export const PdfPaginationControls = React.memo(function PdfPaginationControls({
  pageNumber,
  numPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  onZoomIn,
  onZoomOut,
  className,
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
    <div className={cn("flex items-center gap-1 select-none", className)}>
      {/* 1. Prev page [^] */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onPrevPage}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            className="size-6 relative flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-2 after:content-['']"
          >
            <ChevronUp className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Previous page
        </TooltipContent>
      </Tooltip>

      {/* 2. Next page [v] */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onNextPage}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
            className="size-6 relative flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-2 after:content-['']"
          >
            <ChevronDown className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Next page
        </TooltipContent>
      </Tooltip>

      {/* 3. Page input [ 1 ] / N */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono tabular-nums">
        <input
          type="text"
          role="spinbutton"
          aria-valuemin={1}
          aria-valuemax={numPages || 1}
          aria-valuenow={pageNumber}
          aria-label="Current page"
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handlePageCommit();
            if (e.key === 'Escape') setInputPage(String(pageNumber));
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (pageNumber > 1) {
                onPrevPage();
              }
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (pageNumber < (numPages || 1)) {
                onNextPage();
              }
            }
          }}
          onBlur={handlePageCommit}
          className="w-7 h-5 text-center text-xs font-mono tabular-nums bg-transparent border border-border/80 hover:border-border focus:border-primary rounded text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary shadow-none transition-colors"
        />
        <span className="tabular-nums">/ {numPages || 1}</span>
      </div>

      {/* Optional integrated zoom controls [-] [+] */}
      {onZoomOut && onZoomIn && (
        <>
          <div className="h-3.5 w-px bg-border/60 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onZoomOut}
                aria-label="Zoom out"
                className="size-6 relative flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-2 after:content-['']"
              >
                <Minus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Zoom out
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onZoomIn}
                aria-label="Zoom in"
                className="size-6 relative flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-2 after:content-['']"
              >
                <Plus className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Zoom in
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
});
