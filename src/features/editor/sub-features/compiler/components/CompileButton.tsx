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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import {
  useCompileStore,
  useDocumentSettingsStore,
} from '../../../store';

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

  const handleRecompileFromScratch = () => {
    if (onClearCacheAndCompile) {
      onClearCacheAndCompile();
    } else {
      onCompile();
    }
  };

  return (
    <div className="inline-flex items-center rounded-md shadow-xs select-none shrink-0">
      <button
        type="button"
        onClick={onCompile}
        disabled={isRunning}
        title={isRunning ? (statusLabel[compileStatus] ?? 'Compiling…') : 'Recompile (Ctrl+Enter)'}
        aria-label={
          isRunning
            ? statusLabel[compileStatus] ?? 'Compiling document…'
            : 'Recompile document (Ctrl+Enter)'
        }
        className="flex items-center justify-center gap-1.5 h-7 px-2.5 min-w-[94px] whitespace-nowrap shrink-0 rounded-l-md bg-primary hover:bg-primary-hover text-primary-foreground text-12 font-medium transition-colors disabled:opacity-85 outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
      >
        {isRunning && <Loader2 className="size-3.5 animate-spin shrink-0 text-primary-foreground" />}
        <span>{isRunning ? (statusLabel[compileStatus] ?? 'Compiling…') : 'Recompile'}</span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Compile options"
            className="flex items-center justify-center h-7 px-1.5 shrink-0 rounded-r-md bg-primary hover:bg-primary-hover text-primary-foreground border-l border-primary-foreground/25 text-xs transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
          >
            <ChevronDown className="size-3.5 text-current" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-[235px] p-1.5 space-y-0.5 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md text-xs"
        >
          {/* ── Section 1: Auto compile ── */}
          <DropdownMenuGroup>
            <div className="text-12 font-medium text-muted-foreground px-2.5 pt-1.5 pb-1 select-none">
              Auto compile
            </div>
            <DropdownMenuItem
              onClick={() => setAutoCompile(true)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>On</span>
              {autoCompile && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setAutoCompile(false)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>Off</span>
              {!autoCompile && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {/* Divider 1 */}
          <DropdownMenuSeparator className="mx-1 my-1.5 border-b border-border h-0 bg-transparent" />

          {/* ── Section 2: Compile mode ── */}
          <DropdownMenuGroup>
            <div className="text-12 font-medium text-muted-foreground px-2.5 pt-1.5 pb-1 select-none">
              Compile mode
            </div>
            <DropdownMenuItem
              onClick={() => setCompileMode('full')}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>Normal</span>
              {compileMode === 'full' && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setCompileMode('draft')}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>Fast [draft]</span>
              {compileMode === 'draft' && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {/* Divider 2 */}
          <DropdownMenuSeparator className="mx-1 my-1.5 border-b border-border h-0 bg-transparent" />

          {/* ── Section 3: Syntax checks ── */}
          <DropdownMenuGroup>
            <div className="text-12 font-medium text-muted-foreground px-2.5 pt-1.5 pb-1 select-none">
              Syntax checks
            </div>
            <DropdownMenuItem
              onClick={() => setLinterEnabled(true)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>Check syntax before compile</span>
              {linterEnabled && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLinterEnabled(false)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>Don&apos;t check syntax</span>
              {!linterEnabled && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {/* Divider 3 */}
          <DropdownMenuSeparator className="mx-1 my-1.5 border-b border-border h-0 bg-transparent" />

          {/* ── Section 4: Compile error handling ── */}
          <DropdownMenuGroup>
            <div className="text-12 font-medium text-muted-foreground px-2.5 pt-1.5 pb-1 select-none">
              Compile error handling
            </div>
            <DropdownMenuItem
              onClick={() => setStopOnFirstError(true)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>Stop on first error</span>
              {stopOnFirstError && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setStopOnFirstError(false)}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-sm text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors text-xs font-normal select-none"
            >
              <span>Try to compile despite errors</span>
              {!stopOnFirstError && <Check className="size-3.5 text-foreground stroke-2 ml-auto shrink-0" />}
            </DropdownMenuItem>
          </DropdownMenuGroup>

          {/* Divider 4 */}
          <DropdownMenuSeparator className="mx-1 my-1.5 border-b border-border h-0 bg-transparent" />

          {/* ── Section 5: Recompile from scratch ── */}
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleRecompileFromScratch}
              className="flex items-center px-2.5 py-1.5 rounded-sm text-xs font-normal text-foreground hover:bg-muted focus:bg-muted focus:text-foreground cursor-pointer transition-colors select-none"
            >
              Recompile from scratch
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
