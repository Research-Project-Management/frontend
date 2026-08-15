'use client';

import React, { useState } from 'react';
import { Tag, Hash, X, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface TagSelectorProps {
  tags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  tagCounts?: Record<string, number>;
}

export default function TagSelector({
  tags,
  selectedTag,
  onSelectTag,
  tagCounts = {},
}: TagSelectorProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const filteredTags = tags.filter((t) =>
    t.toLowerCase().includes(filterQuery.trim().toLowerCase())
  );

  if (tags.length === 0) return null;

  return (
    <div className="border-t border-border/50 p-2.5 select-none bg-background/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Tag className="size-3.5 text-primary" />
          <span>Tags</span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            ({tags.length})
          </span>
        </button>

        {selectedTag && (
          <button
            onClick={() => onSelectTag(null)}
            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
            title="Clear tag filter"
          >
            <span>Clear</span>
            <X className="size-3" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-1.5">
          {tags.length > 6 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Filter tags..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full h-6 px-2 text-[11px] rounded bg-muted/40 border border-border/30 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-1.5 top-1 text-muted-foreground/60 hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Tags list */}
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-0.5">
            {filteredTags.map((tag) => {
              const isSelected = selectedTag === tag;
              const count = tagCounts[tag];
              return (
                <button
                  key={tag}
                  onClick={() => onSelectTag(isSelected ? null : tag)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/30'
                  )}
                >
                  <Hash className="size-2.5 opacity-60" />
                  <span className="truncate max-w-[120px]">{tag}</span>
                  {count != null && count > 0 && (
                    <span
                      className={cn(
                        'text-[9px] font-mono tabular-nums opacity-70 ml-0.5',
                        isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
