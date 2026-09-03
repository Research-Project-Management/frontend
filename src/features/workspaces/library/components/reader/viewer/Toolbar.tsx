'use client';

import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

interface PdfViewerToolbarProps {
  pageNumber: number;
  numPages: number | null;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  loading: boolean;
}

export default function PdfViewerToolbar({
  pageNumber,
  numPages,
  zoom,
  onPageChange,
  onZoomChange,
  onFitWidth,
  loading,
}: PdfViewerToolbarProps) {
  const [inputVal, setInputVal] = useState(String(pageNumber));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputVal(String(pageNumber));
    }
  }, [pageNumber, isFocused]);

  const commitPage = (valStr: string) => {
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val >= 1 && numPages && val <= numPages) {
      onPageChange(val);
      setInputVal(String(val));
    } else {
      setInputVal(String(pageNumber));
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
      commitPage(inputVal);
    } else if (e.key === "Escape") {
      setInputVal(String(pageNumber));
      e.currentTarget.blur();
    }
  };

  const handleZoomOut = () => {
    const nextZoom = Number(Math.max(0.5, zoom - 0.1).toFixed(2));
    onZoomChange(nextZoom);
  };

  const handleZoomIn = () => {
    const nextZoom = Number(Math.min(3.0, zoom + 0.1).toFixed(2));
    onZoomChange(nextZoom);
  };

  return (
    <TooltipProvider delayDuration={700}>
      <div className="pointer-events-auto flex select-none items-center gap-2 rounded-md border border-border/60 bg-background/95 px-3 py-1 backdrop-blur-md transition-colors shadow-none">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-foreground hover:bg-muted rounded-sm cursor-pointer"
                disabled={pageNumber <= 1 || loading}
                onClick={() => onPageChange(pageNumber - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5 text-foreground shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Previous page (K / ↑)</TooltipContent>
          </Tooltip>

          <div className="flex items-center gap-1.5">
            <Input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                commitPage(inputVal);
              }}
              onKeyDown={handlePageInputKeyDown}
              disabled={loading || !numPages}
              aria-label="Current page"
              className="h-6 w-11 px-1 text-center font-mono text-xs tabular-nums text-foreground focus-visible:ring-1 rounded-sm"
            />
            <span className="pr-1 text-xs font-mono tabular-nums font-medium text-foreground">
              / {numPages ?? "-"}
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-foreground hover:bg-muted rounded-sm cursor-pointer"
                disabled={numPages ? pageNumber >= numPages || loading : true}
                onClick={() => onPageChange(pageNumber + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5 text-foreground shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Next page (J / ↓)</TooltipContent>
          </Tooltip>
        </div>

        <div className="mx-0.5 h-4 w-px bg-border/60" />

        {/* Zoom and fit controls */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-foreground hover:bg-muted rounded-sm cursor-pointer"
                disabled={zoom <= 0.5 || loading}
                onClick={handleZoomOut}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-3.5 text-foreground shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Zoom out (Ctrl -)</TooltipContent>
          </Tooltip>

          <span className="min-w-[3rem] text-center font-mono text-xs font-medium tabular-nums text-foreground">
            {Math.round(zoom * 100)}%
          </span>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-foreground hover:bg-muted rounded-sm cursor-pointer"
                disabled={zoom >= 3.0 || loading}
                onClick={handleZoomIn}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-3.5 text-foreground shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Zoom in (Ctrl +)</TooltipContent>
          </Tooltip>

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-foreground hover:bg-muted rounded-sm cursor-pointer"
                onClick={onFitWidth}
                disabled={loading}
                aria-label="Fit width"
              >
                <Maximize2 className="size-3.5 text-foreground shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Fit width (Ctrl 0)</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
