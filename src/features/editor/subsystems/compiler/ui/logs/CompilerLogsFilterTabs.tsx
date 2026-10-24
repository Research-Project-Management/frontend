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
          'h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
          activeTab === 'all'
            ? 'bg-muted text-foreground font-semibold ring-1 ring-inset ring-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
        )}
      >
        <span>All logs</span>
        <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-muted-foreground">
          {totalLogsCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'errors'}
        onClick={() => onSelectTab('errors')}
        className={cn(
          'h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
          activeTab === 'errors'
            ? 'bg-muted text-foreground font-semibold ring-1 ring-inset ring-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
        )}
      >
        <span>Errors</span>
        <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-muted-foreground">
          {errorsCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'warnings'}
        onClick={() => onSelectTab('warnings')}
        className={cn(
          'h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
          activeTab === 'warnings'
            ? 'bg-muted text-foreground font-semibold ring-1 ring-inset ring-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
        )}
      >
        <span>Warnings</span>
        <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-muted-foreground">
          {warningsCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'info'}
        onClick={() => onSelectTab('info')}
        className={cn(
          'h-7 px-2.5 rounded-md flex items-center gap-1.5 text-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
          activeTab === 'info'
            ? 'bg-muted text-foreground font-semibold ring-1 ring-inset ring-border'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 font-medium'
        )}
      >
        <span>Info</span>
        <span className="px-1.5 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-muted-foreground">
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
