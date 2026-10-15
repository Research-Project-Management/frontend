'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';

export type TabType = 'all' | 'errors' | 'warnings' | 'info';

export interface CompilerLogsFilterTabsProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  totalLogsCount: number;
  errorsCount: number;
  warningsCount: number;
  badBoxesCount: number;
  suppressedCount?: number;
  filterSuppressed?: boolean;
  onToggleFilterSuppressed?: () => void;
}

export function CompilerLogsFilterTabs({
  activeTab,
  onSelectTab,
  totalLogsCount,
  errorsCount,
  warningsCount,
  badBoxesCount,
  suppressedCount = 0,
  filterSuppressed = true,
  onToggleFilterSuppressed,
}: CompilerLogsFilterTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Log filter categories"
      className="h-9 px-3 bg-canvas border-b border-border/70 flex items-center gap-4 shrink-0 overflow-x-auto no-scrollbar font-sans"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'all'}
        onClick={() => onSelectTab('all')}
        className={cn(
          'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
          activeTab === 'all'
            ? 'border-primary text-foreground font-semibold'
            : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
        )}
      >
        <span>All logs</span>
        <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-foreground/80">
          {totalLogsCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'errors'}
        onClick={() => onSelectTab('errors')}
        className={cn(
          'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
          activeTab === 'errors'
            ? 'border-primary text-foreground font-semibold'
            : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
        )}
      >
        <span>Errors</span>
        <span
          className={cn(
            'px-1.5 py-0.5 rounded-full text-xs font-mono font-semibold',
            errorsCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-foreground/80 font-medium'
          )}
        >
          {errorsCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'warnings'}
        onClick={() => onSelectTab('warnings')}
        className={cn(
          'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
          activeTab === 'warnings'
            ? 'border-primary text-foreground font-semibold'
            : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
        )}
      >
        <span>Warnings</span>
        <span
          className={cn(
            'px-1.5 py-0.5 rounded-full text-xs font-mono font-semibold',
            warningsCount > 0 ? 'bg-warning/15 text-warning border border-warning/20' : 'bg-muted text-foreground/80 font-medium'
          )}
        >
          {warningsCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'info'}
        onClick={() => onSelectTab('info')}
        className={cn(
          'h-full flex items-center gap-1.5 text-xs transition-colors cursor-pointer border-b-2 outline-none focus-visible:ring-1 focus-visible:ring-primary',
          activeTab === 'info'
            ? 'border-primary text-foreground font-semibold'
            : 'border-transparent text-muted-foreground hover:text-foreground font-medium'
        )}
      >
        <span>Info</span>
        <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-foreground/80">
          {badBoxesCount}
        </span>
      </button>

      {suppressedCount > 0 && onToggleFilterSuppressed && (
        <div className="ml-auto flex items-center pr-1">
          <button
            type="button"
            onClick={onToggleFilterSuppressed}
            data-testid="toggle-suppressed-warnings-btn"
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border flex items-center gap-1.5 relative after:absolute after:-inset-1.5 after:content-[\'\']',
              filterSuppressed
                ? 'bg-muted/70 text-muted-foreground border-border hover:bg-muted'
                : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
            )}
          >
            <span>{filterSuppressed ? `Suppressed (${suppressedCount})` : 'Showing all'}</span>
          </button>
        </div>
      )}
    </nav>
  );
}
