'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Plus,
  Check,
  Filter,
  Users,
  Lock,
  Globe,
  Star,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Checkbox,
} from '@/shared/components/ui';
import {
  SortAscendingIcon,
  SortDescendingIcon,
  ViewsOutlineIcon,
} from '@/shared/components/icons';
import { cn } from '@/shared/lib/utils';
import type { TViewFiltersSortKey, TViewFiltersSortBy } from '../../types/view.types';

interface ViewListHeaderProps {
  search: string;
  onSearchChange: (val: string) => void;
  sortKey: TViewFiltersSortKey;
  sortBy: TViewFiltersSortBy;
  onSortChange: (key: TViewFiltersSortKey, order: TViewFiltersSortBy) => void;
  accessFilter: 'all' | 'public' | 'private';
  onAccessFilterChange: (val: 'all' | 'public' | 'private') => void;
  onlyFavorites: boolean;
  onFavoritesChange: (val: boolean) => void;
  creatorFilter: string | null;
  onCreatorFilterChange: (id: string | null) => void;
  members?: Array<{ id: string; name?: string; email?: string; avatar?: string }>;
  onOpenCreateModal: () => void;
  isFiltersApplied?: boolean;
}

const SORT_OPTIONS: Array<{ key: TViewFiltersSortKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'createdAt', label: 'Created date' },
  { key: 'updatedAt', label: 'Updated date' },
];

export function ViewListHeader({
  search,
  onSearchChange,
  sortKey,
  sortBy,
  onSortChange,
  accessFilter,
  onAccessFilterChange,
  onlyFavorites,
  onFavoritesChange,
  creatorFilter,
  onCreatorFilterChange,
  members = [],
  onOpenCreateModal,
  isFiltersApplied,
}: ViewListHeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(search.trim()));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (search.trim()) {
      setIsSearchOpen(true);
    }
  }, [search]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (search.trim()) {
        onSearchChange('');
      } else {
        setIsSearchOpen(false);
      }
    }
  };

  const activeSortLabel = SORT_OPTIONS.find((s) => s.key === sortKey)?.label || 'Name';

  return (
    <div className="flex items-center justify-between gap-2">
      {/* Right Controls Area: Search, Order By, Filter, and Add View */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Expandable Search Input (Plane pattern) */}
        <div className="flex items-center">
          {!isSearchOpen ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsSearchOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="size-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              title="Search views"
            >
              <Search className="size-4" />
            </Button>
          ) : (
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background transition-all duration-200 shadow-sm w-60'
              )}
            >
              <Search className="size-3.5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search views..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setIsSearchOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Order By Dropdown (Plane pattern) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs font-normal rounded-md border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
            >
              {sortBy === 'asc' ? <SortAscendingIcon /> : <SortDescendingIcon />}
              <span>{activeSortLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1">
            <DropdownMenuLabel className="text-11 font-medium text-muted-foreground px-2 py-1">
              Sort by
            </DropdownMenuLabel>
            {SORT_OPTIONS.map((opt) => {
              const isSelected = sortKey === opt.key;
              return (
                <DropdownMenuItem
                  key={opt.key}
                  onClick={() => onSortChange(opt.key, sortBy)}
                  className="flex items-center justify-between text-xs cursor-pointer px-2 py-1.5 rounded-sm"
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuLabel className="text-11 font-medium text-muted-foreground px-2 py-1">
              Order
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onSortChange(sortKey, 'asc')}
              className="flex items-center justify-between text-xs cursor-pointer px-2 py-1.5 rounded-sm"
            >
              <div className="flex items-center gap-2">
                <SortAscendingIcon className="size-3.5 text-muted-foreground" />
                <span>Ascending (A-Z, Oldest)</span>
              </div>
              {sortBy === 'asc' && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange(sortKey, 'desc')}
              className="flex items-center justify-between text-xs cursor-pointer px-2 py-1.5 rounded-sm"
            >
              <div className="flex items-center gap-2">
                <SortDescendingIcon className="size-3.5 text-muted-foreground" />
                <span>Descending (Z-A, Newest)</span>
              </div>
              {sortBy === 'desc' && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filters Popover (Plane pattern) */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 px-2.5 text-xs font-normal rounded-md border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0',
                isFiltersApplied && 'bg-muted border-primary/40 font-medium'
              )}
            >
              <Filter className={cn('size-3.5', isFiltersApplied ? 'text-primary' : 'text-muted-foreground')} />
              <span>Filters</span>
              {isFiltersApplied && (
                <span className="size-1.5 rounded-full bg-primary shrink-0" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2 space-y-3">
            <div>
              <div className="text-11 font-medium text-muted-foreground mb-1.5">
                Saved Views
              </div>
              <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted cursor-pointer text-xs">
                <Checkbox
                  checked={onlyFavorites}
                  onCheckedChange={(checked) => onFavoritesChange(Boolean(checked))}
                />
                <Star className={cn('size-3.5', onlyFavorites ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground')} />
                <span>Favorites only</span>
              </label>
            </div>

            <div>
              <div className="text-11 font-medium text-muted-foreground mb-1.5">
                Access Level
              </div>
              <div className="space-y-0.5">
                {(['all', 'public', 'private'] as const).map((acc) => (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => onAccessFilterChange(acc)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1 rounded text-xs text-left cursor-pointer transition-colors',
                      accessFilter === acc
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {acc === 'all' && <ViewsOutlineIcon className="size-3.5" />}
                      {acc === 'public' && <Globe className="size-3.5 text-blue-500" />}
                      {acc === 'private' && <Lock className="size-3.5 text-muted-foreground" />}
                      <span className="capitalize">{acc === 'all' ? 'All Access' : acc}</span>
                    </div>
                    {accessFilter === acc && <Check className="size-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {members.length > 0 && (
              <div>
                <div className="text-11 font-medium text-muted-foreground mb-1.5">
                  Created By
                </div>
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  <button
                    type="button"
                    onClick={() => onCreatorFilterChange(null)}
                    className={cn(
                      'w-full flex items-center justify-between px-2 py-1 rounded text-xs text-left cursor-pointer transition-colors',
                      !creatorFilter
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5" />
                      <span>Anyone</span>
                    </div>
                    {!creatorFilter && <Check className="size-3.5" />}
                  </button>
                  {members.map((m) => {
                    const isSelected = creatorFilter === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onCreatorFilterChange(isSelected ? null : m.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-2 py-1 rounded text-xs text-left cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span className="truncate">{m.name || m.email || m.id}</span>
                        {isSelected && <Check className="size-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Primary CTA: Add view (Plane standard) */}
        <Button
          variant="default"
          size="sm"
          onClick={onOpenCreateModal}
          className="h-8 px-3 text-xs font-semibold rounded-md flex items-center gap-1.5 cursor-pointer shadow-none shrink-0"
        >
          <Plus className="size-3.5" />
          <span>Add view</span>
        </Button>
      </div>
    </div>
  );
}
