'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Plus, Loader2, Palette, Bold, Italic, ListTodo, Trash2, Search, X } from 'lucide-react';
import type { Sticky } from '../types/home.types';
import { STICKY_COLOR_MAP } from '../types/home.types';
import { useStickies } from '../hooks/use-stickies';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function MiniCard({
  note,
  workspaceUrl,
}: {
  note: Sticky;
  workspaceUrl: string;
}) {
  const colorConfig = STICKY_COLOR_MAP[note.color] || STICKY_COLOR_MAP.yellow;
  const plainContent = useMemo(
    () => stripHtml(note.content || ''),
    [note.content]
  );

  return (
    <Link
      href={`/${workspaceUrl}/stickies`}
      className='group relative flex flex-col rounded-[6px] overflow-hidden transition-transform duration-200 min-h-[220px]'
      style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
    >
      <div className='flex flex-col gap-2 p-4 grow'>
        {note.title ? (
          <p className='text-[15px] font-medium leading-snug break-words'>
            {note.title}
          </p>
        ) : null}
        <p className='text-[13px] leading-relaxed line-clamp-4 opacity-80 break-words'>
          {plainContent || (
            <span className='italic opacity-50'>Empty sticky</span>
          )}
        </p>
      </div>

      <div className="h-11 flex items-center justify-between px-4 shrink-0 mt-auto">
        <div className="flex items-center gap-[18px] opacity-40">
          <Palette className="size-[15px]" />
          <Bold className="size-[15px]" />
          <Italic className="size-[15px]" />
          <ListTodo className="size-[15px]" />
        </div>
        <Trash2 className="size-[15px] opacity-40" />
      </div>
    </Link>
  );
}

export default function Stickies() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { notes, isLoading, isCreating, handleAdd } = useStickies(workspaceId);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-[15px] font-medium text-foreground tracking-tight select-none">
          Your stickies
        </h2>
        <div className="flex items-center gap-4">
          <div className="relative flex items-center h-8">
            {isSearchExpanded ? (
              <div className="flex items-center animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsSearchExpanded(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className='flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors'
                title="Search stickies"
              >
                <Search className='size-[15px]' />
              </button>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={isCreating}
            className="flex items-center gap-1.5 text-[14px] font-medium text-primary hover:text-primary/90 transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Add sticky
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className='flex items-center gap-2 py-4 px-1 text-sm text-muted-foreground'>
          <Loader2 className='size-4 animate-spin' />
          Loading...
        </div>
      ) : (
        <div className="relative">
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${hasMore ? 'max-h-[400px] overflow-hidden' : ''}`}>
            {preview.map((note: any) => (
              <MiniCard
                workspaceUrl={workspaceId || ''}
                key={note._id}
                note={note}
              />
            ))}
          </div>
          {hasMore && (
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background via-background/90 to-transparent flex items-end justify-center pb-2">
              <Link
                href={`/${workspaceId}/stickies`}
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
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
