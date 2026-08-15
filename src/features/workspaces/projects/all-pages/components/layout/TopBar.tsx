import React from 'react';
import { PenLine, Search, LayoutGrid, List, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface TopBarProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onCreateClick: () => void;
}

export function TopBar({ viewMode, setViewMode, onCreateClick }: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2.5">
        <PenLine className="size-4 text-foreground" />
        <h1 className="text-sm font-semibold text-foreground">All pages</h1>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Search pages" className="h-8 w-8 text-foreground hover:bg-accent cursor-pointer">
          <Search className="size-4 text-foreground" />
        </Button>
        
        <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/20">
          <Button
            variant={viewMode === 'grid' ? "secondary" : "ghost"}
            size="icon"
            aria-label="Grid view"
            className={`h-7 w-7 rounded-sm ${viewMode === 'grid' ? 'bg-background text-foreground' : 'text-foreground/70'}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="size-3.5 text-foreground" />
          </Button>
          <Button
            variant={viewMode === 'list' ? "secondary" : "ghost"}
            size="icon"
            aria-label="List view"
            className={`h-7 w-7 rounded-sm ${viewMode === 'list' ? 'bg-background text-foreground' : 'text-foreground/70'}`}
            onClick={() => setViewMode('list')}
          >
            <List className="size-3.5 text-foreground" />
          </Button>
        </div>

        <Button 
          size="sm" 
          className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 ml-2"
          onClick={onCreateClick}
        >
          <Plus className="mr-2 size-4" />
          Add Document
        </Button>
      </div>
    </header>
  );
}
