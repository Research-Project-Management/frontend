'use client';

import { useRef, useState } from 'react';
import { Search, Plus, FolderPlus, SlidersHorizontal, PanelLeft } from 'lucide-react';
import { Input } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";

interface SidebarHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  canManageCollections: boolean;
  onOpenCreateRoot: () => void;
  onOpenCreateSavedSearch?: () => void;
  onToggleCollapse: () => void;
}

export function SidebarHeader({
  searchQuery,
  onSearchChange,
  canManageCollections,
  onOpenCreateRoot,
  onOpenCreateSavedSearch,
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
          <Tooltip delayDuration={700}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer p-0.5 rounded-md"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45 text-foreground shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
              Clear search
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <span className="truncate min-w-0 font-semibold text-sm tracking-tight text-foreground">Library</span>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Search collections toggle button */}
            <Tooltip delayDuration={700}>
              <TooltipTrigger asChild>
                <button
                  onClick={expandSearch}
                  className="rounded-md p-1.5 text-foreground hover:bg-sidebar-accent cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Search collections"
                >
                  <Search className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                Search collections
              </TooltipContent>
            </Tooltip>

            {/* New collection button */}
            {canManageCollections && (
              <Tooltip delayDuration={700}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenCreateRoot}
                    className="rounded-md p-1.5 text-foreground hover:bg-sidebar-accent cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    aria-label="New collection"
                  >
                    <FolderPlus className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                  New collection
                </TooltipContent>
              </Tooltip>
            )}

            {/* New saved search button */}
            {canManageCollections && onOpenCreateSavedSearch && (
              <Tooltip delayDuration={700}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onOpenCreateSavedSearch}
                    className="rounded-md p-1.5 text-foreground hover:bg-sidebar-accent cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    aria-label="New saved search"
                  >
                    <SlidersHorizontal className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                  New saved search
                </TooltipContent>
              </Tooltip>
            )}

            {/* Toggle / Collapse Sidebar Button */}
            <Tooltip delayDuration={700}>
              <TooltipTrigger asChild>
                <button
                  onClick={onToggleCollapse}
                  aria-label="Toggle sidebar"
                  className="rounded-md p-1.5 text-foreground hover:bg-sidebar-accent cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <PanelLeft className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}
