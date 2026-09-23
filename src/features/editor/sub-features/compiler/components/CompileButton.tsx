'use client';

/**
 * CompileButton.tsx
 *
 * Dedicated Overleaf-parity recompile button with integrated options dropdown:
 * - Direct trigger on click (Ctrl+Enter)
 * - Engine selection (pdfLaTeX, XeLaTeX, LuaLaTeX)
 * - Fast Draft vs Full Compile
 * - Auto-compile toggle
 * - Cache clearing
 * - Emergency stop compilation
 */

import React from 'react';
import {
  ChevronDown,
  Loader2,
  Play,
  RefreshCw,
  Zap,
  Check,
  StopCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui';
import {
  useCompileStore,
  useDocumentSettingsStore,
  type CompileStatus,
  type LaTeXEngine,
} from '../../../store';
import { LatexCompilerEngine } from '../../../utils/viewer.util';
import type { CompilerEngine } from '../../../types';
import { toast } from 'sonner';

export interface CompileButtonProps {
  onCompile: () => void;
  onClearCacheAndCompile?: () => void;
}

export const CompileButton = React.memo(function CompileButton({
  onCompile,
  onClearCacheAndCompile,
}: CompileButtonProps) {
  const compileStatus = useCompileStore((s) => s.compileStatus);
  const setCompileStatus = useCompileStore((s) => s.setCompileStatus);

  const engine = useDocumentSettingsStore((s) => s.engine);
  const setEngine = useDocumentSettingsStore((s) => s.setEngine);
  const compileMode = useDocumentSettingsStore((s) => s.compileMode);
  const setCompileMode = useDocumentSettingsStore((s) => s.setCompileMode);
  const autoCompile = useDocumentSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useDocumentSettingsStore((s) => s.setAutoCompile);
  const stopOnFirstError = useDocumentSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = useDocumentSettingsStore((s) => s.setStopOnFirstError);

  const isRunning =
    compileStatus !== 'idle' && compileStatus !== 'done' && compileStatus !== 'error';

  const statusLabel: Record<string, string> = {
    flushing: 'Saving…',
    syncing: 'Syncing…',
    compiling: 'Compiling…',
  };

  const handleStopCompilation = () => {
    LatexCompilerEngine.cancelInFlightCompile();
    setCompileStatus('idle');
    toast.info('Compilation stopped');
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
        className="flex items-center gap-1.5 h-7 px-3 rounded-l-md bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-2xs transition-colors disabled:opacity-60 outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
      >
        {isRunning && <Loader2 className="size-3.5 animate-spin shrink-0" />}
        <span>{isRunning ? statusLabel[compileStatus] ?? 'Compiling…' : 'Recompile'}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Compile options"
            className="flex items-center justify-center h-7 px-1.5 rounded-r-md bg-primary/90 hover:bg-primary text-primary-foreground border-l border-primary-foreground/20 text-xs shadow-2xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
          >
            <ChevronDown className="size-3" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56 text-xs">
          <DropdownMenuLabel className="text-11 font-semibold text-muted-foreground tracking-normal">
            Compilation Mode
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setCompileMode('full')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <RefreshCw className="size-3.5 text-muted-foreground" />
              <span>Normal (Full Output)</span>
            </div>
            {compileMode === 'full' && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setCompileMode('draft')}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Zap className="size-3.5 text-amber-500" />
              <span>Fast (Draft / No figures)</span>
            </div>
            {compileMode === 'draft' && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-11 font-semibold text-muted-foreground tracking-normal">
            TeX Engine
          </DropdownMenuLabel>
          {([
            { id: 'pdflatex', label: 'pdfLaTeX' },
            { id: 'xelatex', label: 'XeLaTeX' },
            { id: 'lualatex', label: 'LuaLaTeX' },
          ] as const).map(({ id, label }) => (
            <DropdownMenuItem
              key={id}
              onClick={() => setEngine(id as CompilerEngine)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span>{label}</span>
              {engine === id && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setAutoCompile(!autoCompile)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>Auto-compile on change</span>
            {autoCompile && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setStopOnFirstError(!stopOnFirstError)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>Stop on first error</span>
            {stopOnFirstError && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          {onClearCacheAndCompile && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onClearCacheAndCompile}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                Clear cache and recompile
              </DropdownMenuItem>
            </>
          )}

          {isRunning && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleStopCompilation}
                className="text-destructive font-medium cursor-pointer"
              >
                <StopCircle className="size-3.5 mr-1.5" /> Stop compilation
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
