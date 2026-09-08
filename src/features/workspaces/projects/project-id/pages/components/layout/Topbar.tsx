import React from 'react';
import { PenLine, Search, LayoutGrid, List, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface TopbarProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onCreateClick: () => void;
}

export function Topbar({ viewMode, setViewMode, onCreateClick }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2.5">
        <PenLine className="size-4 text-foreground shrink-0" />
        <h1 className="text-sm font-semibold text-foreground tracking-tight">Pages</h1>
      </div>
      <div className="flex items-center gap-2.5">
        <Button variant="ghost" size="icon" aria-label="Search pages" className="size-8 text-foreground hover:bg-muted cursor-pointer">
          <Search className="size-4 text-foreground shrink-0" />
        </Button>

        <div className="flex items-center rounded-md border border-border p-0.5 bg-muted">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Grid view"
            className={cn('h-7 w-7 rounded-sm', viewMode === 'grid' ? 'bg-background text-foreground' : 'text-foreground hover:bg-muted')}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="size-3.5 shrink-0" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="List view"
            className={cn('h-7 w-7 rounded-sm', viewMode === 'list' ? 'bg-background text-foreground' : 'text-foreground hover:bg-muted')}
            onClick={() => setViewMode('list')}
          >
            <List className="size-3.5 shrink-0" />
          </Button>
        </div>

        <Button
          size="sm"
          className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 ml-2"
          onClick={onCreateClick}
        >
          <Plus className="mr-2 size-4 shrink-0" />
          Add Document
        </Button>
      </div>
    </header>
  );
}

export const TopBar = Topbar;

