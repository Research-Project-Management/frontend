'use client';

/**
 * PdfToolbar.tsx
 *
 * Unified PDF viewer header toolbar (Overleaf parity):
 * - Left: Compile Button (with options dropdown), Logs and output files, Download PDF
 * - Center: Page Pagination + Zoom Controls
 * - Right: Invert Colors, Spread View, Presentation Mode, Popout
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  Download,
  MoreHorizontal,
  BookOpen,
  Presentation,
  Minimize2,
  ExternalLink,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { CompileButton } from '../../compiler/components/CompileButton';
import { PdfPaginationControls } from './PdfPaginationControls';
import { PdfZoomControls } from './PdfZoomControls';
import type { CompileStatus } from '../../../store';

function InvertColorsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
      <path d="M12 22.7V2.7" />
      <path d="M12 22.7A8 8 0 0 0 17.66 8.35L12 2.69v20.01z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export interface PdfToolbarProps {
  compileStatus: CompileStatus;
  engine?: any;
  setEngine?: (e: any) => void;
  compileMode?: any;
  setCompileMode?: (m: any) => void;
  autoCompile?: boolean;
  onToggleAutoCompile?: () => void;
  onCompile: () => void;
  onClearCacheAndCompile?: () => void;
  onStopCompilation?: () => void;
  onForceSync?: () => void;

  // Zoom
  scale: number;
  autoFit: boolean;
  onToggleAutoFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
  onSetScale?: (scale: number) => void;
  showZoomGroup?: boolean;
  showUtilityGroup?: boolean;
  outline?: any;

  // Pages
  pageNumber: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpToPage?: (page: number) => void;

  // Display modes
  invertColors?: boolean;
  onToggleInvertColors?: () => void;
  isSpreadView?: boolean;
  onToggleSpreadView?: () => void;

  // Actions
  pdfUrl: string | null;
  compileLog?: string;
  showLog: boolean;
  onToggleLog: () => void;
  onDownload: () => void;
  onPopout?: () => void;
  isPoppedOut?: boolean;
  onOpenPresentationMode?: () => void;
  errorCount?: number;
  warningCount?: number;
}

export const PdfToolbar = React.memo(function PdfToolbar({
  compileStatus,
  onCompile,
  onClearCacheAndCompile,
  onStopCompilation,
  scale,
  autoFit,
  onToggleAutoFit,
  onZoomIn,
  onZoomOut,
  onSetScale,
  pageNumber,
  numPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  invertColors,
  onToggleInvertColors,
  pdfUrl,
  showLog,
  onToggleLog,
  onDownload,
  errorCount = 0,
  warningCount = 0,
}: PdfToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Only collapse pagination into 3-dots when viewer is narrow (< 370px)
        setIsCompact(entry.contentRect.width < 370);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="PDF viewer controls"
      className="relative h-9 bg-background px-2 flex items-center justify-between gap-1.5 shrink-0 select-none overflow-visible border-b border-border"
    >
      {/* 1. Left section: Compilation actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <CompileButton
          onCompile={onCompile}
          onClearCacheAndCompile={onClearCacheAndCompile}
          onStopCompilation={onStopCompilation}
        />

        {/* Overleaf Logs and output files (Pure icon button with tooltip) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleLog}
              aria-label="Logs and output files"
              className={cn(
                'size-7 relative flex items-center justify-center rounded-md text-xs font-semibold transition-colors cursor-pointer border select-none',
                showLog
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : errorCount > 0
                    ? 'border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20'
                    : warningCount > 0
                      ? 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <FileText className="size-3.5 shrink-0" />
              {errorCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-10 font-bold text-destructive-foreground shadow-xs">
                  {errorCount}
                </span>
              ) : warningCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-10 font-bold text-white shadow-xs">
                  {warningCount}
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {errorCount > 0
              ? `${errorCount} compilation error${errorCount > 1 ? 's' : ''}. Logs and output files`
              : warningCount > 0
                ? `${warningCount} warning${warningCount > 1 ? 's' : ''}. Logs and output files`
                : 'Logs and output files'}
          </TooltipContent>
        </Tooltip>

        {/* Overleaf Download PDF (Pure icon button with tooltip) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onDownload}
              disabled={!pdfUrl}
              aria-label="Download PDF"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer select-none"
            >
              <Download className="size-3.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Download PDF
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 2. Right section: Controls + adaptive 3-dot utility menu */}
      <div className="flex items-center gap-1 shrink-0 select-none">
        {/* Invert colors (Dark mode PDF) */}
        {onToggleInvertColors && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleInvertColors}
                aria-label={invertColors ? 'Normal PDF view' : 'Dark mode (Invert PDF colors)'}
                className={cn(
                  'size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer',
                  invertColors
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <InvertColorsIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {invertColors ? 'Normal PDF view' : 'Dark mode (Invert PDF colors)'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Wide state: Inline pagination + zoom buttons */}
        {!isCompact && (
          <PdfPaginationControls
            pageNumber={pageNumber}
            numPages={numPages}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
            onJumpToPage={onJumpToPage}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            className="px-0.5"
          />
        )}

        {/* Zoom preset dropdown: 61% ▾ / Fit Width ▾ */}
        <PdfZoomControls
          scale={scale}
          autoFit={autoFit}
          compact={true}
          onToggleAutoFit={onToggleAutoFit}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onSetScale={onSetScale}
        />

        {/* Shrunk state: [...] button appears only when compact (< 370px) and holds collapsed pagination/zoom controls */}
        {isCompact && (
          <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <Tooltip open={isMenuOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="More options"
                    className={cn(
                      'size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer',
                      isMenuOpen
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                More options
              </TooltipContent>
            </Tooltip>

            <PopoverContent
              align="end"
              sideOffset={6}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="w-auto p-1 bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50 text-xs"
            >
              <PdfPaginationControls
                pageNumber={pageNumber}
                numPages={numPages}
                onPrevPage={onPrevPage}
                onNextPage={onNextPage}
                onJumpToPage={onJumpToPage}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
});
