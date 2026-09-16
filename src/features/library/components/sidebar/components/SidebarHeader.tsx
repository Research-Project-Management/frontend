'use client';

import { useRef, useState } from 'react';
import { Search, Plus, FolderPlus, PanelLeft } from 'lucide-react';
import { Input } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";

interface SidebarHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  canManageCollections: boolean;
  onOpenCreateRoot: () => void;
  onToggleCollapse: () => void;
}

export function SidebarHeader({
  searchQuery,
  onSearchChange,
  canManageCollections,
  onOpenCreateRoot,
  onToggleCollapse,
}: SidebarHeaderProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const expandSearch = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  };

  const handleClearSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSearchChange('');
    setIsSearchExpanded(false);
  };

  return (
    <div className="mb-3 px-2 flex items-center justify-between font-semibold text-sm tracking-tight text-foreground select-none">
      {isSearchExpanded || searchQuery ? (
        <div className="relative flex items-center transition-all duration-300 ease-in-out w-full h-8 rounded-md border border-border bg-background/80 overflow-hidden group font-normal text-xs">
          <Search className="absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 left-2 translate-x-0 text-foreground pointer-events-none shrink-0" />
          <Input
            ref={searchInputRef}
            autoFocus
            placeholder="Search collections..."
            aria-label="Search collections"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onSearchChange('');
                setIsSearchExpanded(false);
              }
            }}
            onBlur={() => {
              if (!searchQuery) {
                setIsSearchExpanded(false);
              }
            }}
            className="h-full text-xs font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/60 placeholder:font-normal transition-opacity duration-200 pl-7 pr-7 text-foreground"
          />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={handleClearSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:bg-muted transition-colors cursor-pointer p-0.5 rounded-sm"
            aria-label="Clear search"
          >
            <Plus className="size-3.5 rotate-45 text-foreground shrink-0" />
          </button>
        </div>
      ) : (
        <>
          <span className="truncate min-w-0 font-semibold text-sm tracking-tight text-foreground">Library</span>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Search collections toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={expandSearch}
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Search collections"
                >
                  <Search className="size-4 shrink-0 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Search collections</TooltipContent>
            </Tooltip>

            {/* New collection button */}
            {canManageCollections && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenCreateRoot}
                    className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    aria-label="New collection"
                  >
                    <FolderPlus className="size-4 shrink-0 text-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">New collection</TooltipContent>
              </Tooltip>
            )}

            {/* Toggle / Collapse Sidebar Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  aria-label="Toggle sidebar"
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <PanelLeft className="size-4 shrink-0 text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Collapse sidebar</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}
