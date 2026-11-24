'use client';

import React, { memo } from 'react';
import { cn } from '@/shared/lib/utils';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import {
  formatBibEntryAuthorSummary,
  cleanBibtexTitle,
} from '@/features/editor/subsystems/citation/model/citation-formatter';

interface CitationPickerCardProps {
  entry: BibEntry;
  idx: number;
  isSelected: boolean;
  isChecked?: boolean;
  isCited: boolean;
  onSelect: (entry: BibEntry, e?: React.MouseEvent) => void;
  onToggleCheck?: (key: string) => void;
  onDoubleClick: (entry: BibEntry) => void;
}

export const CitationPickerCard = memo(function CitationPickerCard({
  entry,
  idx,
  isSelected,
  isChecked = false,
  isCited,
  onSelect,
  onToggleCheck,
  onDoubleClick,
}: CitationPickerCardProps) {
  const authorSummary = formatBibEntryAuthorSummary(entry);
  const cleanTitle = cleanBibtexTitle(entry.title) || entry.key;

  return (
    <div
      id={`citation-opt-${entry.key}`}
      role="option"
      tabIndex={0}
      data-index={idx}
      aria-selected={isSelected}
      aria-checked={isChecked}
      aria-label={`${cleanTitle} by ${authorSummary}`}
      onClick={(e) => onSelect(entry, e)}
      onDoubleClick={() => onDoubleClick(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onDoubleClick(entry);
        } else if (e.key === ' ' && onToggleCheck) {
          e.preventDefault();
          onToggleCheck(entry.key);
        }
      }}
      className={cn(
        'group flex flex-col gap-1 p-2.5 rounded-md cursor-pointer transition-colors border text-left select-none outline-none focus-visible:ring-1 focus-visible:ring-border',
        isChecked
          ? 'bg-primary/5 border-primary/40 text-foreground'
          : isSelected
            ? 'bg-muted border-border text-foreground font-medium'
            : 'border-transparent hover:bg-muted text-foreground',
      )}
    >
      <div className="flex items-start gap-2.5">
        {onToggleCheck && (
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => {
              e.stopPropagation();
              onToggleCheck(entry.key);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${cleanTitle}`}
            className="size-3.5 mt-0.5 rounded border-border text-primary cursor-pointer shrink-0 accent-primary"
          />
        )}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <p className="text-13 font-medium line-clamp-2 leading-snug text-foreground">
            {cleanTitle}
          </p>

          {/* Author + Year + Journal (Overleaf Advanced Reference Search parity) */}
          <p className="text-12 text-muted-foreground truncate leading-normal pt-0.5">
            {authorSummary}
            {entry.year ? ` · ${entry.year}` : ''}
            {entry.journal || entry.booktitle ? ` · ${entry.journal || entry.booktitle}` : ''}
          </p>
        </div>
      </div>

      {isCited && (
        <div className="flex items-center pt-0.5 pl-5.5">
          <span className="text-10 font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            In Document
          </span>
        </div>
      )}
    </div>
  );
});

export default CitationPickerCard;
