'use client';

/**
 * EditingModeDropdown.tsx
 *
 * Canonical Overleaf-parity Editing Mode Switcher in Top-Right Corner.
 * Citation: Overleaf Learn - Track Changes & Reviewing mode in Overleaf.
 * Location: `features/editor/ui/shell/topbar/EditingModeDropdown.tsx`
 */

import React from 'react';
import { Pen, MessageSquare, Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore } from '@/features/editor/store';

export function EditingModeDropdown() {
  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const setReviewMode = useSettingsStore((s) => s.setReviewMode);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={reviewMode ? 'Editing mode: Reviewing (Track Changes ON)' : 'Editing mode: Direct Editing'}
              className={cn(
                'flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none',
                reviewMode
                  ? 'bg-primary/15 text-primary hover:bg-primary/20 font-semibold'
                  : 'text-foreground/80 hover:text-foreground hover:bg-sidebar-hover',
              )}
            >
              {reviewMode ? (
                <MessageSquare className="size-3.5 shrink-0 text-primary" />
              ) : (
                <Pen className="size-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {reviewMode ? 'Reviewing' : 'Editing'}
              </span>
              <ChevronDown className="size-3 opacity-60 shrink-0" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {reviewMode ? 'Reviewing mode (Track changes active)' : 'Editing mode (Direct editing)'}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 p-1.5 text-xs bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50 select-none"
      >
        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Editing Mode
        </div>

        <DropdownMenuItem
          onClick={() => setReviewMode(false)}
          className={cn(
            'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer transition-colors',
            !reviewMode ? 'bg-muted font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-center gap-2">
            <Pen className="size-3.5 shrink-0 text-foreground" />
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Editing</span>
              <span className="text-[10px] text-muted-foreground">Edit files directly</span>
            </div>
          </div>
          {!reviewMode && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => setReviewMode(true)}
          className={cn(
            'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer transition-colors',
            reviewMode ? 'bg-primary/10 font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="size-3.5 shrink-0 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Reviewing</span>
              <span className="text-[10px] text-muted-foreground">Track changes & comments</span>
            </div>
          </div>
          {reviewMode && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EditingModeDropdown;
