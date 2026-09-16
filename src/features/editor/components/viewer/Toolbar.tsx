'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Image,
  Loader2,
  Minimize2,
  MoreHorizontal,
  Play,
  RefreshCw,
  Terminal,
  Zap,
  ZoomIn,
  ZoomOut,
  Check,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/shared/components/ui";
import { Separator } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { CompileStatus, LaTeXEngine } from '@/features/editor/store';
import ViewerOutlinePopover from './subcomponents/ViewerOutlinePopover';
import type { PdfOutlineItem } from '@/features/editor/utils/pdf-outline.util';

// ── Toolbar Button Helper ───────────────────────────────────────────────────

export interface ToolbarButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string | null;
  variant?: 'default' | 'primary';
}

export function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  title = null,
  variant = 'default',
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          aria-label={label || title || 'Action button'}
          className={cn(
            'p-1.5 px-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2 outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer',
            variant === 'default' &&
              'text-foreground hover:bg-muted',
            variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary-hover',
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin shrink-0" />
          ) : (
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
          )}
          {title && <span className="text-sm font-medium">{title}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

// ── Compile Button with Engine / Mode Dropdown ──────────────────────────────

const COMPILE_MODES = [
  { value: 'full', label: 'Full', icon: Image, description: 'Complete compile' },
  { value: 'draft', label: 'Draft', icon: Zap, description: 'Skip images' },
] as const;

const LATEX_ENGINES = [
  { value: 'pdflatex', label: 'pdfLaTeX', description: 'Standard & fast' },
  { value: 'xelatex', label: 'XeLaTeX', description: 'Unicode & fontspec' },
  { value: 'lualatex', label: 'LuaLaTeX', description: 'Modern Lua engine' },
] as const;

export interface CompileButtonProps {
  compileStatus: CompileStatus;
  onCompile: () => void;
  engine: LaTeXEngine;
  setEngine?: (e: LaTeXEngine) => void;
  compileMode: 'full' | 'draft';
  setCompileMode: (m: 'full' | 'draft') => void;
  autoCompile?: boolean;
  onToggleAutoCompile?: () => void;
  onClearCacheAndCompile?: () => void;
}

export function CompileButton({
  compileStatus,
  onCompile,
  engine,
  setEngine,
  compileMode,
  setCompileMode,
  autoCompile = true,
  onToggleAutoCompile,
  onClearCacheAndCompile,
}: CompileButtonProps) {
  const isRunning =
    compileStatus !== 'idle' && compileStatus !== 'done' && compileStatus !== 'error';
  const statusLabel: Record<string, string> = {
    flushing: 'Saving…',
    syncing: 'Syncing…',
    compiling: 'Compiling…',
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onCompile}
        disabled={isRunning}
        title="Compile (Ctrl+Enter)"
        aria-label={
          isRunning
            ? statusLabel[compileStatus] ?? 'Compiling document…'
            : 'Compile document (Ctrl+Enter)'
        }
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-l-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
      >
        {isRunning ? (
          <Loader2 className="size-3.5 animate-spin shrink-0" />
        ) : (
          <Play className="size-3 fill-current shrink-0" />
        )}
        {isRunning ? statusLabel[compileStatus] ?? 'Working…' : 'Compile'}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isRunning}
            aria-label="Compile engine and mode options"
            className="flex items-center justify-center h-7 w-5 rounded-r-md bg-primary text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-60 border-l border-primary-foreground/20 outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
          >
            <ChevronDown className="size-3 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 z-[9999]">
          {/* Overleaf Parity: Auto-compile Toggle */}
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground select-none">
            Auto-compile
          </div>
          <DropdownMenuItem
            onClick={onToggleAutoCompile}
            className="text-xs flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Check
                className={cn(
                  'size-3.5 text-primary shrink-0',
                  !autoCompile && 'opacity-0',
                )}
              />
              <span>Auto-compile</span>
            </div>
            <span
              className={cn(
                'text-11 px-1.5 py-0.5 rounded font-medium font-mono',
                autoCompile
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {autoCompile ? 'On' : 'Off'}
            </span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <div className="px-2 py-1 text-11 font-medium font-mono uppercase tracking-wider text-muted-foreground select-none">
            Compiler Engine
          </div>
          {LATEX_ENGINES.map(({ value, label, description }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => setEngine?.(value as LaTeXEngine)}
              className={cn(
                'text-xs flex items-center justify-between cursor-pointer',
                engine === value && 'font-semibold text-primary bg-muted/60',
              )}
            >
              <div className="flex items-center gap-1.5">
                <Check
                  className={cn(
                    'size-3.5 text-primary shrink-0',
                    engine !== value && 'opacity-0',
                  )}
                />
                <span>{label}</span>
              </div>
              <span className="text-11 font-mono text-muted-foreground">{description}</span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <div className="px-2 py-1 text-11 font-medium font-mono uppercase tracking-wider text-muted-foreground select-none">
            Compile Mode
          </div>
          {COMPILE_MODES.map(({ value, label, description, icon: ModeIcon }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => setCompileMode(value)}
              className={cn(
                'text-xs flex items-center justify-between cursor-pointer',
                compileMode === value && 'font-semibold text-primary bg-muted/60',
              )}
            >
              <div className="flex items-center gap-1.5">
                <Check
                  className={cn(
                    'size-3.5 text-primary shrink-0',
                    compileMode !== value && 'opacity-0',
                  )}
                />
                <ModeIcon className="size-3.5 text-muted-foreground shrink-0" />
                <span>{label}</span>
              </div>
              <span className="text-11 font-mono text-muted-foreground">{description}</span>
            </DropdownMenuItem>
          ))}

          {/* Overleaf Parity: Clear Cache and Recompile */}
          {onClearCacheAndCompile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onClearCacheAndCompile}
                className="text-xs flex items-center gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 cursor-pointer"
              >
                <RefreshCw className="size-3.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-medium">Clear cache & recompile</span>
                  <span className="text-11 text-muted-foreground">Recompile from scratch</span>
                </div>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Main Viewer Toolbar ─────────────────────────────────────────────────────

export interface ToolbarProps {
  compileStatus: CompileStatus;
  engine: LaTeXEngine;
  setEngine?: (e: LaTeXEngine) => void;
  compileMode: 'full' | 'draft';
  setCompileMode: (m: 'full' | 'draft') => void;
  autoCompile?: boolean;
  onToggleAutoCompile?: () => void;
  onClearCacheAndCompile?: () => void;
  onCompile: () => void;
  onForceSync: () => void;
  // Zoom
  scale: number;
  autoFit: boolean;
  showZoomGroup: boolean;
  onToggleAutoFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  // Pages
  pageNumber: number;
  numPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  // Actions
  pdfUrl: string | null;
  compileLog: string;
  showLog: boolean;
  showUtilityGroup: boolean;
  onToggleLog: () => void;
  onDownload: () => void;
  onPopout?: () => void;
  isPoppedOut?: boolean;
  outline?: PdfOutlineItem[];
  onJumpToPage?: (page: number) => void;
}

export default function Toolbar({
  compileStatus,
  engine,
  setEngine,
  compileMode,
  setCompileMode,
  autoCompile,
  onToggleAutoCompile,
  onClearCacheAndCompile,
  onCompile,
  onForceSync,
  scale,
  autoFit,
  showZoomGroup,
  onToggleAutoFit,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  pageNumber,
  numPages,
  onPrevPage,
  onNextPage,
  pdfUrl,
  compileLog,
  showLog,
  showUtilityGroup,
  onToggleLog,
  onDownload,
  onPopout,
  isPoppedOut = false,
  outline = [],
  onJumpToPage,
}: ToolbarProps) {
  return (
    <div className="h-10 border-b border-border bg-background flex items-center justify-between px-3 shrink-0 z-10 gap-2">
      {/* Left: Compile + Zoom controls */}
      <div className="flex items-center gap-1.5">
        <CompileButton
          compileStatus={compileStatus}
          onCompile={onCompile}
          engine={engine}
          setEngine={setEngine}
          compileMode={compileMode}
          setCompileMode={setCompileMode}
          autoCompile={autoCompile}
          onToggleAutoCompile={onToggleAutoCompile}
          onClearCacheAndCompile={onClearCacheAndCompile}
        />

        {showZoomGroup ? (
          <>
            <ToolbarButton
              icon={RefreshCw}
              label="Re-sync Project (force full re-upload)"
              onClick={onForceSync}
              disabled={compileStatus !== 'idle'}
              loading={compileStatus === 'syncing'}
            />

            <Separator orientation="vertical" className="h-5 mx-0.5" />

            <ToolbarButton icon={ZoomOut} label="Zoom Out (-)" onClick={onZoomOut} />
            <button
              type="button"
              onClick={onToggleAutoFit}
              className="h-7 px-3 flex items-center justify-center rounded-md text-xs font-semibold tracking-wide transition-colors active:scale-95 outline-none font-mono min-w-14 text-center border border-border text-foreground hover:bg-muted"
              title={autoFit ? 'Lock at current scale' : 'Fit to width'}
            >
              {autoFit ? 'Fit' : `${Math.round(scale * 100)}%`}
            </button>
            <ToolbarButton icon={ZoomIn} label="Zoom In (+)" onClick={onZoomIn} />
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 px-2 flex items-center justify-center gap-1 rounded-md text-xs font-medium tracking-wide transition-colors active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-primary border border-border text-foreground hover:bg-muted"
              >
                <span className="font-mono">{autoFit ? 'Fit' : `${Math.round(scale * 100)}%`}</span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40 z-[9999]">
              <DropdownMenuItem onClick={onToggleAutoFit} className="text-xs">
                <Check className={cn('size-3.5 mr-2 text-primary shrink-0', !autoFit && 'opacity-0')} />
                <span className={cn('font-medium', autoFit && 'text-primary font-semibold')}>
                  Auto Fit (Fit)
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onZoomIn} className="text-xs">
                <ZoomIn className="size-3.5 mr-2 text-muted-foreground shrink-0" />
                <span>Zoom In (+)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onResetZoom} className="text-xs">
                <span className="w-3.5 text-xs mr-2 font-mono text-center text-muted-foreground">
                  100
                </span>
                <span
                  className={cn(
                    'font-medium',
                    !autoFit && scale === 1 && 'text-primary font-semibold',
                  )}
                >
                  Actual Size (100%)
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onZoomOut} className="text-xs">
                <ZoomOut className="size-3.5 mr-2 text-muted-foreground shrink-0" />
                <span>Zoom Out (-)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Right: Page navigation & Utility Actions */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={ChevronLeft}
          label="Previous Page"
          onClick={onPrevPage}
          disabled={pageNumber <= 1}
        />
        <span className="text-xs text-muted-foreground px-1 min-w-16 text-center font-mono select-none">
          {numPages > 0 ? `${pageNumber} / ${numPages}` : '- / -'}
        </span>
        <ToolbarButton
          icon={ChevronRight}
          label="Next Page"
          onClick={onNextPage}
          disabled={pageNumber >= numPages}
        />

        {onJumpToPage && (
          <ViewerOutlinePopover
            outline={outline}
            currentPageNumber={pageNumber}
            onSelectPage={onJumpToPage}
            disabled={!pdfUrl}
          />
        )}

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {showUtilityGroup ? (
          <>
            {compileLog && (
              <ToolbarButton
                icon={Terminal}
                label={showLog ? 'Hide log' : 'Show log'}
                onClick={onToggleLog}
                variant={showLog ? 'primary' : 'default'}
              />
            )}
            <ToolbarButton
              icon={Download}
              label="Download PDF"
              onClick={onDownload}
              disabled={!pdfUrl}
            />
            {onPopout && (
              <ToolbarButton
                icon={isPoppedOut ? Minimize2 : ExternalLink}
                label={isPoppedOut ? 'Re-attach to main window' : 'Pop out viewer to separate window'}
                onClick={onPopout}
              />
            )}
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More Actions"
                className="h-7 w-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted active:scale-95 outline-none border border-border"
              >
                <MoreHorizontal className="size-4 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 z-[9999]">
              {!showZoomGroup && (
                <>
                  <DropdownMenuItem
                    onClick={onForceSync}
                    disabled={compileStatus !== 'idle'}
                    className="text-xs"
                  >
                    <RefreshCw className="size-3.5 mr-2 text-muted-foreground shrink-0" />
                    <span>Re-sync Project</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {compileLog && (
                <DropdownMenuItem onClick={onToggleLog} className="text-xs">
                  <Terminal className="size-3.5 mr-2 text-muted-foreground shrink-0" />
                  <span>{showLog ? 'Hide Compile Log' : 'Show Compile Log'}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDownload} disabled={!pdfUrl} className="text-xs">
                <Download className="size-3.5 mr-2 text-muted-foreground shrink-0" />
                <span>Download PDF</span>
              </DropdownMenuItem>
              {onPopout && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onPopout} className="text-xs">
                    {isPoppedOut ? (
                      <Minimize2 className="size-3.5 mr-2 text-muted-foreground shrink-0" />
                    ) : (
                      <ExternalLink className="size-3.5 mr-2 text-muted-foreground shrink-0" />
                    )}
                    <span>{isPoppedOut ? 'Re-attach to Editor' : 'Pop out to Window'}</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
