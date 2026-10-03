'use client';

import React from 'react';
import {
  PenLine,
  MessageSquareQuote,
  Check,
  Lock,
} from 'lucide-react';
import {
  OverleafPenIcon,
  OverleafCaretDownIcon,
} from '@/features/editor/sub-features/code-editor/components/OverleafToolbarIcons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
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
        'inline-flex items-center justify-center gap-1 h-7 px-1.5 rounded-sm text-xs font-medium transition-colors cursor-pointer outline-none select-none text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95',
        reviewMode && 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40 hover:bg-amber-500/20',
        isReviewerOnly && 'cursor-default opacity-90',
        className,
      )}
      aria-label={`Editor Mode: ${reviewMode ? 'Reviewing' : 'Editing'}`}
      title={reviewMode ? 'Reviewing mode' : 'Editing mode'}
    >
      <OverleafPenIcon className={cn('size-3.5 shrink-0', reviewMode ? 'text-amber-500 dark:text-amber-400' : 'text-foreground')} />
      {isReviewerOnly ? (
        <Lock className="size-2.5 shrink-0 text-amber-400" />
      ) : (
        <OverleafCaretDownIcon className="h-2 w-auto opacity-70 ml-0.5 shrink-0" />
      )}
    </button>
  );

  if (isReviewerOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Reviewer role (Suggestions only)
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 p-1.5 z-[9999] rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
      >
        <DropdownMenuItem
          onClick={() => onSelectMode('editing')}
          className={cn(
            'flex items-start gap-2.5 p-2 rounded-md cursor-pointer transition-colors outline-none',
            !reviewMode
              ? 'bg-muted text-foreground font-medium'
              : 'hover:bg-muted text-foreground/90',
          )}
        >
          <PenLine className={cn('size-4 mt-0.5 shrink-0', !reviewMode ? 'text-primary' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <div className={cn('font-semibold text-13 leading-snug text-foreground')}>
              Editing
            </div>
            <div className={cn('text-12 leading-normal mt-0.5 text-muted-foreground')}>
              Edit content directly
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onSelectMode('reviewing')}
          className={cn(
            'flex items-start gap-2.5 p-2 mt-1 rounded-md cursor-pointer transition-colors outline-none',
            reviewMode
              ? 'bg-muted text-foreground font-medium'
              : 'hover:bg-muted text-foreground/90',
          )}
        >
          <MessageSquareQuote className={cn('size-4 mt-0.5 shrink-0', reviewMode ? 'text-primary' : 'text-muted-foreground')} />
          <div className="flex-1 min-w-0">
            <div className={cn('font-semibold text-13 leading-snug text-foreground')}>
              Reviewing
            </div>
            <div className={cn('text-12 leading-normal mt-0.5 text-muted-foreground')}>
              Edits become suggestions
            </div>
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
              <span>Changes (Diff)</span>
              {trackChangesViewMode === 'changes' && <Check className="size-3 shrink-0 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTrackChangesViewMode('clean')}
              className={cn(
                'flex items-center justify-between py-1 px-2 cursor-pointer rounded-sm',
                trackChangesViewMode === 'clean' && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              <span>Clean (Preview)</span>
              {trackChangesViewMode === 'clean' && <Check className="size-3 shrink-0 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTrackChangesViewMode('original')}
              className={cn(
                'flex items-center justify-between py-1 px-2 cursor-pointer rounded-sm',
                trackChangesViewMode === 'original' && 'bg-accent font-medium text-accent-foreground',
              )}
            >
              <span>Original</span>
              {trackChangesViewMode === 'original' && <Check className="size-3 shrink-0 text-primary" />}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

export default EditorModeSwitcher;
