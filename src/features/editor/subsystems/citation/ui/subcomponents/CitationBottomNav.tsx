'use client';

import React, { memo } from 'react';
import { FileText, Library } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CitationFilterTab } from '@/features/editor/subsystems/citation/ui/hooks/useCitationTabState';

interface CitationBottomNavProps {
  filterTab: CitationFilterTab;
  onFilterTabChange: (tab: CitationFilterTab) => void;
}

export const CitationBottomNav = memo(function CitationBottomNav({
  filterTab,
  onFilterTabChange,
}: CitationBottomNavProps) {
  return (
    <nav
      aria-label="Citations scope"
      className="flex h-11 shrink-0 border-t border-border bg-background select-none"
    >
      {/* In Document Tab */}
      <button
        type="button"
        onClick={() => onFilterTabChange('document')}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors cursor-pointer text-xs font-medium',
          filterTab === 'document'
            ? 'text-foreground font-semibold bg-muted/30'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {filterTab === 'document' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-foreground" />
        )}
        <FileText className="size-3.5 shrink-0" />
        <span className="leading-tight">In Document</span>
      </button>

      {/* Library Tab */}
      <button
        type="button"
        onClick={() => onFilterTabChange('library')}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 h-full transition-colors cursor-pointer text-xs font-medium',
          filterTab === 'library'
            ? 'text-foreground font-semibold bg-muted/30'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {filterTab === 'library' && (
          <div className="absolute top-0 inset-x-0 h-[2px] bg-foreground" />
        )}
        <Library className="size-3.5 shrink-0" />
        <span className="leading-tight">Library</span>
      </button>
    </nav>
  );
});

export default CitationBottomNav;
