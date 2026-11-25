'use client';

/**
 * PdfToolbar.tsx
 *
 * Scoped Viewer Toolbar for PDF Preview (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/compiler/ui/PdfToolbar.tsx`
 *
 * Unified PDF viewer header toolbar (Overleaf parity):
 * - Left: Compile Button (with options dropdown), Logs and output files, Download PDF
 * - Right: Page Pagination, Zoom Controls
 */

import React, { useRef, useState, useEffect } from 'react';
import { FileText, Download } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { CompileButton } from './CompileButton';
import { PdfPaginationControls } from './PdfPaginationControls';
import { PdfZoomControls } from './PdfZoomControls';

export interface PdfToolbarProps {
  onCompile: () => void;
  onClearCacheAndCompile?: () => void;
  onStopCompilation?: () => void;

  // Zoom
  scale: number;
  autoFit: boolean;
  fitMode?: 'width' | 'height' | 'auto';
  onToggleAutoFit: () => void;
  onSetFitMode?: (mode: 'width' | 'height' | 'auto') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSetScale?: (scale: number) => void;

  // Pages
  pageNumber?: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage?: (page: number) => void;

  // Actions
  pdfUrl?: string | null;
  showLog?: boolean;
  onToggleLog?: () => void;
  onDownload?: () => void;
  errorCount?: number;
  warningCount?: number;
  isDetached?: boolean;
}

export const PdfToolbar = React.memo(function PdfToolbar({
  onCompile,
  onClearCacheAndCompile,
  onStopCompilation,
  scale,
  autoFit,
  fitMode,
  onToggleAutoFit,
  onSetFitMode,
  onZoomIn,
  onZoomOut,
  onSetScale,
  pageNumber,
  numPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  pdfUrl = null,
  showLog = false,
  onToggleLog,
  onDownload,
  errorCount = 0,
  warningCount = 0,
  isDetached = false,
}: PdfToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(800);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const initialWidth = el.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setToolbarWidth(initialWidth);
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setToolbarWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep zoom scale controls visible unless viewport is extremely narrow (< 340px)
  const collapseScale = toolbarWidth < 340;

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="PDF viewer controls"
      className="h-9 bg-surface px-2 flex items-center justify-between gap-1.5 shrink-0 select-none border-b border-border overflow-x-auto overflow-y-hidden scrollbar-none"
    >
      {/* 1. Left section: Compilation & Download actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {!isDetached && (
          <>
            <CompileButton
              onCompile={onCompile}
              onClearCacheAndCompile={onClearCacheAndCompile}
              onStopCompilation={onStopCompilation}
            />

            {/* Overleaf Logs and output files */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleLog}
                  aria-label={
                    errorCount > 0
                      ? `Logs and output files (${errorCount} error${errorCount > 1 ? 's' : ''})`
                      : warningCount > 0
                        ? `Logs and output files (${warningCount} warning${warningCount > 1 ? 's' : ''})`
                        : 'Logs and output files'
                  }
                  className={cn(
                    'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-[\'\']',
                    showLog
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <FileText className="size-3.5 shrink-0" />
                  {errorCount > 0 ? (
                    <span
                      data-testid="compiler-error-badge"
                      className="absolute -top-0.5 -right-0.5 flex min-w-3.5 h-3.5 px-1 items-center justify-center rounded-full text-[10px] font-mono font-semibold bg-destructive text-destructive-foreground leading-none animate-in zoom-in-50 duration-100"
                    >
                      {errorCount > 99 ? '99+' : errorCount}
                    </span>
                  ) : warningCount > 0 ? (
                    <span
                      data-testid="compiler-warning-badge"
                      className="absolute -top-0.5 -right-0.5 flex min-w-3.5 h-3.5 px-1 items-center justify-center rounded-full text-[10px] font-mono font-semibold bg-warning text-warning-foreground leading-none animate-in zoom-in-50 duration-100"
                    >
                      {warningCount > 99 ? '99+' : warningCount}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="text-xs">
                {showLog
                  ? 'Back to PDF'
                  : errorCount > 0
                    ? `Logs (${errorCount} error${errorCount > 1 ? 's' : ''})`
                    : warningCount > 0
                      ? `Logs (${warningCount} warning${warningCount > 1 ? 's' : ''})`
                      : 'Logs'}
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Overleaf Download PDF (Pure icon button with tooltip) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onDownload}
              disabled={!pdfUrl}
              aria-label="Download PDF"
              className="size-7 relative flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-['']"
            >
              <Download className="size-3.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            Download PDF
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 2. Right section (Overleaf Order): Pagination -> Zoom */}
      <div className="flex items-center gap-1 shrink-0 select-none">
        {/* 2.1 Pagination Controls (^ v [ 1 ] / N) */}
        <PdfPaginationControls
          pageNumber={pageNumber}
          numPages={numPages}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
          onJumpToPage={onJumpToPage}
          className="px-0.5"
        />

        {/* 2.2 Zoom Controls: always visible unless extremely narrow (< 340px) */}
        {!collapseScale && (
          <>
            <div className="h-4 w-px bg-border/60 mx-0.5 shrink-0" aria-hidden="true" />
            <PdfZoomControls
              scale={scale}
              autoFit={autoFit}
              fitMode={fitMode}
              compact={toolbarWidth < 460}
              onToggleAutoFit={onToggleAutoFit}
              onSetFitMode={onSetFitMode}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onSetScale={onSetScale}
            />
          </>
        )}
      </div>
    </div>
  );
});

export default PdfToolbar;
