'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

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
    <div className="flex items-center gap-1.5 px-4 py-1.5 min-h-8 bg-muted/30 border-b border-border text-12 flex-wrap">
      <span className="text-muted-foreground font-medium mr-1 text-12">Filters:</span>

      {search.trim() && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground text-12">
          <span>Search: &ldquo;{search}&rdquo;</span>
          <button
            type="button"
            onClick={onClearSearch}
            className="text-muted-foreground hover:text-foreground cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Clear search filter"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {onlyFavorites && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/10 border border-warning/30 text-warning font-medium text-12">
          <span>★ Favorites</span>
          <button
            type="button"
            onClick={onClearFavorites}
            className="hover:opacity-80 cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Clear favorites filter"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {accessFilter !== 'all' && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground capitalize text-12">
          <span>Access: {accessFilter}</span>
          <button
            type="button"
            onClick={onClearAccessFilter}
            className="text-muted-foreground hover:text-foreground cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Clear access filter"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      {creatorFilter && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border text-foreground text-12">
          <span>Created by: {creatorName || 'Member'}</span>
          <button
            type="button"
            onClick={onClearCreatorFilter}
            className="text-muted-foreground hover:text-foreground cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Clear creator filter"
          >
            <X className="size-3" />
          </button>
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-6 px-2 text-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer ml-auto relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
      >
        Clear all
      </Button>
    </div>
  );
}
