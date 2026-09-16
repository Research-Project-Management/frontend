'use client';

import React, { useState, useMemo } from 'react';
import {
  ListTree,
  Search,
  X,
  ChevronRight,
  Bookmark,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import type { PdfOutlineItem } from '@/features/editor/utils/pdf-outline.util';

export interface ViewerOutlinePopoverProps {
  outline: PdfOutlineItem[];
  currentPageNumber: number;
  onSelectPage: (pageNumber: number) => void;
  disabled?: boolean;
}

export default function ViewerOutlinePopover({
  outline,
  currentPageNumber,
  onSelectPage,
  disabled = false,
}: ViewerOutlinePopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return outline;
    const q = searchQuery.toLowerCase().trim();
    return outline.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        String(item.pageNumber) === q ||
        `p. ${item.pageNumber}`.includes(q) ||
        `p.${item.pageNumber}`.includes(q),
    );
  }, [outline, searchQuery]);

  const handleItemClick = (pageNumber: number) => {
    onSelectPage(pageNumber);
    setOpen(false);
  };

  const hasOutline = outline && outline.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Document Outline and Bookmarks"
              className={cn(
                'h-7 px-2 flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer border border-border',
                open
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-foreground hover:bg-muted bg-transparent',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <ListTree className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline text-xs">Outline</span>
              {hasOutline && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full font-mono text-11 font-medium',
                    open
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {outline.length}
                </span>
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Document Outline & Bookmarks</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 p-0 shadow-lg border border-border bg-popover select-none z-[9999]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <ListTree className="size-4 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground">Document Outline</span>
          </div>
          <span className="text-11 font-mono text-muted-foreground">
            {outline.length} {outline.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-border bg-background/50">
          <div className="relative flex items-center">
            <Search className="size-3.5 absolute left-2.5 text-muted-foreground/60 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sections or page..."
              className="h-7.5 pl-8 pr-7 text-xs bg-muted/50 border-border/80 focus-visible:ring-1"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3 shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Content List */}
        <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 px-4 text-center text-muted-foreground space-y-1.5">
              <Bookmark className="size-5 text-muted-foreground/60 shrink-0" />
              <p className="text-xs font-medium text-foreground">
                {searchQuery ? 'No matching section found' : 'No bookmarks available'}
              </p>
              <p className="text-11 text-muted-foreground leading-relaxed">
                {searchQuery
                  ? 'Try searching with another keyword.'
                  : 'Add \\section{...} commands to see outline jumps.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isCurrentPage = item.pageNumber === currentPageNumber;
              const indentPadding = Math.min(item.level * 12, 36);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.pageNumber)}
                  style={{ paddingLeft: `${8 + indentPadding}px` }}
                  className={cn(
                    'group flex w-full items-center gap-1.5 py-1.5 pr-2 rounded-md text-left transition-colors cursor-pointer text-xs',
                    isCurrentPage
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted text-foreground/90 hover:text-foreground',
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'size-3 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground/80',
                      item.level === 0 && 'rotate-90 text-primary/70',
                    )}
                  />

                  <span className="min-w-0 flex-1 truncate">{item.title}</span>

                  <span
                    className={cn(
                      'shrink-0 px-1.5 py-0.5 rounded font-mono text-11 transition-colors',
                      isCurrentPage
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-muted text-foreground font-medium group-hover:bg-background',
                    )}
                  >
                    p. {item.pageNumber}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-border bg-muted/20 text-11 text-muted-foreground flex items-center justify-between">
          <span>Click any item to jump</span>
          <span className="font-mono">SyncTeX active</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
