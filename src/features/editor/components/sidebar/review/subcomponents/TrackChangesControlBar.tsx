'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import type { TrackChangesViewMode } from '@/features/editor/store';

interface TrackChangesControlBarProps {
  reviewMode: boolean;
  onToggleReviewMode: (enabled: boolean) => void;
  viewMode: TrackChangesViewMode;
  onViewModeChange: (mode: TrackChangesViewMode) => void;
  pendingCount?: number;
  className?: string;
}

export function TrackChangesControlBar({
  reviewMode,
  onToggleReviewMode,
  viewMode,
  onViewModeChange,
  pendingCount = 0,
  className,
}: TrackChangesControlBarProps) {
  const showViewMode = reviewMode || pendingCount > 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-border bg-muted/20 px-3.5 py-2.5 shrink-0 select-none',
        className,
      )}
    >
      {/* Track Changes toggle row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground tracking-tight">
          Track Changes
        </span>

        <div className="inline-flex rounded-md p-0.5 bg-muted/80 border border-border/50 text-xs">
          <button
            type="button"
            onClick={() => onToggleReviewMode(false)}
            className={cn(
              'px-2.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              !reviewMode
                ? 'bg-background text-foreground font-semibold border border-border/60'
                : 'text-muted-foreground hover:text-foreground border border-transparent',
            )}
            aria-pressed={!reviewMode}
          >
            Off
          </button>
          <button
            type="button"
            onClick={() => onToggleReviewMode(true)}
            className={cn(
              'px-2.5 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              reviewMode
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={reviewMode}
          >
            On
          </button>
        </div>
      </div>

      {/* View Mode selection row */}
      {showViewMode && (
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
          <span className="text-11 font-medium text-muted-foreground">
            View
          </span>

          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value as TrackChangesViewMode)}
            className="text-xs bg-background text-foreground border border-border rounded px-2 py-0.5 outline-none focus:border-primary cursor-pointer font-medium"
            aria-label="Track changes view mode"
          >
            <option value="changes">Viewing changes</option>
            <option value="clean">Without changes</option>
            <option value="original">Raw source</option>
          </select>
        </div>
      )}
    </div>
  );
}

export default TrackChangesControlBar;
