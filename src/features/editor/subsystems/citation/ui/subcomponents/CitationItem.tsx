'use client';

import React, { memo } from 'react';
import { Info, Copy, Check, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { UnifiedCitation } from '@/features/editor/subsystems/citation/ui/hooks/useCitationTabState';

interface CitationItemProps {
  item: UnifiedCitation;
  isCopied: boolean;
  onSelect: (key: string) => void;
  onCopy: (key: string) => void;
  onInspect: (key: string) => void;
}

export const CitationItem = memo(function CitationItem({
  item,
  isCopied,
  onSelect,
  onCopy,
  onInspect,
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
      className="group relative flex flex-col gap-1 p-2.5 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border text-left select-none border border-transparent hover:border-border/60"
    >
      {/* 1. Header line: Citation Key + Type badge + Year */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 pr-16 sm:pr-0">
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

      {/* 4. Action buttons on hover: Clean neutral muted style, consistent with shell */}
      <div className="absolute right-2 top-2 opacity-90 sm:opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center gap-0.5 bg-background p-0.5 rounded-md border border-border shadow-none">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect(item.key);
          }}
          className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Details"
          aria-label="Inspect reference details"
        >
          <Info className="size-3.5 shrink-0" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(item.key);
          }}
          className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Copy \\cite key"
          aria-label="Copy citation key"
        >
          {isCopied ? (
            <Check className="size-3.5 text-foreground shrink-0" />
          ) : (
            <Copy className="size-3.5 shrink-0" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item.key);
          }}
          className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Insert \\cite"
          aria-label="Insert citation"
        >
          <Plus className="size-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
});

export default CitationItem;
