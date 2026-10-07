'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Loader2, Search, X } from 'lucide-react';
import { useSticky } from '@/features/projects/stickies/hooks/use-sticky';
import Card from '@/features/projects/stickies/components/card/Card';
import type { Sticky } from '@/features/projects/stickies/types/sticky.types';
import { stripHtml } from '@/features/projects/stickies/utils/sticky.utils';

export default function Stickies() {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { query, mutations } = useSticky();
  const notes = useMemo(() => (query.data || []) as Sticky[], [query.data]);
  const isLoading = query.isLoading;
  const isCreating = mutations.create.isPending;

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const lower = searchQuery.toLowerCase();
    return notes.filter((n) =>
      n.title?.toLowerCase().includes(lower) ||
      stripHtml(n.content || '').toLowerCase().includes(lower)
    );
  }, [notes, searchQuery]);

  const preview = useMemo(() => Array.isArray(filteredNotes) ? filteredNotes.slice(0, 8) : [], [filteredNotes]);
  const hasMore = filteredNotes.length > 4;

  const handleAdd = () => {
    if (mutations.create.isPending) return;
    mutations.create.mutate({});
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-16 font-semibold tracking-tight text-foreground select-none">
          Stickies
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center h-8">
            {isSearchExpanded ? (
              <div className="flex items-center animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground shrink-0 pointer-events-none" />
                  <input
                    aria-label="Search stickies"
                    type="text"
                    autoFocus
                    placeholder="Search stickies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => {
                      if (!searchQuery) setIsSearchExpanded(false);
                    }}
                    className="h-8 w-[160px] sm:w-[200px] rounded-md border border-border bg-background pl-8 pr-8 text-13 text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-colors"
                  />
                  {searchQuery ? (
                    <button
                      aria-label="Clear search"
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none touch-manipulation sm:after:hidden after:absolute after:-inset-2 after:content-['']"
                    >
                      <X className="size-3.5 shrink-0" />
                    </button>
                  ) : (
                    <button
                      aria-label="Close search"
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsSearchExpanded(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none touch-manipulation sm:after:hidden after:absolute after:-inset-2 after:content-['']"
                    >
                      <X className="size-3.5 shrink-0" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                aria-label="Search stickies"
                type="button"
                onClick={() => setIsSearchExpanded(true)}
                className='flex items-center justify-center text-foreground hover:bg-muted rounded-md p-1 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-[""]'
                title="Search stickies"
              >
                <Search className='size-3.5 text-foreground shrink-0' />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isCreating}
            className="relative flex items-center gap-1.5 text-12 font-medium text-primary hover:underline transition-colors disabled:opacity-50 cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none rounded-sm touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
          >
            {isCreating ? (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-primary shrink-0" />
            ) : (
              <Plus className="size-3.5 text-primary shrink-0" />
            )}
            Add sticky
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-[250px] rounded-md border border-border bg-card p-4 flex flex-col justify-between animate-pulse motion-reduce:animate-none"
            >
              <div className="space-y-2.5">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted/60 rounded" />
                <div className="h-3 w-5/6 bg-muted/60 rounded" />
              </div>
              <div className="h-3 w-1/3 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="relative">
          <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3.5 ${hasMore ? 'max-h-[560px] overflow-hidden' : ''}`}>
            {preview.map((note) => (
              <div key={note.id} className="h-[250px] flex flex-col">
                <Card
                  sticky={note}
                  className="h-full"
                  onUpdate={(id, updates) => mutations.update.mutate({ stickyId: id, updates })}
                  onDelete={(id) => mutations.remove.mutate(id)}
                />
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background via-background/90 to-transparent flex items-end justify-center pb-2">
              <Link
                href="/stickies"
                className="relative text-12 font-medium text-primary hover:underline transition-colors shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
              >
                Show all
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
