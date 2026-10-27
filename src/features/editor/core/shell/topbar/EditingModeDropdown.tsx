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
import { useSettingsStore } from '../../store/settings.store';

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
          className="flex items-center gap-1 h-7 px-1.5 rounded-md text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border select-none"
        >
          {currentMode === 'viewing' ? (
            <Eye className="size-3.5 shrink-0 text-foreground" />
          ) : currentMode === 'reviewing' ? (
            <MessageSquare className="size-3.5 shrink-0 text-foreground" />
          ) : (
            <Pen className="size-3.5 shrink-0 text-foreground" />
          )}

          <ChevronDown className="size-3 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-64 p-1 text-xs bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md z-50 select-none"
      >
        <div className="px-2.5 py-1.5 text-12 font-medium text-muted-foreground select-none">
          Editing mode
        </div>

        <DropdownMenuItem
          onClick={() => handleSelectMode('editing')}
          className={cn(
            'flex items-center justify-between gap-3 px-2.5 py-2 rounded-sm cursor-pointer transition-colors whitespace-normal',
            currentMode === 'editing' ? 'bg-muted font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Pen className="size-3.5 shrink-0 text-foreground mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-foreground leading-tight">Editing</span>
              <span className="text-11 text-muted-foreground font-normal leading-snug mt-0.5">
                Directly edit the document
              </span>
            </div>
          </div>
          {currentMode === 'editing' && <Check className="size-3.5 shrink-0 text-foreground" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSelectMode('reviewing')}
          className={cn(
            'flex items-center justify-between gap-3 px-2.5 py-2 rounded-sm cursor-pointer transition-colors whitespace-normal',
            currentMode === 'reviewing' ? 'bg-muted font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <MessageSquare className="size-3.5 shrink-0 text-foreground mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-foreground leading-tight">Reviewing</span>
              <span className="text-11 text-muted-foreground font-normal leading-snug mt-0.5">
                Track changes and add comments
              </span>
            </div>
          </div>
          {currentMode === 'reviewing' && <Check className="size-3.5 shrink-0 text-foreground" />}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleSelectMode('viewing')}
          className={cn(
            'flex items-center justify-between gap-3 px-2.5 py-2 rounded-sm cursor-pointer transition-colors whitespace-normal',
            currentMode === 'viewing' ? 'bg-muted font-medium' : 'hover:bg-muted',
          )}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Eye className="size-3.5 shrink-0 text-foreground mt-0.5" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-foreground leading-tight">Viewing</span>
              <span className="text-11 text-muted-foreground font-normal leading-snug mt-0.5">
                View only, prevent accidental edits
              </span>
            </div>
          </div>
          {currentMode === 'viewing' && <Check className="size-3.5 shrink-0 text-foreground" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default EditingModeDropdown;
