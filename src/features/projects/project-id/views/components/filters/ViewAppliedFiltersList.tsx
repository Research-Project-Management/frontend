'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface ViewAppliedFiltersListProps {
  search: string;
  onClearSearch: () => void;
  accessFilter: 'all' | 'public' | 'private';
  onClearAccessFilter: () => void;
  onlyFavorites: boolean;
  onClearFavorites: () => void;
  creatorFilter: string | null;
  creatorName?: string;
  onClearCreatorFilter: () => void;
  onClearAll: () => void;
}

export function ViewAppliedFiltersList({
  search,
  onClearSearch,
  accessFilter,
  onClearAccessFilter,
  onlyFavorites,
  onClearFavorites,
  creatorFilter,
  creatorName,
  onClearCreatorFilter,
  onClearAll,
}: ViewAppliedFiltersListProps) {
  const hasFilters = Boolean(
    search.trim() || accessFilter !== 'all' || onlyFavorites || creatorFilter
  );

  if (!hasFilters) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/30 border-b border-border text-xs flex-wrap">
      <span className="text-muted-foreground font-medium mr-1">Filters:</span>

      {search.trim() && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground">
          <span>Search: &ldquo;{search}&rdquo;</span>
          <button
            type="button"
            onClick={onClearSearch}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {onlyFavorites && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-medium">
          <span>★ Favorites</span>
          <button
            type="button"
            onClick={onClearFavorites}
            className="hover:opacity-80 cursor-pointer"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {accessFilter !== 'all' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground capitalize">
          <span>Access: {accessFilter}</span>
          <button
            type="button"
            onClick={onClearAccessFilter}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {creatorFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground">
          <span>Created by: {creatorName || 'Member'}</span>
          <button
            type="button"
            onClick={onClearCreatorFilter}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer ml-auto"
      >
        Clear all
      </Button>
    </div>
  );
}
