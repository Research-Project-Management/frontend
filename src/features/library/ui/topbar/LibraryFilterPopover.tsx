"use client";

import { useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { FilterFunnelIcon } from "@/shared/components/icons";
import type { Item } from "@/features/library/domain/types/library.types";
import { useLibraryFacetCounts } from "./filter-popover/useLibraryFacetCounts";
import { FilterFacetSections } from "./filter-popover/FilterFacetSections";

export interface LibraryFilterPopoverProps {
  scopeId?: string;
  projectId?: string;
  items?: Item[];
  className?: string;
}

export function LibraryFilterPopover({
  scopeId: propScopeId,
  projectId: propProjectId,
  items,
  className,
}: LibraryFilterPopoverProps) {
  const scopeId = propScopeId || propProjectId || "user";
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const facets = useLibraryFacetCounts({
    scopeId,
    items,
    searchQuery,
    isOpen,
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size={facets.activeCount > 0 ? "sm" : "icon"}
              className={cn(
                "rounded-md border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors shrink-0 select-none inline-flex items-center",
                facets.activeCount > 0
                  ? "h-8 px-2.5 gap-1.5 border-primary text-primary"
                  : "size-8",
                isOpen && "bg-muted",
                className,
              )}
              aria-label={
                facets.activeCount > 0
                  ? `Filter (${facets.activeCount} active)`
                  : "Filter"
              }
            >
              <FilterFunnelIcon
                className={cn(
                  "size-4 shrink-0",
                  facets.activeCount > 0 ? "text-primary" : "text-foreground",
                )}
              />
              {facets.activeCount > 0 && (
                <span className="text-12 font-medium font-mono tabular-nums leading-none">
                  {facets.activeCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {facets.activeCount > 0
            ? `Filter (${facets.activeCount} active)`
            : "Filter"}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 max-h-[85vh] p-2 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 font-sans flex flex-col select-none"
      >
        {/* Main Search Header at Top */}
        <div
          role="presentation"
          className="relative flex items-center mb-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full pl-8 pr-7 text-13 bg-background border border-border hover:border-border-hover rounded-md outline-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground placeholder:font-normal shadow-none transition-colors"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-md"
              aria-label="Clear filter search"
            >
              <X className="size-3 shrink-0" />
            </button>
          )}
        </div>

        {/* Scrollable Facet Sections */}
        <FilterFacetSections
          searchQuery={searchQuery}
          onClearSearchQuery={() => setSearchQuery("")}
          totalMatchesCount={facets.totalMatchesCount}
          matchingTypeItems={facets.matchingTypeItems}
          itemTypes={facets.itemTypes}
          onTypeToggle={facets.handleTypeToggle}
          matchingTags={facets.matchingTags}
          activeTags={facets.activeTags}
          onTagToggle={facets.handleTagToggle}
          matchingFileItems={facets.matchingFileItems}
          fileStatus={facets.fileStatus}
          onFileStatusToggle={facets.handleFileStatusToggle}
          matchingReadingItems={facets.matchingReadingItems}
          readStatuses={facets.readStatuses}
          onReadStatusToggle={facets.handleReadStatusToggle}
          showDateSection={facets.dateSectionMatch.matches}
          hasDateFilter={facets.hasDateFilter}
          startDate={facets.startDate}
          endDate={facets.endDate}
          onStartDateSelect={facets.handleStartDateSelect}
          onEndDateSelect={facets.handleEndDateSelect}
          onClearDate={facets.handleClearDate}
        />
      </PopoverContent>
    </Popover>
  );
}

export default LibraryFilterPopover;
