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
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';
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
    <div className="h-9 border-b border-border bg-background px-2 flex items-center justify-between gap-2 shrink-0 select-none overflow-x-auto overflow-y-hidden">
      {/* 1. Left section: Compilation actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <CompileButton
          onCompile={onCompile}
          onClearCacheAndCompile={onClearCacheAndCompile}
        />
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
        {/* Color inversion (dark PDF) */}
        {onToggleInvertColors && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleInvertColors}
                aria-label="Invert PDF colors"
                className={cn(
                  'size-7 flex items-center justify-center rounded-sm transition-colors',
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
                  'size-7 flex items-center justify-center rounded-sm transition-colors',
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
                className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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

        {/* Logs button with error/warning counter */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggleLog}
              aria-label="Toggle compiler logs"
              className={cn(
                'h-7 px-2 flex items-center gap-1.5 rounded-sm text-xs transition-colors font-medium',
                showLog
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
              )}
            >
              <FileText className="size-3.5" />
              <span>Logs</span>
              {errorCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-10 font-bold bg-destructive text-destructive-foreground leading-none">
                  {errorCount}
                </span>
              ) : warningCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-10 font-bold bg-amber-500 text-white leading-none">
                  {warningCount}
                </span>
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Logs and output files
          </TooltipContent>
        </Tooltip>

        {/* Export dropdown */}
        <PdfExportDropdown pdfUrl={pdfUrl} onDownloadPdf={onDownload} />
      </div>
    </div>
  );
});
