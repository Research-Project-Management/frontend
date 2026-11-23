'use client';

import React, { memo } from 'react';
import { Check, Copy, Info } from 'lucide-react';
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
  isCopied,
  onSelect,
  onCopy,
  onInspect,
}: CitationItemProps) {
  const normalizedTitle = item.title?.trim() || '';
  const hasDistinctTitle = Boolean(
    normalizedTitle && normalizedTitle.toLowerCase() !== item.key.trim().toLowerCase(),
  );
  const cleanAuthor =
    item.authorsSummary && item.authorsSummary.trim().toLowerCase() !== 'unknown author'
      ? item.authorsSummary.trim()
      : '';
  const trailingMeta = [cleanAuthor, item.journal].filter(Boolean);
  const metaParts = [
    hasDistinctTitle ? item.key : item.source === 'bib' ? '.bib' : '',
    ...trailingMeta,
  ].filter(Boolean);
  const hasActions = Boolean(onCopy || onInspect);

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
      className="group relative flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border text-left select-none"
    >
      <div className="min-w-0 flex-1">
        {hasDistinctTitle ? (
          <p className="text-12 font-medium text-foreground truncate leading-snug">
            {normalizedTitle}
          </p>
        ) : (
          <p className="font-mono text-12 font-medium text-foreground truncate leading-snug">
            {item.key}
          </p>
        )}

        {metaParts.length > 0 && (
          <p className="text-11 text-muted-foreground truncate leading-snug mt-0.5">
            {hasDistinctTitle ? (
              <>
                <span className="font-mono">{item.key}</span>
                {trailingMeta.length > 0 ? ` · ${trailingMeta.join(' · ')}` : ''}
              </>
            ) : (
              metaParts.join(' · ')
            )}
          </p>
        )}
      </div>

      {(item.year || hasActions) && (
        <div className="shrink-0 flex items-center gap-0.5">
          {item.year && (
            <span
              className={`text-11 text-muted-foreground/80 tabular-nums${hasActions ? ' group-hover:hidden' : ''}`}
            >
              {item.year}
            </span>
          )}
          {hasActions && (
            <div className="hidden group-hover:flex items-center gap-0.5">
              {onCopy && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(item.key);
                  }}
                  title="Copy citation key"
                  aria-label={`Copy ${item.key}`}
                  className="size-6 rounded text-muted-foreground hover:text-foreground hover:bg-background flex items-center justify-center cursor-pointer transition-colors"
                >
                  {isCopied ? <Check className="size-3 text-foreground" /> : <Copy className="size-3" />}
                </button>
              )}
              {onInspect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspect(item.key);
                  }}
                  title="View citation details"
                  aria-label={`Inspect ${item.key}`}
                  className="size-6 rounded text-muted-foreground hover:text-foreground hover:bg-background flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Info className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default CitationItem;
