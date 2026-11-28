/**
 * CitationPickerListPane.tsx
 *
 * Column 2 of CitationPickerModal: search input, DOI/arXiv quick-resolve banner,
 * and virtualized / flat card list.
 */

'use client';

import React from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { Search, X, Loader2, ListFilter, Check } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { CitationPickerCard } from './CitationCard';

export interface CitationPickerListPaneProps {
  search: string;
  onSearchChange: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  isIdentifier: boolean;
  effectiveProjectId: string;
  isResolving: boolean;
  onResolveIdentifier: () => void;
  isSearchingServer: boolean;
  filteredItems: BibEntry[];
  selectedKey: string | null;
  selectedKeys?: ReadonlySet<string>;
  onToggleSelectKey?: (key: string) => void;
  sortBy?: 'default' | 'year-desc' | 'year-asc' | 'title-asc' | 'author-asc';
  onSortChange?: (sort: 'default' | 'year-desc' | 'year-asc' | 'title-asc' | 'author-asc') => void;
  selectedEntry: BibEntry | null;
  citedKeysSet: ReadonlySet<string>;
  isLargeCardsList: boolean;
  cardsVirtualizer: Virtualizer<HTMLDivElement, Element>;
  onSelectCard: (entry: BibEntry, e?: React.MouseEvent) => void;
  onSelectItem: (entry: BibEntry) => void;
}

export function CitationPickerListPane({
  search,
  onSearchChange,
  onKeyDown,
  searchInputRef,
  listRef,
  isIdentifier,
  effectiveProjectId,
  isResolving,
  onResolveIdentifier,
  isSearchingServer,
  filteredItems,
  selectedKey,
  selectedKeys,
  onToggleSelectKey,
  sortBy = 'default',
  onSortChange,
  selectedEntry,
  citedKeysSet,
  isLargeCardsList,
  cardsVirtualizer,
  onSelectCard,
  onSelectItem,
}: CitationPickerListPaneProps) {
  return (
    <div className="w-full flex-1 flex flex-col min-h-0 bg-background h-full overflow-hidden">
      {/* Search Header with Unified Filter/Sort Icon Button */}
      <div className="px-4 py-2 shrink-0 flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search references..."
            className="pl-8 pr-7 h-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-border focus:outline-none shadow-none rounded-md"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Sort Menu Trigger */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="size-8 shrink-0 flex items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
              title="Sort references"
              aria-label="Sort references"
            >
              <ListFilter className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs">
            <DropdownMenuLabel className="text-11 font-medium text-muted-foreground px-2 py-1">
              Sort by
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => onSortChange?.('default')}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <span>Default</span>
              {sortBy === 'default' && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange?.('year-desc')}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <span>Year (Newest)</span>
              {sortBy === 'year-desc' && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange?.('year-asc')}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <span>Year (Oldest)</span>
              {sortBy === 'year-asc' && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange?.('title-asc')}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <span>Title (A-Z)</span>
              {sortBy === 'title-asc' && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onSortChange?.('author-asc')}
              className="flex items-center justify-between text-xs cursor-pointer"
            >
              <span>Author (A-Z)</span>
              {sortBy === 'author-asc' && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isIdentifier && effectiveProjectId && (
        <div className="mx-4 mb-2 p-2 rounded-md border border-border bg-muted/40 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <p className="text-11 font-medium text-foreground truncate">
              {search.trim().startsWith('10.') ? 'DOI detected' : 'Identifier detected'}
            </p>
            <p className="text-10 font-mono text-muted-foreground truncate">
              {search.trim()}
            </p>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={onResolveIdentifier}
            disabled={isResolving}
            className="h-6 px-2 text-11 font-medium shrink-0 cursor-pointer text-foreground"
          >
            {isResolving ? (
              <>
                <Loader2 className="size-3 animate-spin mr-1 text-foreground motion-reduce:animate-none" />
                Fetching...
              </>
            ) : (
              'Fetch BibTeX'
            )}
          </Button>
        </div>
      )}

      <div
        ref={listRef}
        role="listbox"
        aria-label="Citations list"
        aria-activedescendant={selectedKey ? `citation-opt-${selectedKey}` : undefined}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-2 flex flex-col sidebar-scrollbar"
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {filteredItems.length} citations found
        </div>

        {isSearchingServer && (
          <div className="space-y-2 py-1">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="p-3 rounded-md border border-border/60 bg-card space-y-2"
              >
                <Skeleton className="h-3.5 w-3/4 rounded-sm" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-28 rounded-sm" />
                  <Skeleton className="h-3 w-12 rounded-sm" />
                </div>
                <Skeleton className="h-3 w-1/2 rounded-sm opacity-70" />
              </div>
            ))}
          </div>
        )}

        {!isSearchingServer && filteredItems.length === 0 && (
          <div className="h-full flex-1 flex items-center justify-center px-4">
            <PlaneEmptyState
              variant={search ? 'search' : 'citations'}
              isCompact
              title="No citations found"
              description={
                search
                  ? `No papers match "${search}". Try searching by author, title or DOI.`
                  : 'No citation entries found in this collection.'
              }
            />
          </div>
        )}

        {!isSearchingServer && !isLargeCardsList && (
          <div className="space-y-1">
            {filteredItems.map((entry, idx) => (
              <CitationPickerCard
                key={entry.key}
                entry={entry}
                idx={idx}
                isSelected={selectedEntry?.key.toLowerCase() === entry.key.toLowerCase()}
                isChecked={Boolean(selectedKeys?.has(entry.key.toLowerCase()))}
                isCited={Boolean(entry.key && citedKeysSet.has(entry.key.toLowerCase()))}
                onSelect={onSelectCard}
                onToggleCheck={onToggleSelectKey}
                onDoubleClick={onSelectItem}
              />
            ))}
          </div>
        )}

        {!isSearchingServer && isLargeCardsList && (
          <div
            style={{
              height: `${cardsVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {cardsVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filteredItems[virtualRow.index];
              return (
                <div
                  key={entry.key}
                  data-index={virtualRow.index}
                  ref={cardsVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <CitationPickerCard
                    entry={entry}
                    idx={virtualRow.index}
                    isSelected={selectedEntry?.key.toLowerCase() === entry.key.toLowerCase()}
                    isChecked={Boolean(selectedKeys?.has(entry.key.toLowerCase()))}
                    isCited={Boolean(entry.key && citedKeysSet.has(entry.key.toLowerCase()))}
                    onSelect={onSelectCard}
                    onToggleCheck={onToggleSelectKey}
                    onDoubleClick={onSelectItem}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
