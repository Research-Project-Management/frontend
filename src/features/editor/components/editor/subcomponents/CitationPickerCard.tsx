'use client';

import React, { memo } from 'react';
import { cn } from '@/shared/lib/utils';
import type { BibEntry } from '@/features/editor/utils/bib-parser.util';

interface CitationPickerCardProps {
  entry: BibEntry;
  idx: number;
  isSelected: boolean;
  isCited: boolean;
  onSelect: (entry: BibEntry) => void;
  onDoubleClick: (entry: BibEntry) => void;
}

export const CitationPickerCard = memo(function CitationPickerCard({
  entry,
  idx,
  isSelected,
  isCited,
  onSelect,
  onDoubleClick,
}: CitationPickerCardProps) {
  const authorSummary =
    entry.authors && entry.authors.length > 0
      ? entry.authors.length <= 2
        ? entry.authors.join(' & ')
        : `${entry.authors[0]} et al.`
      : 'Unknown author';

  return (
    <div
      id={`citation-opt-${entry.key}`}
      role="option"
      tabIndex={0}
      data-index={idx}
      aria-selected={isSelected}
      aria-label={`${entry.title || entry.key} by ${authorSummary}`}
      onClick={() => onSelect(entry)}
      onDoubleClick={() => onDoubleClick(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onDoubleClick(entry);
        }
      }}
      className={cn(
        'group flex flex-col gap-1 p-2.5 rounded-md cursor-pointer transition-colors border text-left select-none outline-none focus-visible:ring-1 focus-visible:ring-primary',
        isSelected
          ? 'bg-muted border-border text-foreground font-medium'
          : 'border-transparent hover:bg-muted text-foreground',
      )}
    >
      {/* Title */}
      <p className="text-xs font-medium line-clamp-2 leading-snug text-foreground">
        {entry.title || entry.key}
      </p>

      {/* Author + Year */}
      <p className="text-11 text-muted-foreground truncate leading-normal">
        {authorSummary}
        {entry.year ? ` (${entry.year})` : ''}
      </p>

      {/* Badges / Key row */}
      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
        <span className="font-mono text-10 px-1.5 py-0.5 rounded bg-background border border-border text-foreground truncate max-w-[140px]">
          {entry.key}
        </span>

        {entry.source === 'library' && (
          <span className="text-10 font-mono px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
            Library
          </span>
        )}
        {entry.source === 'bib' && (
          <span className="text-10 font-mono px-1.5 py-0.5 rounded bg-muted text-foreground border border-border">
            .bib
          </span>
        )}

        {isCited && (
          <span className="text-10 font-mono font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 ml-auto">
            Cited
          </span>
        )}
      </div>
    </div>
  );
});

export default CitationPickerCard;
