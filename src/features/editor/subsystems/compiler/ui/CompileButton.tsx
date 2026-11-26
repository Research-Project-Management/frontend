'use client';

/**
 * CompileButton.tsx
 *
 * Dedicated Overleaf-parity recompile button with integrated options dropdown (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/compiler/ui/CompileButton.tsx`
 */

import React from 'react';
import {
  ChevronDown,
  Loader2,
  Check,
  Square,
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
import { useCompileStore } from '@/features/editor/subsystems/compiler/store/compiler.store';
import { useSettingsStore } from '@/features/editor/core';
import { compilerSubsystem } from '@/features/editor/subsystems/compiler';

export interface CompileButtonProps {
  onCompile?: () => void;
  onClearCacheAndCompile?: () => void;
  onStopCompilation?: () => void;
  /**
   * Controls whether Auto-Compile, Compile Mode (Normal/Fast), and Stop-on-First-Error
   * options are exposed in the UI dropdown. Underlying design remains active in store/coordinators.
   * Defaults to false for lean server resource governance.
   */
  showCompileModeControls?: boolean;
}

export const CompileButton = React.memo(function CompileButton({
  onCompile,
  onClearCacheAndCompile,
  onStopCompilation,
  showCompileModeControls = true,
}: CompileButtonProps) {
  const compileStatus = useCompileStore((s) => s.compileStatus);

  const compileMode = useSettingsStore((s) => s.compileMode);
  const setCompileMode = useSettingsStore((s) => s.setCompileMode);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useSettingsStore((s) => s.setAutoCompile);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = useSettingsStore((s) => s.setStopOnFirstError);

  const isRunning =
    compileStatus === 'compiling' ||
    compileStatus === 'flushing' ||
    compileStatus === 'syncing';

  const handleCompile = React.useCallback(() => {
    if (onCompile) {
      onCompile();
    } else {
      void compilerSubsystem.compile({ reason: 'manual-button' });
    }
  }, [onCompile]);

  const handleClearCacheAndCompile = React.useCallback(() => {
    if (onClearCacheAndCompile) {
      onClearCacheAndCompile();
    } else {
      void compilerSubsystem.compile({ forceClean: true, reason: 'manual-button' });
    }
  }, [onClearCacheAndCompile]);

  const handleStopCompilation = React.useCallback(() => {
    if (onStopCompilation) {
      onStopCompilation();
    } else {
      compilerSubsystem.abort();
    }
  }, [onStopCompilation]);

  return (
    <div className="inline-flex items-center rounded-md select-none">
      {/* ── Left: Main Action Button (Recompile / 1-Click Stop while running) ── */}
      {isRunning ? (
        <button
          type="button"
          onClick={handleStopCompilation}
          aria-label="Stop compilation"
          title="Click to stop compilation"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-l-md text-xs font-semibold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring select-none bg-primary text-primary-foreground hover:bg-destructive hover:text-destructive-foreground cursor-pointer group"
        >
          <Loader2 className="size-3.5 animate-spin shrink-0 group-hover:hidden" />
          <Square className="size-3 fill-current shrink-0 hidden group-hover:inline-block" />
          <span className="group-hover:hidden">Compiling...</span>
          <span className="hidden group-hover:inline">Stop</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCompile}
          aria-label="Recompile document (Ctrl+Enter)"
          title={
            compileMode === 'draft'
              ? 'Recompile in Fast (draft) mode (Ctrl+Enter)'
              : 'Recompile (Ctrl+Enter)'
          }
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-l-md text-xs font-semibold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring select-none bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
        >
          <span>{compileMode === 'draft' ? 'Recompile (Draft)' : 'Recompile'}</span>
        </button>
      )}

      {/* ── Right: Options Dropdown Trigger ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Compilation Options"
            className={cn(
              'flex items-center justify-center size-7 border-l border-primary-foreground/20 rounded-r-md bg-primary text-primary-foreground transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer relative after:absolute after:-inset-1.5 after:content-[\'\']',
              isRunning ? 'opacity-90 hover:opacity-100' : 'hover:bg-primary/90'
            )}
          >
            <ChevronDown className="size-3.5 shrink-0 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="w-56 p-1 text-xs bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50 select-none"
        >
          {showCompileModeControls && (
            <>
              {/* Group 1: Auto Compile */}
              <div className="px-2.5 py-1.5 text-12 font-medium text-muted-foreground select-none">
                Auto compile
              </div>
              <DropdownMenuItem
                onClick={() => setAutoCompile(true)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <span>On</span>
                {autoCompile && <Check className="size-3.5 text-foreground" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setAutoCompile(false)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <span>Off</span>
                {!autoCompile && <Check className="size-3.5 text-foreground" />}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Group 2: Compile Mode */}
              <div className="px-2.5 py-1.5 text-12 font-medium text-muted-foreground select-none">
                Compile mode
              </div>
              <DropdownMenuItem
                onClick={() => setCompileMode('full')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <span>Normal</span>
                {compileMode === 'full' && <Check className="size-3.5 text-foreground" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setCompileMode('draft')}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <span>Fast (draft)</span>
                {compileMode === 'draft' && <Check className="size-3.5 text-foreground" />}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Group 3: Stop on first error */}
              <DropdownMenuItem
                onClick={() => setStopOnFirstError(!stopOnFirstError)}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
              >
                <span>Stop on first error</span>
                {stopOnFirstError && <Check className="size-3.5 text-foreground" />}
              </DropdownMenuItem>

              <DropdownMenuSeparator />
            </>
          )}

          {/* Group 4: Advanced Clear Cache Actions */}
          <DropdownMenuItem
            onClick={handleClearCacheAndCompile}
            className="flex items-center px-2 py-1.5 text-destructive hover:bg-destructive/10 rounded-sm cursor-pointer"
          >
            <span>Recompile from scratch</span>
          </DropdownMenuItem>

          {/* Stop compilation if running */}
          {isRunning && (
            <DropdownMenuItem
              onClick={handleStopCompilation}
              className="flex items-center px-2 py-1.5 text-destructive font-medium hover:bg-destructive/10 rounded-sm cursor-pointer"
            >
              <span>Stop compilation</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
