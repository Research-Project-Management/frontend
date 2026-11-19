/**
 * CitationPickerListPane.tsx
 *
 * Column 2 of CitationPickerModal: search input, DOI/arXiv quick-resolve banner,
 * and virtualized / flat card list.
 */

'use client';

import React from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { Search, X, Loader2, SearchX, Binary } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { CitationPickerCard } from './CitationPickerCard';

export interface CitationPickerListPaneProps {
  activeView: 'tree' | 'list' | 'detail';
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
  selectedEntry: BibEntry | null;
  citedKeysSet: ReadonlySet<string>;
  isLargeCardsList: boolean;
  cardsVirtualizer: Virtualizer<HTMLDivElement, Element>;
  onSelectCard: (entry: BibEntry) => void;
  onSelectItem: (entry: BibEntry) => void;
}

export function CitationPickerListPane({
  activeView,
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
  selectedEntry,
  citedKeysSet,
  isLargeCardsList,
  cardsVirtualizer,
  onSelectCard,
  onSelectItem,
}: CitationPickerListPaneProps) {
  return (
    <div
      className={cn(
        'w-full md:w-[320px] lg:w-[350px] border-r border-border/70 flex flex-col min-h-0 bg-background shrink-0 h-full overflow-hidden',
        activeView !== 'list' && 'hidden md:flex',
      )}
    >
      <div className="p-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search title, author, key, DOI..."
            className="pl-8 pr-7 h-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border rounded-md"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-foreground hover:bg-muted transition-colors cursor-pointer after:absolute after:-inset-1.5 after:content-['']"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {isIdentifier && effectiveProjectId && (
        <div className="mx-3 mb-2 p-2 rounded-md border border-border bg-muted/40 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <Binary className="size-3 text-foreground" />
              <p className="text-11 font-medium text-foreground truncate">
                Academic identifier
              </p>
            </div>
            <p className="text-10 font-mono text-foreground opacity-80 truncate">
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
                Resolving...
              </>
            ) : (
              'Resolve'
            )}
          </Button>
        </div>
      )}

      <div
        ref={listRef}
        role="listbox"
        aria-label="Citations list"
        aria-activedescendant={selectedKey ? `citation-opt-${selectedKey}` : undefined}
        className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1 sidebar-scrollbar"
      >
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {filteredItems.length} citations found
        </div>

        {isSearchingServer && (
          <div className="flex items-center justify-center py-8 text-foreground gap-2">
            <Loader2 className="size-3.5 animate-spin text-foreground motion-reduce:animate-none" />
            <span className="text-xs">Searching references...</span>
          </div>
        )}

        {!isSearchingServer && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-foreground px-4 space-y-2">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-foreground">
              <SearchX className="size-4 text-foreground" />
            </div>
            <p className="text-xs font-medium text-foreground">No citations found</p>
            <p className="text-11 text-muted-foreground max-w-xs leading-normal">
              {search
                ? `No papers match "${search}". Try searching by author, title or DOI.`
                : 'No citation entries found in this collection.'}
            </p>
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
                isCited={Boolean(entry.key && citedKeysSet.has(entry.key.toLowerCase()))}
                onSelect={onSelectCard}
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
                    isCited={Boolean(entry.key && citedKeysSet.has(entry.key.toLowerCase()))}
                    onSelect={onSelectCard}
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
