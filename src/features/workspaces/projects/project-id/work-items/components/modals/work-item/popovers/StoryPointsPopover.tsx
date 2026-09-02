'use client';

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Hash, Check, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { STORY_POINT_OPTIONS } from '../../../../types/work-item.types';

interface StoryPointsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyPoints?: number | null;
  setStoryPoints: (pts: number | null) => void;
  actionBtnClass?: string;
  isReadOnly?: boolean;
}

export const StoryPointsPopover: React.FC<StoryPointsPopoverProps> = ({
  open,
  onOpenChange,
  storyPoints,
  setStoryPoints,
  actionBtnClass,
  isReadOnly = false,
}) => {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-sm border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer',
            actionBtnClass
          )}
        >
          <Hash className="size-3.5 text-amber-500" />
          <span>{storyPoints !== undefined && storyPoints !== null ? `${storyPoints} pts` : 'Estimate'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-1 rounded-sm border-border shadow-xl bg-popover z-100"
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1 flex items-center justify-between">
          <span>Story Points</span>
          {storyPoints !== null && storyPoints !== undefined && (
            <button
              type="button"
              onClick={() => {
                setStoryPoints(null);
                onOpenChange(false);
              }}
              className="text-[10px] text-muted-foreground hover:text-red-500 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-1 p-1">
          {STORY_POINT_OPTIONS.map((pts) => {
            const isSelected = storyPoints === pts;
            return (
              <button
                key={pts}
                type="button"
                onClick={() => {
                  setStoryPoints(pts);
                  onOpenChange(false);
                }}
                className={cn(
                  'h-8 rounded-xs text-xs font-semibold flex items-center justify-center border transition-all cursor-pointer',
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                    : 'border-border/60 hover:bg-muted text-foreground'
                )}
              >
                {pts}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
