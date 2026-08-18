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
    <div className="border-t border-border/50 p-2.5 select-none bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <button
          onClick={() => setIsExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Tag className="size-3.5 text-foreground" />
          <span>Tags</span>
          <ChevronDown
            className={cn(
              'size-3 text-foreground transition-transform duration-200 ml-0.5',
              !isExpanded && '-rotate-90'
            )}
          />
        </button>

        {selectedTag && (
          <button
            onClick={() => onSelectTag(null)}
            className="flex items-center gap-1 text-xs text-foreground hover:underline font-medium cursor-pointer"
            title="Clear tag filter"
          >
            <span>Clear</span>
            <X className="size-3 text-foreground" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-1.5 px-1">
          {tags.length > 5 && (
            <div className="relative">
              <input
                type="text"
                placeholder="Filter tags..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full h-6 px-2 text-xs rounded bg-muted/40 border border-border/40 placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-1.5 top-1 text-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3 text-foreground" />
                </button>
              )}
            </div>
          )}

          {/* Tags list */}
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-0.5 custom-scrollbar">
            {filteredTags.map((tag) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => onSelectTag(isSelected ? null : tag)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer max-w-full',
                    isSelected
                      ? 'bg-accent text-foreground font-semibold shadow-xs'
                      : 'bg-muted/40 text-foreground hover:bg-muted border border-border/30'
                  )}
                  title={tag}
                >
                  <Hash className="size-2.5 text-foreground/60 shrink-0" />
                  <span className="truncate max-w-[120px]">{tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
