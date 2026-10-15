'use client';

/**
 * EditingModeDropdown.tsx
 *
 * Canonical Overleaf-parity Editing Mode Switcher in Top-Right Corner.
 * Citation: Overleaf Learn - Track Changes & Reviewing mode in Overleaf.
 * Location: `features/editor/ui/shell/topbar/EditingModeDropdown.tsx`
 */

import React from 'react';
import { Pen, MessageSquare, Eye, Check, ChevronDown } from 'lucide-react';
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
import { useSettingsStore } from '@/features/editor/core';

export function EditingModeDropdown() {
  const reviewMode = useSettingsStore((s) => s.reviewMode);
  const setReviewMode = useSettingsStore((s) => s.setReviewMode);
  const isLocked = useSettingsStore((s) => s.isLocked);
  const setIsLocked = useSettingsStore((s) => s.setIsLocked);

  const currentMode = isLocked ? 'viewing' : reviewMode ? 'reviewing' : 'editing';

  const handleSelectMode = (mode: 'editing' | 'reviewing' | 'viewing') => {
    if (mode === 'viewing') {
      setIsLocked(true);
      setReviewMode(false);
    } else if (mode === 'reviewing') {
      setIsLocked(false);
      setReviewMode(true);
    } else {
      setIsLocked(false);
      setReviewMode(false);
    }
  };

  const getLabel = () => {
    switch (currentMode) {
      case 'viewing':
        return 'Viewing';
      case 'reviewing':
        return 'Reviewing';
      default:
        return 'Editing';
    }
  };

  const getTooltip = () => {
    switch (currentMode) {
      case 'viewing':
        return 'Viewing mode (Read-only, edits prevented)';
      case 'reviewing':
        return 'Reviewing mode (Track changes active)';
      default:
        return 'Editing mode (Direct editing)';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={getTooltip()}
          aria-label={`Editing mode: ${getLabel()}`}
          className={cn(
            'flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none',
            currentMode === 'viewing'
              ? 'bg-warning/15 text-warning hover:bg-warning/20 font-semibold'
              : currentMode === 'reviewing'
                ? 'bg-primary/15 text-primary hover:bg-primary/20 font-semibold'
                : 'text-foreground/80 hover:text-foreground hover:bg-sidebar-hover',
          )}
        >
          {currentMode === 'viewing' ? (
            <Eye className="size-3.5 shrink-0 text-warning" />
          ) : currentMode === 'reviewing' ? (
            <MessageSquare className="size-3.5 shrink-0 text-primary" />
          ) : (
            <Pen className="size-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">
            {getLabel()}
          </span>
          <ChevronDown className="size-3 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 p-1.5 text-xs bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50 select-none"
      >
        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Editing Mode
        </div>

        <DropdownMenuItem
          onClick={() => handleSelectMode('editing')}
          className={cn(
            'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer transition-colors',
            currentMode === 'editing' ? 'bg-muted font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-center gap-2">
            <Pen className="size-3.5 shrink-0 text-foreground" />
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Editing</span>
              <span className="text-11 text-muted-foreground">Edit files directly</span>
            </div>
          </div>
          {currentMode === 'editing' && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSelectMode('reviewing')}
          className={cn(
            'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer transition-colors',
            currentMode === 'reviewing' ? 'bg-primary/10 font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="size-3.5 shrink-0 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Reviewing</span>
              <span className="text-11 text-muted-foreground">Track changes & comments</span>
            </div>
          </div>
          {currentMode === 'reviewing' && <Check className="size-3.5 text-primary" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSelectMode('viewing')}
          className={cn(
            'flex items-center justify-between px-2 py-1.5 rounded-sm cursor-pointer transition-colors',
            currentMode === 'viewing' ? 'bg-warning/10 font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-center gap-2">
            <Eye className="size-3.5 shrink-0 text-warning" />
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Viewing</span>
              <span className="text-11 text-muted-foreground">Read-only, prevent accidental edits</span>
            </div>
          </div>
          {currentMode === 'viewing' && <Check className="size-3.5 text-warning" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EditingModeDropdown;
