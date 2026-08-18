'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Loader2, Search, X } from 'lucide-react';
import { useSticky } from '@/features/workspaces/projects/stickies/hooks/use-sticky';
import Card from '@/features/workspaces/projects/stickies/components/card/Card';
import type { Sticky } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { STICKY_COLOR_CYCLE } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { stripHtml, isStickyEmpty } from '@/features/workspaces/projects/stickies/utils/sticky.utils';

export default function Stickies() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { query, mutations } = useSticky(workspaceId, "", undefined);
  const notes = (query.data || []) as Sticky[];
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

  const preview = useMemo(() => filteredNotes.slice(0, 7), [filteredNotes]);
  const hasMore = filteredNotes.length > 3;

  const handleAdd = () => {
    if (!workspaceId || mutations.create.isPending) return;
    if (notes.some(isStickyEmpty)) return;

    const lastColor = notes[0]?.color;
    const idx = STICKY_COLOR_CYCLE.indexOf(lastColor || 'yellow-1');
    const color = STICKY_COLOR_CYCLE[idx === -1 ? 0 : (idx + 1) % STICKY_COLOR_CYCLE.length];

    mutations.create.mutate({
      workspaceId,
      content: '<p></p>',
      color,
      title: '',
      position: { x: 0, y: 0 },
    });
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground select-none">
          Stickies
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center h-8">
            {isSearchExpanded ? (
              <div className="flex items-center animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground" />
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
                    className="h-8 w-[160px] sm:w-[200px] rounded-md border border-border/50 bg-muted/30 pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground focus:border-border focus:ring-1 focus:ring-border/50 transition-all"
                  />
                  {searchQuery ? (
                    <button
                      aria-label="Clear search"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5 text-foreground" />
                    </button>
                  ) : (
                    <button
                      aria-label="Close search"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsSearchExpanded(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5 text-foreground" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                aria-label="Search stickies"
                onClick={() => setIsSearchExpanded(true)}
                className='flex items-center justify-center text-foreground hover:bg-muted/80 rounded-md p-1 transition-colors cursor-pointer'
                title="Search stickies"
              >
                <Search className='size-3.5 text-foreground' />
              </button>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={isCreating}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isCreating ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <Plus className="size-3.5 text-primary" />
            )}
            Add sticky
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className='flex items-center gap-2 py-4 px-1 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin text-primary' />
          Loading...
        </div>
      ) : (
        <div className="relative">
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${hasMore ? 'max-h-[800px] overflow-hidden' : ''}`}>
            {preview.map((note) => (
              <div key={note.id} className="min-h-[220px] flex flex-col">
                <Card
                  sticky={note}
                  onUpdate={(id, updates) => mutations.update.mutate({ stickyId: id, updates })}
                  onDelete={(id) => mutations.remove.mutate(id)}
                />
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background via-background/90 to-transparent flex items-end justify-center pb-2">
              <Link
                href={`/${workspaceId}/stickies`}
                className="text-sm font-medium text-primary hover:underline transition-colors"
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
