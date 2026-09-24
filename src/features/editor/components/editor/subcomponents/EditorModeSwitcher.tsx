'use client';

import React from 'react';
import {
  PenLine,
  MessageSquareQuote,
  ChevronDown,
  Check,
  Lock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore } from '@/features/editor/store';

export interface EditorModeSwitcherProps {
  reviewMode: boolean;
  onSelectMode: (mode: 'editing' | 'reviewing') => void;
  isReviewerOnly?: boolean;
  className?: string;
}

export const EditorModeSwitcher = React.memo(function EditorModeSwitcher({
  reviewMode,
  onSelectMode,
  isReviewerOnly = false,
  className,
}: EditorModeSwitcherProps) {
  const trackChangesViewMode = useSettingsStore((s) => s.trackChangesViewMode);
  const setTrackChangesViewMode = useSettingsStore((s) => s.setTrackChangesViewMode);

  const triggerButton = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded-sm text-xs font-medium transition-colors cursor-pointer outline-none select-none border',
        reviewMode
          ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
          : 'bg-muted/60 text-foreground/80 border-border hover:bg-muted hover:text-foreground',
        isReviewerOnly && 'cursor-default opacity-90',
        className,
      )}
      aria-label={`Editor Mode: ${reviewMode ? 'Reviewing' : 'Editing'}`}
    >
      {reviewMode ? (
        <>
          <MessageSquareQuote className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold">Reviewing</span>
          {isReviewerOnly ? (
            <Lock className="size-2.5 shrink-0 text-amber-600/70 dark:text-amber-400/70 ml-0.5" />
          ) : (
            <ChevronDown className="size-3 shrink-0 opacity-60 ml-0.5" />
          )}
        </>
      ) : (
        <>
          <PenLine className="size-3 shrink-0 text-foreground/70" />
          <span className="hidden md:inline">Editing</span>
          <ChevronDown className="size-3 shrink-0 opacity-60 ml-0.5" />
        </>
      )}
    </button>
  );

  if (isReviewerOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs">
          Your account role is Reviewer. Direct source modifications are disabled;
          all edits are proposed as track-change suggestions.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-xs p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200">
        <DropdownMenuItem
          onClick={() => onSelectMode('editing')}
          className={cn(
            'flex items-start gap-2.5 py-1.5 px-2 cursor-pointer rounded-sm',
            !reviewMode && 'bg-accent font-medium text-accent-foreground',
          )}
        >
          <PenLine className="size-3.5 mt-0.5 shrink-0 text-foreground/70" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium">Editing</span>
              {!reviewMode && <Check className="size-3 shrink-0 text-primary" />}
            </div>
            <p className="text-11 text-muted-foreground font-normal leading-tight mt-0.5">
              Edit document directly in real-time
            </p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => onSelectMode('reviewing')}
          className={cn(
            'flex items-start gap-2.5 py-1.5 px-2 cursor-pointer rounded-sm',
            reviewMode && 'bg-amber-500/10 text-amber-900 dark:text-amber-200 font-medium',
          )}
        >
          <MessageSquareQuote className="size-3.5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-800 dark:text-amber-300">
                Reviewing
              </span>
              {reviewMode && (
                <Check className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <p className="text-11 text-muted-foreground font-normal leading-tight mt-0.5">
              Edits become proposed suggestions (Track Changes)
            </p>
          </div>
        </DropdownMenuItem>

        {reviewMode && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <div className="px-2 py-1 text-10 font-semibold text-muted-foreground tracking-normal">
              Display Mode
            </div>
            <DropdownMenuItem
              onClick={() => setTrackChangesViewMode('changes')}
              className={cn(
                'flex items-center justify-between py-1 px-2 cursor-pointer rounded-sm',
                trackChangesViewMode === 'changes' && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              <span>View Changes (Diff)</span>
              {trackChangesViewMode === 'changes' && <Check className="size-3 shrink-0 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTrackChangesViewMode('clean')}
              className={cn(
                'flex items-center justify-between py-1 px-2 cursor-pointer rounded-sm',
                trackChangesViewMode === 'clean' && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              <span>View Clean (Preview)</span>
              {trackChangesViewMode === 'clean' && <Check className="size-3 shrink-0 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTrackChangesViewMode('original')}
              className={cn(
                'flex items-center justify-between py-1 px-2 cursor-pointer rounded-sm',
                trackChangesViewMode === 'original' && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              <span>View Original</span>
              {trackChangesViewMode === 'original' && <Check className="size-3 shrink-0 text-primary" />}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default EditorModeSwitcher;
