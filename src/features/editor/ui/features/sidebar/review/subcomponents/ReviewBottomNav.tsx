'use client';

import React from 'react';
import { FileText, List } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type ReviewScope = 'current' | 'overview';

interface ReviewBottomNavProps {
  scope: ReviewScope;
  onScopeChange: (scope: ReviewScope) => void;
}

export function ReviewBottomNav({ scope, onScopeChange }: ReviewBottomNavProps) {
  return (
    <nav aria-label="Review scope" className="flex h-11 shrink-0 border-t border-border bg-background select-none">
      {/* Current File Tab */}
      <button
        type="button"
        onClick={() => onScopeChange('current')}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors cursor-pointer text-xs font-medium',
          scope === 'current'
            ? 'text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {scope === 'current' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
        )}
        <FileText className="size-3.5 shrink-0" />
        <span className="leading-tight">Current file</span>
      </button>

      {/* Overview Tab */}
      <button
        type="button"
        onClick={() => onScopeChange('overview')}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors cursor-pointer text-xs font-medium',
          scope === 'overview'
            ? 'text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {scope === 'overview' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-primary" />
        )}
        <List className="size-3.5 shrink-0" />
        <span className="leading-tight">Overview</span>
      </button>
    </nav>
  );
}

export default ReviewBottomNav;
