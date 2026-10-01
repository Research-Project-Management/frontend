'use client';

/**
 * PdfToolbar.tsx
 *
 * Unified PDF viewer header toolbar (Overleaf parity):
 * - Left: Compile Button (with TeX engine dropdown)
 * - Center: Page Pagination + Zoom Controls
 * - Right: Invert Colors, Spread View, Presentation Mode, Popout, Logs, Export Dropdown
 */

import React from 'react';
import {
  FileText,
  ExternalLink,
  Minimize2,
  Presentation,
  BookOpen,
  SunMoon,
  MoreHorizontal,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { CompileButton } from '../../compiler/components/CompileButton';
import { PdfPaginationControls } from './PdfPaginationControls';
import { PdfZoomControls } from './PdfZoomControls';
import { PdfExportDropdown } from './PdfExportDropdown';
import type { CompileStatus } from '../../../store';

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
  scale,
  autoFit,
  onToggleAutoFit,
  onZoomIn,
  onZoomOut,
  onSetScale,
  showZoomGroup = true,
  showUtilityGroup = true,
  pageNumber,
  numPages,
  onPrevPage,
  onNextPage,
  onJumpToPage,
  invertColors,
  onToggleInvertColors,
  isSpreadView,
  onToggleSpreadView,
  pdfUrl,
  compileLog,
  showLog,
  onToggleLog,
  onDownload,
  onPopout,
  isPoppedOut,
  onOpenPresentationMode,
  errorCount = 0,
  warningCount = 0,
}: PdfToolbarProps) {
  return (
    <div className="h-9 border-b border-border bg-background px-2 flex items-center justify-between gap-1.5 shrink-0 select-none overflow-hidden">
      {/* 1. Left section: Compilation actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <CompileButton
          onCompile={onCompile}
          onClearCacheAndCompile={onClearCacheAndCompile}
          onStopCompilation={onStopCompilation}
        />

        {/* Overleaf Diagnostics Badge (immediately adjacent to Recompile) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleLog}
              aria-label="Toggle compiler logs & diagnostics"
              className={cn(
                'h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer border shadow-2xs select-none',
                showLog
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : errorCount > 0
                    ? 'bg-destructive/15 border-destructive/40 text-destructive hover:bg-destructive/25'
                    : warningCount > 0
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <FileText className="size-3.5 shrink-0" />
              {errorCount > 0 ? (
                <span className="flex items-center gap-1">
                  <span>{errorCount}</span>
                  <span className="text-10 font-bold uppercase">{errorCount === 1 ? 'error' : 'errors'}</span>
                </span>
              ) : warningCount > 0 ? (
                <span className="flex items-center gap-1">
                  <span>{warningCount}</span>
                  <span className="text-10 font-bold uppercase">{warningCount === 1 ? 'warn' : 'warns'}</span>
                </span>
              ) : (
                <span className="text-11 font-medium">Logs</span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {errorCount > 0
              ? `${errorCount} compilation error${errorCount > 1 ? 's' : ''}. Click to open diagnostics.`
              : warningCount > 0
                ? `${warningCount} warning${warningCount > 1 ? 's' : ''}. Click to open diagnostics.`
                : 'Compiler logs & output files'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* 2. Center section: Page & Zoom navigation */}
      <div className="flex items-center gap-2 shrink-0">
        <PdfPaginationControls
          pageNumber={pageNumber}
          numPages={numPages}
          onPrevPage={onPrevPage}
          onNextPage={onNextPage}
          onJumpToPage={onJumpToPage}
        />

        {showZoomGroup && (
          <PdfZoomControls
            scale={scale}
            autoFit={autoFit}
            onToggleAutoFit={onToggleAutoFit}
            onZoomIn={onZoomIn}
            onZoomOut={onZoomOut}
            onSetScale={onSetScale}
          />
        )}
      </div>

      {/* 3. Right section: Display modes & Utilities */}
      <div className="flex items-center gap-1 shrink-0">
        {showUtilityGroup ? (
          <>
            {/* Color inversion (dark PDF) */}
            {onToggleInvertColors && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleInvertColors}
                    aria-label="Invert PDF colors"
                    className={cn(
                      'size-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer',
                      invertColors
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    )}
                  >
                    <SunMoon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {invertColors ? 'Normal mode' : 'Dark mode (Invert colors)'}
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
                    aria-label="Two-page spread view"
                    className={cn(
                      'size-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer',
                      isSpreadView
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
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

            {/* Presentation mode */}
            {onOpenPresentationMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenPresentationMode}
                    disabled={!pdfUrl}
                    aria-label="Presentation mode (F5)"
                    className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <Presentation className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Presentation mode (F5)
                </TooltipContent>
              </Tooltip>
            )}

            {/* Popout detached window */}
            {onPopout && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onPopout}
                    aria-label={isPoppedOut ? 'Reattach viewer' : 'Detach viewer to new window'}
                    className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    {isPoppedOut ? (
                      <Minimize2 className="size-4 text-primary" />
                    ) : (
                      <ExternalLink className="size-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {isPoppedOut ? 'Reattach viewer' : 'Detach viewer to new window'}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        ) : (
          /* Compact overflow dropdown when width is constrained */
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Viewer display options"
                    className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                More options
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48 text-xs p-1">
              {onToggleInvertColors && (
                <DropdownMenuItem onClick={onToggleInvertColors} className="gap-2 cursor-pointer">
                  <SunMoon className="size-3.5" />
                  <span>{invertColors ? 'Normal mode' : 'Dark mode (Invert colors)'}</span>
                </DropdownMenuItem>
              )}
              {onToggleSpreadView && (
                <DropdownMenuItem onClick={onToggleSpreadView} className="gap-2 cursor-pointer">
                  <BookOpen className="size-3.5" />
                  <span>{isSpreadView ? 'Single page view' : 'Two-page spread view'}</span>
                </DropdownMenuItem>
              )}
              {onOpenPresentationMode && (
                <DropdownMenuItem
                  onClick={onOpenPresentationMode}
                  disabled={!pdfUrl}
                  className="gap-2 cursor-pointer"
                >
                  <Presentation className="size-3.5" />
                  <span>Presentation mode</span>
                </DropdownMenuItem>
              )}
              {onPopout && (
                <DropdownMenuItem onClick={onPopout} className="gap-2 cursor-pointer">
                  {isPoppedOut ? <Minimize2 className="size-3.5" /> : <ExternalLink className="size-3.5" />}
                  <span>{isPoppedOut ? 'Reattach viewer' : 'Detach window'}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Export dropdown */}
        <PdfExportDropdown pdfUrl={pdfUrl} onDownloadPdf={onDownload} />
      </div>
    </div>
  );
});
