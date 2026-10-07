'use client';

import React from 'react';
import { RotateCcw, Tag, Download, MoreVertical } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

interface TimelineOption {
  id: string;
  date: string | Date;
  author: string;
  versionNumber?: number;
}

interface HistoryViewerHeaderProps {
  viewMode: 'diff' | 'snapshot';
  onChangeViewMode: (mode: 'diff' | 'snapshot') => void;
  activeFileName: string;
  formattedRevisionDate: string;
  compareTargetId: string;
  onChangeCompareTargetId: (id: string) => void;
  timelineItems: TimelineOption[];
  selectedEventId: string | null;
  additions: number;
  deletions: number;
  filesChangedCount?: number;
  activeVersionLabel?: string;
  onOpenRestoreModal: () => void;
  onOpenLabelModal: () => void;
  onDownloadZip: () => void;
}

export function HistoryViewerHeader({
  viewMode,
  onChangeViewMode,
  activeFileName,
  formattedRevisionDate,
  compareTargetId,
  onChangeCompareTargetId,
  timelineItems,
  selectedEventId,
  additions,
  deletions,
  filesChangedCount,
  activeVersionLabel,
  onOpenRestoreModal,
  onOpenLabelModal,
  onDownloadZip,
}: HistoryViewerHeaderProps) {
  const isDiffMode = viewMode === 'diff';

  return (
    <div className="h-10 px-3 border-b border-border bg-muted/30 flex items-center justify-between text-12 shrink-0 select-none gap-2">
      {/* Left side: Revision info, Mode Switcher, Compare selector & Diff stats */}
      <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
        {/* Revision date */}
        <span className="font-mono text-12 font-medium text-foreground/90 truncate shrink-0">
          Viewing: {formattedRevisionDate}
        </span>

        {/* Mode Switcher: Compare Diff vs View Source */}
        <div className="inline-flex items-center rounded-md bg-muted p-0.5 gap-0.5 text-11 shrink-0 border border-border">
          <button
            type="button"
            onClick={() => onChangeViewMode('diff')}
            aria-pressed={isDiffMode}
            className={cn(
              'px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              isDiffMode
                ? 'bg-background text-foreground font-semibold border border-border/60'
                : 'text-muted-foreground hover:text-foreground border border-transparent',
            )}
          >
            Compare Diff
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode('snapshot')}
            aria-pressed={!isDiffMode}
            className={cn(
              'px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              !isDiffMode
                ? 'bg-background text-foreground font-semibold border border-border/60'
                : 'text-muted-foreground hover:text-foreground border border-transparent',
            )}
          >
            View Source
          </button>
        </div>

        {/* Compare selector (only in diff mode) */}
        {isDiffMode && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <label htmlFor="compare-target-select" className="text-11 text-muted-foreground shrink-0 font-mono">
              Compare against:
            </label>
            <select
              id="compare-target-select"
              aria-label="Compare against revision"
              value={compareTargetId}
              onChange={(e) => onChangeCompareTargetId(e.target.value)}
              className="h-6.5 px-2 text-11 font-mono font-medium rounded-md border border-border bg-background text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="current">Current editor</option>
              <option value="previous">Previous version</option>
              {timelineItems
                .filter((item) => item.id !== selectedEventId)
                .map((item) => {
                  const d = new Date(item.date);
                  const timeStr = isNaN(d.getTime())
                    ? 'Revision'
                    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
                      ' ' +
                      d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
                  return (
                    <option key={item.id} value={item.id}>
                      {timeStr} · {item.author}
                    </option>
                  );
                })}
            </select>
          </div>
        )}

        {/* Diff Stats Badge (No parentheses) */}
        {isDiffMode && (
          <div className="hidden md:flex items-center gap-1.5 text-11 font-mono shrink-0">
            <span className="px-1.5 py-0.5 rounded-md bg-success/15 text-success font-semibold border border-success/30">
              +{additions}
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-destructive/15 text-destructive font-semibold border border-destructive/30">
              -{deletions}
            </span>
            {filesChangedCount !== undefined && filesChangedCount > 0 && (
              <span className="text-muted-foreground text-11 font-sans">
                Files changed: {filesChangedCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side: Active file indicator & Canonical Single Action Group */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="text-muted-foreground font-mono text-11 hidden lg:inline truncate max-w-[160px]"
          title={activeFileName}
        >
          {activeFileName}
        </span>

        {/* Desktop actions: Restore, Label, Download */}
        <div className="hidden sm:flex items-center gap-1.5">
          {/* Canonical Restore Button */}
          <button
            type="button"
            onClick={onOpenRestoreModal}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Restore version or file"
            aria-label="Restore version or file"
          >
            <RotateCcw className="size-3 shrink-0" />
            <span>Restore version</span>
          </button>

          {/* Canonical Label Button */}
          <button
            type="button"
            onClick={onOpenLabelModal}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-11 font-medium transition-colors cursor-pointer outline-none border focus-visible:ring-1 focus-visible:ring-primary',
              activeVersionLabel
                ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                : 'border-border bg-background hover:bg-muted text-foreground',
            )}
            title={activeVersionLabel ? `Milestone: ${activeVersionLabel}` : 'Add milestone label'}
            aria-label={activeVersionLabel ? 'Edit milestone label' : 'Add milestone label'}
          >
            <Tag className="size-3 shrink-0" />
            <span>{activeVersionLabel ? 'Edit label' : 'Label version'}</span>
          </button>

          {/* Canonical Download Button */}
          <button
            type="button"
            onClick={onDownloadZip}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background hover:bg-muted text-foreground font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Download ZIP archive of this version"
            aria-label="Download ZIP archive of this version"
          >
            <Download className="size-3 shrink-0" />
            <span className="hidden md:inline">Download ZIP</span>
          </button>
        </div>

        {/* Mobile / Narrow Screen Dropdown */}
        <div className="sm:hidden flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenRestoreModal}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            title="Restore version"
          >
            <RotateCcw className="size-3 shrink-0" />
            <span>Restore</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                className="size-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <MoreVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 p-1">
              <DropdownMenuItem
                onClick={onOpenLabelModal}
                className="cursor-pointer gap-2 text-12 rounded-md"
              >
                <Tag className="size-3.5 text-primary shrink-0" />
                <span>{activeVersionLabel ? 'Edit label' : 'Label version'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDownloadZip}
                className="cursor-pointer gap-2 text-12 rounded-md"
              >
                <Download className="size-3.5 text-foreground shrink-0" />
                <span>Download ZIP</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

export default HistoryViewerHeader;
