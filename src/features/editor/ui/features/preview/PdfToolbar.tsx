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
} from 'lucide-react';
import { editorCommandBus } from '../../../coordinators/command-bus';
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
import { useViewerStore } from '../../../store/viewer.store';
import type { CompileMode, CompileStatus } from '../../../domain/types/compiler.types';
import type { PdfOutlineItem } from '@/features/editor/domain/pdf/pdf-outline';

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
  compileStatus: CompileStatus;
  engine?: any;
  setEngine?: (e: any) => void;
  compileMode?: CompileMode;
  setCompileMode?: (m: CompileMode) => void;
  autoCompile?: boolean;
  onToggleAutoCompile?: () => void;
  onCompile: () => void;
  onClearCacheAndCompile?: () => void;
  onStopCompilation?: () => void;
  onForceSync?: () => void;

  // Zoom
  scale: number;
  autoFit: boolean;
  fitMode?: 'width' | 'height' | 'auto';
  onToggleAutoFit: () => void;
  onSetFitMode?: (mode: 'width' | 'height' | 'auto') => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
  onSetScale?: (scale: number) => void;
  showZoomGroup?: boolean;
  showUtilityGroup?: boolean;
  outline?: PdfOutlineItem[];

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
  compileLog?: string;
  showLog?: boolean;
  onToggleLog?: () => void;
  onDownload?: () => void;
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
}: PdfToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(600);
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

  // Display secondary viewer toggles directly on toolbar only when width >= 660px
  const showExtendedUtilities = toolbarWidth >= 660;
  // Keep zoom scale controls visible unless viewport is extremely narrow (< 400px)
  const collapseScale = toolbarWidth < 400;
  // Hide SyncTeX when viewport is ultra narrow (< 360px)
  const isUltraCompact = toolbarWidth < 360;

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="PDF viewer controls"
      className="h-9 bg-surface px-2 flex items-center justify-between gap-1.5 shrink-0 select-none border-b border-border"
    >
      {/* 1. Left section: Compilation actions */}
      <div className="flex items-center gap-1.5 shrink-0">
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
                'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
                showLog
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <FileText className="size-3.5 shrink-0" />
              {errorCount > 0 ? (
                <span
                  data-testid="compiler-error-badge"
                  className="absolute -top-1 -right-1 flex min-w-3.5 h-3.5 px-0.5 items-center justify-center rounded-full text-[9px] font-mono font-semibold bg-destructive text-destructive-foreground leading-none animate-in zoom-in-50 duration-100"
                >
                  {errorCount > 99 ? '99+' : errorCount}
                </span>
              ) : warningCount > 0 ? (
                <span
                  data-testid="compiler-warning-badge"
                  className="absolute -top-1 -right-1 flex min-w-3.5 h-3.5 px-0.5 items-center justify-center rounded-full text-[9px] font-mono font-semibold bg-warning text-warning-foreground leading-none animate-in zoom-in-50 duration-100"
                >
                  {warningCount > 99 ? '99+' : warningCount}
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {errorCount > 0
              ? `Logs and output files (${errorCount} error${errorCount > 1 ? 's' : ''})`
              : warningCount > 0
                ? `Logs and output files (${warningCount} warning${warningCount > 1 ? 's' : ''})`
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
              className="size-7 relative flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:cursor-not-allowed transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-['']"
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
        {/* View utility buttons: only shown on toolbar when not ultra-compact */}
            {!isUltraCompact && (
              <>
                {/* Find in document (Ctrl+F) */}
                {onToggleSearch && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={onToggleSearch}
                        disabled={!pdfUrl}
                        aria-label="Find in document (Ctrl+F)"
                        className={cn(
                          'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed after:absolute after:-inset-1.5 after:content-[\'\']',
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

                {/* Extended Viewer Options: only shown directly on toolbar when wide (>= 660px) */}
                {showExtendedUtilities && (
                  <>
                    {/* Invert colors (Dark mode PDF) */}
                    {onToggleInvertColors && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={onToggleInvertColors}
                            aria-label={invertColors ? 'Normal PDF view' : 'Dark mode (Invert PDF colors)'}
                            className={cn(
                              'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-[\'\']',
                              invertColors
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-foreground hover:bg-muted',
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

                    {/* Two-page spread */}
                    {onToggleSpreadView && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={onToggleSpreadView}
                            aria-label={isSpreadView ? 'Single page view' : 'Two-page spread view'}
                            className={cn(
                              'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-[\'\']',
                              isSpreadView
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-foreground hover:bg-muted',
                            )}
                          >
                            <BookOpen className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {isSpreadView ? 'Single page view' : 'Two-page spread view'}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Synchronized Scrolling Toggle (Overleaf Parity) */}
                    {onToggleSyncScroll && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={onToggleSyncScroll}
                            aria-label={syncScroll ? 'Disable synchronized scrolling' : 'Enable synchronized scrolling'}
                            className={cn(
                              'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-[\'\']',
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

                    {/* Pop-out / Detached PDF Preview Window (Overleaf Parity) */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => {
                            editorCommandBus.dispatch({ type: 'preview:detach' });
                          }}
                          aria-label="Open PDF in separate window"
                          className="size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-[''] text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="size-3.5 shrink-0" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Open in separate window (Pop-out Preview)
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </>
            )}

            {/* Pagination Controls (< [ 1 ] / 1 >) */}
            <PdfPaginationControls
              pageNumber={pageNumber}
              numPages={numPages}
              onPrevPage={onPrevPage}
              onNextPage={onNextPage}
              onJumpToPage={onJumpToPage}
              className="px-0.5"
            />

            {/* Zoom Controls: always visible on toolbar unless extremely small (< 400px) */}
            {!collapseScale && (
              <PdfZoomControls
                scale={scale}
                autoFit={autoFit}
                fitMode={fitMode}
                compact={toolbarWidth < 680}
                onToggleAutoFit={onToggleAutoFit}
                onSetFitMode={onSetFitMode}
                onZoomIn={onZoomIn}
                onZoomOut={onZoomOut}
                onSetScale={onSetScale}
              />
            )}

            {/* More Options Menu: appears when secondary utilities or scale are folded */}
            {(!showExtendedUtilities || collapseScale) && (
              <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <Tooltip open={isMenuOpen ? false : menuTooltipOpen} onOpenChange={setMenuTooltipOpen}>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Viewer options"
                        className={cn(
                          'size-7 relative flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary after:absolute after:-inset-1.5 after:content-[\'\']',
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
                  {!showExtendedUtilities && (
                    <div className="pb-1 mb-1 border-b border-border space-y-0.5">
                      <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Viewer options
                      </div>
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
                          {invertColors && <Check className="size-3.5 text-primary" />}
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
                          {isSpreadView && <Check className="size-3.5 text-primary" />}
                        </button>
                      )}
                      {onToggleSyncScroll && (
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
                          {syncScroll && <Check className="size-3.5 text-primary" />}
                        </button>
                      )}
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
                          <span>Separate window</span>
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Scale / Zoom controls in popover */}
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="font-semibold text-foreground text-xs">Scale</span>
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                      {autoFit ? 'Fit Width' : `${Math.round(scale * 100)}%`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 mt-1 px-1">
                    <button
                      type="button"
                      onClick={onZoomOut}
                      aria-label="Zoom out"
                      className="size-7 flex-1 flex items-center justify-center rounded-sm border border-border hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      title="Zoom out"
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleAutoFit()}
                      className={cn(
                        'h-7 px-3 flex items-center justify-center rounded-sm border text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        autoFit
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'border-border hover:bg-muted text-foreground',
                      )}
                    >
                      Fit Width
                    </button>
                    <button
                      type="button"
                      onClick={onZoomIn}
                      aria-label="Zoom in"
                      className="size-7 flex-1 flex items-center justify-center rounded-sm border border-border hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
                            if (autoFit) onToggleAutoFit();
                            onSetScale?.(preset);
                          }}
                          className={cn(
                            'h-6 px-1 rounded-sm text-[11px] font-mono flex items-center justify-center transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
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
                </PopoverContent>
              </Popover>
            )}
      </div>
    </div>
  );
});

export default PdfToolbar;
