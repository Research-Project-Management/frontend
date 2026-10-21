"use client";

import { useRef, useState } from "react";
import {
  Search,
  X,
  FolderPlus,
  SlidersHorizontal,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

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
    onSearchChange("");
    setIsSearchExpanded(false);
  };

  return (
    <div
      className={cn(
        "flex items-center h-8 font-semibold text-sm tracking-tight text-foreground select-none w-full",
        isSearchExpanded || searchQuery ? "px-0" : "justify-between px-1"
      )}
    >
      {isSearchExpanded || searchQuery ? (
        <div className="relative flex items-center w-full h-8 rounded-md border border-border bg-background overflow-hidden font-normal text-13">
          <Search
            className="absolute top-1/2 -translate-y-1/2 size-3.5 z-10 left-2.5 translate-x-0 text-muted-foreground pointer-events-none shrink-0"
            strokeWidth={1.5}
          />
          <Input
            ref={searchInputRef}
            autoFocus
            placeholder="Search collections..."
            aria-label="Search collections"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onSearchChange("");
                setIsSearchExpanded(false);
              }
            }}
            onBlur={() => {
              if (!searchQuery) {
                setIsSearchExpanded(false);
              }
            }}
            className="h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 focus-visible:border-none focus-visible:outline-none focus:outline-none outline-none shadow-none w-full placeholder:text-muted-foreground placeholder:font-normal pl-8 pr-7 text-foreground"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleClearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-2 md:before:hidden"
                aria-label="Clear search"
              >
                <X
                  className="size-3 shrink-0"
                  strokeWidth={1.5}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              sideOffset={6}
              alignOffset={2}
            >
              Clear search
            </TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <>
          <span className="shrink-0 font-semibold text-15 tracking-tight text-foreground">
            Library
          </span>

          <div className="flex items-center gap-0.5 shrink-0">
            {/* Search collections toggle button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={expandSearch}
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                  aria-label="Search collections"
                >
                  <Search
                    className="size-4 shrink-0 text-foreground"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                Search collections
              </TooltipContent>
            </Tooltip>

            {/* New collection button */}
            {canManageCollections && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenCreateRoot}
                    className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                    aria-label="New collection"
                  >
                    <FolderPlus
                      className="size-4 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                >
                  New collection
                </TooltipContent>
              </Tooltip>
            )}

            {/* New saved search button */}
            {canManageCollections && onOpenCreateSavedSearch && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onOpenCreateSavedSearch}
                    className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                    aria-label="New saved search"
                  >
                    <SlidersHorizontal
                      className="size-4 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                >
                  New saved search
                </TooltipContent>
              </Tooltip>
            )}

            {/* Toggle / Collapse Sidebar Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  aria-label="Toggle sidebar"
                  className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                >
                  <PanelLeft
                    className="size-4 shrink-0 text-foreground"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
    </div>
  );
}
