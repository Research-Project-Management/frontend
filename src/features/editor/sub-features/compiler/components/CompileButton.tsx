'use client';

/**
 * CompileButton.tsx
 *
 * Dedicated Overleaf-parity recompile button with integrated options dropdown:
 * - Direct trigger on click (Ctrl+Enter)
 * - Auto compile (On / Off)
 * - Compile mode (Normal / Fast [draft])
 * - Syntax checks (Check syntax before compile / Don't check syntax)
 * - Compile error handling (Stop on first error / Try to compile despite errors)
 * - Stop compilation
 * - Recompile from scratch
 * Strictly using project theme design tokens (bg-primary, bg-popover, border-border, text-foreground).
 */

import React from 'react';
import {
  ChevronDown,
  Loader2,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import {
  useCompileStore,
  useDocumentSettingsStore,
} from '../../../store';
import { LatexCompilerEngine } from '../../../utils/viewer.util';
import { toast } from 'sonner';

export interface CompileButtonProps {
  onCompile: () => void;
  onClearCacheAndCompile?: () => void;
  onStopCompilation?: () => void;
}

export const CompileButton = React.memo(function CompileButton({
  onCompile,
  onClearCacheAndCompile,
  onStopCompilation,
}: CompileButtonProps) {
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const setCompileStatus = useCompileStore((s) => s.setCompileStatus);

  const compileMode = useDocumentSettingsStore((s) => s.compileMode);
  const setCompileMode = useDocumentSettingsStore((s) => s.setCompileMode);
  const autoCompile = useDocumentSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useDocumentSettingsStore((s) => s.setAutoCompile);
  const linterEnabled = useDocumentSettingsStore((s) => s.linterEnabled);
  const setLinterEnabled = useDocumentSettingsStore((s) => s.setLinterEnabled);
  const stopOnFirstError = useDocumentSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = useDocumentSettingsStore((s) => s.setStopOnFirstError);

  const isRunning =
    compileStatus !== 'idle' && compileStatus !== 'done' && compileStatus !== 'error';

  const statusLabel: Record<string, string> = {
    flushing: 'Preparing…',
    syncing: 'Syncing…',
    compiling: 'Compiling…',
  };

  const handleStopCompilation = () => {
    if (onStopCompilation) {
      onStopCompilation();
      return;
    }
    LatexCompilerEngine.cancelInFlightCompile();
    setCompileStatus('idle');
    toast.info('Compilation stopped');
  };

  const handleRecompileFromScratch = () => {
    if (onClearCacheAndCompile) {
      onClearCacheAndCompile();
    } else {
      onCompile();
    }
  };

  return (
    <div className="flex items-center select-none">
      <button
        type="button"
        onClick={onCompile}
        disabled={isRunning}
        title="Recompile (Ctrl+Enter)"
        aria-label={
          isRunning
            ? statusLabel[compileStatus] ?? 'Compiling document…'
            : 'Recompile document (Ctrl+Enter)'
        }
        className="flex items-center gap-1.5 h-7 px-3 rounded-l-md bg-success hover:bg-success/90 text-success-foreground text-xs font-semibold transition-colors disabled:opacity-60 outline-none focus-visible:ring-1 focus-visible:ring-success cursor-pointer"
      >
        {isRunning && <Loader2 className="size-3.5 animate-spin shrink-0 text-success-foreground" />}
        <span>{isRunning ? statusLabel[compileStatus] ?? 'Compiling…' : 'Recompile'}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Compile options"
            className="flex items-center justify-center h-7 px-2 rounded-r-md bg-success hover:bg-success/90 data-[state=open]:bg-success/90 text-success-foreground border-l border-success-foreground/20 text-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-success cursor-pointer"
          >
            <ChevronDown className="size-3.5 text-success-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-[235px] p-1.5 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md text-xs z-[9999]"
        >
          {/* ── Section 1: Auto compile ── */}
          <div className="text-11 font-medium text-muted-foreground px-3 pt-2 pb-1 select-none">
            Auto compile
          </div>
          <DropdownMenuItem
            onClick={() => setAutoCompile(true)}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>On</span>
            {autoCompile && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setAutoCompile(false)}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>Off</span>
            {!autoCompile && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>

          {/* Divider */}
          <DropdownMenuSeparator className="my-1.5 bg-border" />

          {/* ── Section 2: Compile mode ── */}
          <div className="text-11 font-medium text-muted-foreground px-3 pt-2 pb-1 select-none">
            Compile mode
          </div>
          <DropdownMenuItem
            onClick={() => setCompileMode('full')}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>Normal</span>
            {compileMode === 'full' && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setCompileMode('draft')}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>Fast [draft]</span>
            {compileMode === 'draft' && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>

          {/* Divider */}
          <DropdownMenuSeparator className="my-1.5 bg-border" />

          {/* ── Section 3: Syntax checks ── */}
          <div className="text-11 font-medium text-muted-foreground px-3 pt-2 pb-1 select-none">
            Syntax checks
          </div>
          <DropdownMenuItem
            onClick={() => setLinterEnabled(true)}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>Check syntax before compile</span>
            {linterEnabled && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setLinterEnabled(false)}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>Don&apos;t check syntax</span>
            {!linterEnabled && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>

          {/* Divider */}
          <DropdownMenuSeparator className="my-1.5 bg-border" />

          {/* ── Section 4: Compile error handling ── */}
          <div className="text-11 font-medium text-muted-foreground px-3 pt-2 pb-1 select-none">
            Compile error handling
          </div>
          <DropdownMenuItem
            onClick={() => setStopOnFirstError(true)}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>Stop on first error</span>
            {stopOnFirstError && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setStopOnFirstError(false)}
            className="flex items-center justify-between px-3 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
          >
            <span>Try to compile despite errors</span>
            {!stopOnFirstError && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
          </DropdownMenuItem>

          {/* Divider */}
          <DropdownMenuSeparator className="my-1.5 bg-border" />

          {/* ── Section 5: Actions (Stop compilation & Recompile from scratch) ── */}
          <DropdownMenuItem
            disabled={!isRunning}
            onClick={handleStopCompilation}
            className={cn(
              "flex items-center px-3 py-1.5 rounded-sm text-xs font-normal transition-colors select-none",
              isRunning
                ? "text-destructive hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive cursor-pointer"
                : "text-muted-foreground/60 opacity-60 cursor-not-allowed"
            )}
          >
            Stop compilation
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleRecompileFromScratch}
            className="flex items-center px-3 py-1.5 rounded-sm text-xs font-medium text-primary hover:text-primary/80 hover:underline hover:bg-muted/40 focus:bg-muted/40 focus:text-primary cursor-pointer transition-colors select-none"
          >
            Recompile from scratch
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
