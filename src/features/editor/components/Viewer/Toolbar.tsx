'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Image,
  Loader2,
  MoreHorizontal,
  Play,
  RefreshCw,
  Terminal,
  Zap,
  ZoomIn,
  ZoomOut,
  Check,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Separator,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { CompileStatus } from '@/features/editor/store/compile.store';
import type { LaTeXEngine } from '@/features/editor/store/settings.store';

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
            'p-1.5 px-2 rounded transition-colors disabled:opacity-50 flex items-center gap-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
            variant === 'default' &&
              'text-muted-foreground hover:text-primary hover:bg-primary/10',
            variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Icon className="size-4" strokeWidth={2} />
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

export interface CompileButtonProps {
  compileStatus: CompileStatus;
  onCompile: () => void;
  engine: LaTeXEngine;
  compileMode: 'full' | 'draft';
  setCompileMode: (m: 'full' | 'draft') => void;
}

export function CompileButton({
  compileStatus,
  onCompile,
  engine,
  compileMode,
  setCompileMode,
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
        className="flex items-center gap-1.5 h-7 px-2.5 rounded-l-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 outline-none focus-visible:ring-1 focus-visible:ring-primary"
      >
        {isRunning ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
        {isRunning ? statusLabel[compileStatus] ?? 'Working…' : 'Compile'}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isRunning}
            aria-label="Compile mode options"
            className="flex items-center justify-center h-7 w-5 rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 border-l border-primary-foreground/20 outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44 z-[9999]">
          {COMPILE_MODES.map(({ value, label, description }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => setCompileMode(value)}
              className={cn(
                compileMode === value && 'font-semibold text-primary',
                'text-xs',
              )}
            >
              {label}
              <span className="ml-auto text-xs text-muted-foreground">{description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Main Viewer Toolbar ─────────────────────────────────────────────────────

export interface ToolbarProps {
  compileStatus: CompileStatus;
  engine: LaTeXEngine;
  compileMode: 'full' | 'draft';
  setCompileMode: (m: 'full' | 'draft') => void;
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
}

export default function Toolbar({
  compileStatus,
  engine,
  compileMode,
  setCompileMode,
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
}: ToolbarProps) {
  return (
    <div className="h-10 border-b border-border bg-secondary/80 flex items-center justify-between px-3 shrink-0 z-10 gap-2">
      {/* Left: Compile + Zoom controls */}
      <div className="flex items-center gap-1.5">
        <CompileButton
          compileStatus={compileStatus}
          onCompile={onCompile}
          engine={engine}
          compileMode={compileMode}
          setCompileMode={setCompileMode}
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
              onClick={onToggleAutoFit}
              className="h-7 px-3 flex items-center justify-center rounded text-xs font-semibold tracking-wide transition-colors active:scale-95 outline-none font-mono min-w-14 text-center border border-border/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              title={autoFit ? 'Lock at current scale' : 'Fit to width'}
            >
              {autoFit ? 'Fit' : `${Math.round(scale * 100)}%`}
            </button>
            <ToolbarButton icon={ZoomIn} label="Zoom In (+)" onClick={onZoomIn} />
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 px-2 flex items-center justify-center gap-1 rounded text-xs font-semibold tracking-wide transition-colors active:scale-95 outline-none border border-border/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground">
                <span className="font-mono">{autoFit ? 'Fit' : `${Math.round(scale * 100)}%`}</span>
                <ChevronDown className="size-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40 z-[9999]">
              <DropdownMenuItem onClick={onToggleAutoFit} className="text-xs">
                <Check className={cn('size-3.5 mr-2 text-primary', !autoFit && 'opacity-0')} />
                <span className={cn('font-medium', autoFit && 'text-primary font-semibold')}>
                  Auto Fit (Fit)
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onZoomIn} className="text-xs">
                <ZoomIn className="size-3.5 mr-2 text-muted-foreground" />
                <span>Zoom In (+)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onResetZoom} className="text-xs">
                <span className="w-3.5 text-[9px] mr-2 font-mono text-center text-muted-foreground">
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
                <ZoomOut className="size-3.5 mr-2 text-muted-foreground" />
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
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More Actions"
                className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-95 outline-none border border-border/40"
              >
                <MoreHorizontal className="size-4" />
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
                    <RefreshCw className="size-3.5 mr-2 text-muted-foreground" />
                    <span>Re-sync Project</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {compileLog && (
                <DropdownMenuItem onClick={onToggleLog} className="text-xs">
                  <Terminal className="size-3.5 mr-2 text-muted-foreground" />
                  <span>{showLog ? 'Hide Compile Log' : 'Show Compile Log'}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDownload} disabled={!pdfUrl} className="text-xs">
                <Download className="size-3.5 mr-2 text-muted-foreground" />
                <span>Download PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
