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
}

export function CompilerLogsFilterTabs({
  activeTab,
  onSelectTab,
  totalLogsCount,
  errorsCount,
  warningsCount,
  badBoxesCount,
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
            warningsCount > 0 ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-muted text-foreground/80 font-medium'
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
    </nav>
  );
}
