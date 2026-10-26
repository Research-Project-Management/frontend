'use client';

/**
 * PdfToolbar.tsx
 *
 * Scoped Viewer Toolbar for PDF Preview (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PdfToolbar.tsx`
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
  Minus,
  Plus,
  Search,
  Link2,
  Link2Off,
  ExternalLink,
  Check,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { editorCommandBus, getActiveEditorEngine } from '@/features/editor/core';
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
import { CompileButton } from './CompileButton';
import { PdfPaginationControls } from './PdfPaginationControls';
import { PdfZoomControls } from './PdfZoomControls';

function InvertColorsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
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

  // Display modes
  invertColors?: boolean;
  onToggleInvertColors?: () => void;
  isSpreadView?: boolean;
  onToggleSpreadView?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  syncScroll?: boolean;
  onToggleSyncScroll?: () => void;

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
  invertColors,
  onToggleInvertColors,
  isSpreadView,
  onToggleSpreadView,
  isSearchOpen,
  onToggleSearch,
  syncScroll = true,
  onToggleSyncScroll,
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuTooltipOpen, setMenuTooltipOpen] = useState(false);

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

  // Keep zoom scale controls visible unless viewport is extremely narrow (< 400px)
  const collapseScale = toolbarWidth < 400;
  // Hide SyncTeX & Search on toolbar when viewport is ultra narrow (< 360px)
  const isUltraCompact = toolbarWidth < 360;

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
                      className="absolute -top-1.5 -right-1.5 flex min-w-4 h-4 px-1 items-center justify-center rounded-full text-11 font-mono font-semibold bg-destructive text-destructive-foreground leading-none animate-in zoom-in-50 duration-100"
                    >
                      {errorCount > 99 ? '99+' : errorCount}
                    </span>
                  ) : warningCount > 0 ? (
                    <span
                      data-testid="compiler-warning-badge"
                      className="absolute -top-1.5 -right-1.5 flex min-w-4 h-4 px-1 items-center justify-center rounded-full text-11 font-mono font-semibold bg-warning text-warning-foreground leading-none animate-in zoom-in-50 duration-100"
                    >
                      {warningCount > 99 ? '99+' : warningCount}
                    </span>
                  ) : null}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {showLog
                  ? 'Back to PDF'
                  : errorCount > 0
                    ? `Logs and output files (${errorCount} error${errorCount > 1 ? 's' : ''})`
                    : warningCount > 0
                      ? `Logs and output files (${warningCount} warning${warningCount > 1 ? 's' : ''})`
                      : 'Logs and output files'}
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
              className="size-7 relative flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:cursor-not-allowed transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-['']"
            >
              <Download className="size-3.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Download PDF
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 2. Right section (Overleaf Order): SyncTeX -> Pagination -> Zoom -> Search -> Viewer Options (•••) */}
      <div className="flex items-center gap-1 shrink-0 select-none">
        {/* Symmetrical SyncTeX (Overleaf Parity: Backward & Forward) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                editorCommandBus.dispatch({
                  type: 'synctex:backward',
                  page: pageNumber || 1,
                });
              }}
              aria-label="Go to PDF location in code (Reverse Search)"
              className="size-7 relative flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-['']"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Go to PDF location in code (Reverse Search)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => {
                const engine = getActiveEditorEngine();
                const cursor = engine?.getCursorPosition?.() || { line: 1, column: 1 };
                editorCommandBus.dispatch({
                  type: 'synctex:forward',
                  line: cursor.line,
                  column: cursor.column,
                });
              }}
              aria-label="Go to code location in PDF (Forward Search)"
              className="size-7 relative flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-['']"
            >
              <ArrowRight className="size-3.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Go to code location in PDF (Forward Search)
          </TooltipContent>
        </Tooltip>

        {/* 2.1 Synchronized Scrolling / SyncTeX Toggle */}
        {!isUltraCompact && onToggleSyncScroll && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleSyncScroll}
                aria-label={syncScroll ? 'Disable synchronized scrolling' : 'Enable synchronized scrolling'}
                className={cn(
                  'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-[\'\']',
                  syncScroll
                    ? 'text-primary hover:bg-muted font-medium'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {syncScroll ? (
                  <Link2 className="size-3.5 shrink-0" />
                ) : (
                  <Link2Off className="size-3.5 shrink-0" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {syncScroll ? 'Disable synchronized scrolling' : 'Enable synchronized scrolling'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* 2.2 Pagination Controls (< [ 1 ] / N >) */}
        <PdfPaginationControls
          pageNumber={pageNumber}
          numPages={numPages}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
          onJumpToPage={onJumpToPage}
          className="px-0.5"
        />

        {/* 2.3 Zoom Controls: always visible on toolbar unless extremely small (< 400px) */}
        {!collapseScale && (
          <PdfZoomControls
            scale={scale}
            autoFit={autoFit}
            fitMode={fitMode}
            compact={toolbarWidth < 560}
            onToggleAutoFit={onToggleAutoFit}
            onSetFitMode={onSetFitMode}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onSetScale={onSetScale}
          />
        )}

        {/* 2.4 Find in document (Ctrl+F) */}
        {!isUltraCompact && onToggleSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleSearch}
                disabled={!pdfUrl}
                aria-label="Find in document (Ctrl+F)"
                className={cn(
                  'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed after:absolute after:-inset-1.5 after:content-[\'\']',
                  isSearchOpen
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <Search className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Find in document (Ctrl+F)
            </TooltipContent>
          </Tooltip>
        )}

        {/* 2.5 Viewer Options Menu (•••): Centralizes secondary display modes & responsive fallbacks */}
        {!isDetached && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  editorCommandBus.dispatch({ type: 'preview:detach' });
                }}
                aria-label="Open PDF in separate window"
                title="Open PDF in separate window"
                className="size-7 relative flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-['']"
              >
                <ExternalLink className="size-3.5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Open PDF in separate window
            </TooltipContent>
          </Tooltip>
        )}

        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <Tooltip open={isMenuOpen ? false : menuTooltipOpen} onOpenChange={setMenuTooltipOpen}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Viewer options"
                  className={cn(
                    'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border after:absolute after:-inset-1.5 after:content-[\'\']',
                    isMenuOpen
                      ? 'bg-muted text-foreground'
                      : 'text-foreground hover:bg-muted',
                  )}
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Viewer options
            </TooltipContent>
          </Tooltip>

          <PopoverContent
            align="end"
            sideOffset={6}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="w-56 p-1.5 bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50 text-xs font-sans select-none"
          >
            {/* Secondary Viewer Toggles */}
            <div className={cn('space-y-0.5', collapseScale && 'pb-1 mb-1 border-b border-border')}>
              <div className="px-2 py-1 text-12 font-medium text-muted-foreground select-none">
                Viewer options
              </div>
              {isUltraCompact && onToggleSearch && (
                <button
                  type="button"
                  disabled={!pdfUrl}
                  onClick={() => {
                    onToggleSearch();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted text-foreground disabled:opacity-50 transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <Search className="size-3.5" />
                    <span>Find in document</span>
                  </span>
                  {isSearchOpen && <Check className="size-3.5 text-foreground" />}
                </button>
              )}
              {onToggleInvertColors && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleInvertColors();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted text-foreground transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <InvertColorsIcon className="size-3.5" />
                    <span>Dark mode (Invert)</span>
                  </span>
                  {invertColors && <Check className="size-3.5 text-foreground" />}
                </button>
              )}
              {onToggleSpreadView && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleSpreadView();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted text-foreground transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="size-3.5" />
                    <span>Two-page spread</span>
                  </span>
                  {isSpreadView && <Check className="size-3.5 text-foreground" />}
                </button>
              )}
              {isUltraCompact && onToggleSyncScroll && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleSyncScroll();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted text-foreground transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <Link2 className="size-3.5" />
                    <span>Sync scrolling</span>
                  </span>
                  {syncScroll && <Check className="size-3.5 text-foreground" />}
                </button>
              )}
              {!isDetached && (
                <button
                  type="button"
                  onClick={() => {
                    editorCommandBus.dispatch({ type: 'preview:detach' });
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted text-foreground transition-colors cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="size-3.5" />
                    <span>Open in separate window</span>
                  </span>
                </button>
              )}
            </div>

            {/* Scale / Zoom fallback controls in popover ONLY when collapsed on toolbar */}
            {collapseScale && (
              <>
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="font-semibold text-foreground text-xs">Scale</span>
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                    {autoFit
                      ? fitMode === 'height'
                        ? 'Fit Page'
                        : fitMode === 'auto'
                          ? 'Auto'
                          : 'Fit Width'
                      : `${Math.round(scale * 100)}%`}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-1 px-1">
                  <button
                    type="button"
                    onClick={onZoomOut}
                    aria-label="Zoom out"
                    className="size-7 flex-1 flex items-center justify-center rounded-sm border border-border hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
                    title="Zoom out"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSetFitMode) onSetFitMode('width');
                      else onToggleAutoFit();
                    }}
                    className={cn(
                      'h-7 px-2.5 flex items-center justify-center rounded-sm border text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
                      autoFit && fitMode !== 'height'
                        ? 'bg-primary text-primary-foreground border-primary font-semibold'
                        : 'border-border hover:bg-muted text-foreground',
                    )}
                  >
                    Fit Width
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSetFitMode) onSetFitMode('height');
                      else onToggleAutoFit();
                    }}
                    className={cn(
                      'h-7 px-2.5 flex items-center justify-center rounded-sm border text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
                      autoFit && fitMode === 'height'
                        ? 'bg-primary text-primary-foreground border-primary font-semibold'
                        : 'border-border hover:bg-muted text-foreground',
                    )}
                  >
                    Fit Page
                  </button>
                  <button
                    type="button"
                    onClick={onZoomIn}
                    aria-label="Zoom in"
                    className="size-7 flex-1 flex items-center justify-center rounded-sm border border-border hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
                    title="Zoom in"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1 mt-2 px-1 pb-1">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0].map((preset) => {
                    const isSelected = !autoFit && Math.abs(scale - preset) < 0.01;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          onSetScale?.(preset);
                        }}
                        className={cn(
                          'h-7 min-h-[28px] px-1 rounded-sm text-[11px] font-mono flex items-center justify-center transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-0.5 after:content-[\'\']',
                          isSelected
                            ? 'bg-primary/10 text-primary font-semibold border border-primary/30'
                            : 'hover:bg-muted text-foreground',
                        )}
                      >
                        {Math.round(preset * 100)}%
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});

export default PdfToolbar;
