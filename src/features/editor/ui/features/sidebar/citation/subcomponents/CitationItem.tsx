'use client';

import React, { memo } from 'react';
import { Info, Copy, Check, Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { UnifiedCitation } from '../hooks/useCitationTabState';

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
      className="group relative flex flex-col gap-0.5 p-2 rounded-md hover:bg-muted/70 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary text-left select-none"
    >
      {/* Top row: Key + Source badge + Year */}
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-11 font-medium bg-background border border-border text-foreground px-1.5 py-0.5 rounded-[3px] truncate shrink-0 max-w-[150px]">
            {item.key}
          </span>
          {item.source === 'bib' && (
            <span className="text-11 font-mono px-1.5 py-0.5 rounded-xs bg-muted text-muted-foreground shrink-0 border border-border/40">
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

      {/* Title */}
      <p className="text-13 font-serif font-normal text-foreground line-clamp-2 leading-snug tracking-normal">
        {item.title}
      </p>

      {/* Authors & Journal */}
      <p className="text-12 text-muted-foreground truncate font-sans">
        {item.authorsSummary}
        {item.journal ? ` · ${item.journal}` : ''}
      </p>

      {/* Quick actions on hover */}
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center gap-0.5 bg-background/95 backdrop-blur-xs p-0.5 rounded-md border border-border">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInspect(item.key);
          }}
          className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title="Inspect details"
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
          title="Copy \\cite command"
          aria-label="Copy citation command"
        >
          {isCopied ? (
            <Check className="size-3.5 text-primary shrink-0" />
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
          title="Insert \\cite at cursor"
          aria-label="Insert citation at cursor"
        >
          <Plus className="size-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
});

export default CitationItem;
