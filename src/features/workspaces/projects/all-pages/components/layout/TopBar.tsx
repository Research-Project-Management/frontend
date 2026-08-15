import React from 'react';
import { PenLine, Search, LayoutGrid, List, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui';

interface TopBarProps {
  initialProjectId?: string;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onCreateClick: () => void;
}

export function TopBar({ initialProjectId, viewMode, setViewMode, onCreateClick }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2.5">
        <PenLine className="size-4 text-primary" />
        <h1 className="text-sm font-semibold text-foreground transition-all duration-200">
          {initialProjectId ? 'Pages' : 'All pages'}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Search pages" className="h-8 w-8 text-muted-foreground">
          <Search className="size-4" />
        </Button>
        
        <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/20">
          <Button
            variant={viewMode === 'grid' ? "secondary" : "ghost"}
            size="icon"
            aria-label="Grid view"
            className={`h-7 w-7 rounded-sm ${viewMode === 'grid' ? 'bg-background text-primary' : 'text-muted-foreground'}`}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            variant={viewMode === 'list' ? "secondary" : "ghost"}
            size="icon"
            aria-label="List view"
            className={`h-7 w-7 rounded-sm ${viewMode === 'list' ? 'bg-background text-primary' : 'text-muted-foreground'}`}
            onClick={() => setViewMode('list')}
          >
            <List className="size-3.5" />
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
