'use client';

/**
 * CompileButton.tsx
 *
 * Dedicated Overleaf-parity recompile button with integrated options dropdown (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/CompileButton.tsx`
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
  useSettingsStore,
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

  const compileMode = useSettingsStore((s) => s.compileMode);
  const setCompileMode = useSettingsStore((s) => s.setCompileMode);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useSettingsStore((s) => s.setAutoCompile);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = (stop: boolean) => useSettingsStore.setState({ stopOnFirstError: stop });

  const isRunning =
    compileStatus === 'compiling' ||
    compileStatus === 'flushing' ||
    compileStatus === 'syncing';

  return (
    <div className="inline-flex items-center rounded-md border border-border shadow-xs bg-sidebar select-none">
      {/* ── Left: Main Action Button ── */}
      <button
        type="button"
        onClick={onCompile}
        disabled={isRunning}
        aria-label="Recompile document (Ctrl+Enter)"
        title="Recompile (Ctrl+Enter)"
        className={cn(
          'flex items-center gap-1.5 h-7 px-2.5 rounded-l-md text-xs font-semibold transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer select-none',
          isRunning
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
        )}
      >
        {isRunning ? (
          <>
            <Loader2 className="size-3.5 animate-spin shrink-0" />
            <span>Compiling...</span>
          </>
        ) : (
          <span>Recompile</span>
        )}
      </button>

      {/* ── Right: Options Dropdown Trigger ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Compilation Options"
            className="flex items-center justify-center size-7 border-l border-primary/20 rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
          >
            <ChevronDown className="size-3.5 shrink-0 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={4}
          className="w-56 p-1 text-xs bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50 select-none"
        >
          {/* Group 1: Auto Compile */}
          <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Auto Compile
          </div>
          <DropdownMenuItem
            onClick={() => setAutoCompile(true)}
            className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
          >
            <span>On</span>
            {autoCompile && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setAutoCompile(false)}
            className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
          >
            <span>Off</span>
            {!autoCompile && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 border-t border-border" />

          {/* Group 2: Compile Mode */}
          <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Compile Mode
          </div>
          <DropdownMenuItem
            onClick={() => setCompileMode('full')}
            className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
          >
            <span>Normal</span>
            {compileMode === 'full' && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setCompileMode('draft')}
            className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
          >
            <span>Fast (draft)</span>
            {compileMode === 'draft' && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 border-t border-border" />

          {/* Group 3: Stop on first error */}
          <DropdownMenuItem
            onClick={() => setStopOnFirstError(!stopOnFirstError)}
            className="flex items-center justify-between px-2 py-1.5 rounded-sm hover:bg-muted cursor-pointer"
          >
            <span>Stop on first error</span>
            {stopOnFirstError && <Check className="size-3.5 text-primary" />}
          </DropdownMenuItem>

          {/* Group 4: Advanced Clear Cache Actions */}
          {onClearCacheAndCompile && (
            <>
              <DropdownMenuSeparator className="my-1 border-t border-border" />
              <DropdownMenuItem
                onClick={onClearCacheAndCompile}
                className="flex items-center px-2 py-1.5 text-destructive hover:bg-destructive/10 rounded-sm cursor-pointer"
              >
                <span>Recompile from scratch</span>
              </DropdownMenuItem>
            </>
          )}

          {/* Stop compilation if running */}
          {isRunning && onStopCompilation && (
            <DropdownMenuItem
              onClick={onStopCompilation}
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
