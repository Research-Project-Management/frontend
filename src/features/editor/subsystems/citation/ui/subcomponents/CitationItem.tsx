'use client';

import React, { memo } from 'react';
import type { UnifiedCitation } from '@/features/editor/subsystems/citation/ui/hooks/useCitationTabState';

interface CitationItemProps {
  item: UnifiedCitation;
  isCopied?: boolean;
  onSelect: (key: string) => void;
  onCopy?: (key: string) => void;
  onInspect?: (key: string) => void;
}

export const CitationItem = memo(function CitationItem({
  item,
  onSelect,
}: CitationItemProps) {
  const hasMetadata = Boolean(item.authorsSummary || item.journal || item.year);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSelect(item.key);
        }
      }}
      className="group relative flex flex-col gap-1 p-2.5 rounded-md hover:bg-muted/60 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border text-left select-none border border-transparent hover:border-border/60"
    >
      {/* 1. Header line: Citation Key + Type badge + Year */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-11 font-medium text-foreground bg-muted/60 border border-border/70 px-1.5 py-0.5 rounded truncate shrink-0 max-w-[170px]">
            {item.key}
          </span>
          {item.source === 'bib' && (
            <span className="text-10 font-mono px-1 py-0.5 rounded-xs text-muted-foreground border border-border/40 shrink-0">
              .bib
            </span>
          )}
        </div>
        {item.year && (
          <span className="text-11 text-muted-foreground font-mono shrink-0">
            {item.year}
          </span>
        )}
      </div>

      {/* 2. Title */}
      <p className="text-13 font-medium text-foreground line-clamp-2 leading-snug tracking-tight">
        {item.title}
      </p>

      {/* 3. Authors & Publication info */}
      {hasMetadata && (
        <p className="text-12 text-muted-foreground truncate">
          {item.authorsSummary}
          {item.journal ? (item.authorsSummary ? ` · ${item.journal}` : item.journal) : ''}
        </p>
      )}
    </div>
  );
});

export default CitationItem;
