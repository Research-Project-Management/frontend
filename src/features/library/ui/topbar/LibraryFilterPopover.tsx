"use client";

import { useState, useRef, useMemo } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Checkbox } from "@/shared/components/ui/checkbox";
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
import { SingleDatePopover } from "@/shared/components/ui/single-date-popover";
import { FilterFunnelIcon } from "@/shared/components/icons";
import type { Item, TagWithCount } from "@/features/library/domain/types/core.types";
import { useLibraryFacetCounts } from "@/features/library/core/coordinator/facet-filter.coordinator";
import { useLibraryPermissions } from "@/features/library/core/adapters/project-context.adapter";
import { FilterTagsSection } from "./FilterTagsSection";

function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <Checkbox
      checked={checked}
      tabIndex={-1}
      aria-hidden="true"
      className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none shrink-0"
    />
  );
}

export interface FilterFacetSectionsProps {
  searchQuery: string;
  onClearSearchQuery: () => void;
  totalMatchesCount: number;
  matchingTypeItems: Array<{ id: string; label: string; count: number }>;
  itemTypes: string[];
  onTypeToggle: (id: string) => void;
  matchingTags: Array<{ tag: TagWithCount; score: number }>;
  activeTags: string[];
  onTagToggle: (name: string) => void;
  showAutomaticTags?: boolean;
  onToggleShowAutomaticTags?: (show: boolean) => void;
  onCreateTag?: (params: {
    name: string;
    color?: string;
    type?: string;
  }) => Promise<unknown>;
  onUpdateTag?: (params: {
    tagId: string;
    data: {
      name?: string;
      color?: string;
      type?: string;
      shortcut?: number | null;
    };
  }) => Promise<unknown>;
  onDeleteTag?: (tagId: string) => Promise<unknown>;
  onDeleteAutomaticTags?: () => Promise<unknown>;
  isDeletingAutomatic?: boolean;
  onSplitTag?: (params: { tagId: string; parts: string[] }) => Promise<unknown>;
  matchingFileItems: Array<{
    id: "has-pdf" | "missing-pdf" | "has-notes";
    label: string;
  }>;
  fileStatus: string;
  onFileStatusToggle: (id: "has-pdf" | "missing-pdf" | "has-notes") => void;
  matchingReadingItems: Array<{
    id: "unread" | "reading" | "completed";
    label: string;
  }>;
  readStatuses: string[];
  onReadStatusToggle: (id: "unread" | "reading" | "completed") => void;
  showDateSection: boolean;
  hasDateFilter: boolean;
  startDate: string;
  endDate: string;
  onStartDateSelect: (dateStr: string) => void;
  onEndDateSelect: (dateStr: string) => void;
  onClearDate: () => void;
}

export function FilterFacetSections({
  searchQuery,
  onClearSearchQuery,
  totalMatchesCount,
  matchingTypeItems,
  itemTypes,
  onTypeToggle,
  matchingTags,
  activeTags,
  onTagToggle,
  showAutomaticTags,
  onToggleShowAutomaticTags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onDeleteAutomaticTags,
  isDeletingAutomatic,
  onSplitTag,
  matchingFileItems,
  fileStatus,
  onFileStatusToggle,
  matchingReadingItems,
  readStatuses,
  onReadStatusToggle,
  showDateSection,
  hasDateFilter,
  startDate,
  endDate,
  onStartDateSelect,
  onEndDateSelect,
  onClearDate,
}: FilterFacetSectionsProps) {
  const [filesOpen, setFilesOpen] = useState(true);
  const [readingOpen, setReadingOpen] = useState(true);
  const [typesOpen, setTypesOpen] = useState(true);
  const [yearOpen, setYearOpen] = useState(true);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const itemTypeSet = useMemo(
    () => new Set(itemTypes.map((it) => it.toLowerCase())),
    [itemTypes],
  );
  const readStatusSet = useMemo(
    () => new Set(readStatuses),
    [readStatuses],
  );

  return (
    <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto no-scrollbar">
      {searchQuery.trim() && totalMatchesCount === 0 ? (
        <div className="py-6 text-center text-12 text-muted-foreground select-none">
          <p className="font-medium text-foreground">No matching filters</p>
          <p className="text-12 text-muted-foreground mt-0.5">
            No options match &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            type="button"
            onClick={onClearSearchQuery}
            className="mt-2 text-12 text-foreground underline cursor-pointer font-medium"
          >
            Clear search
          </button>
        </div>
      ) : null}

      {matchingTypeItems.length > 0 && (
        <div className="-mx-2 px-2 border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
          <button
            type="button"
            onClick={() => setTypesOpen(!typesOpen)}
            className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground cursor-pointer select-none"
          >
            <span>Type</span>
            {typesOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>

          {typesOpen && (
            <div className="pt-1 select-none">
              <div className="max-h-36 overflow-y-auto space-y-0.5 no-scrollbar">
                {matchingTypeItems.map((t) => {
                  const isChecked = itemTypeSet.has(t.id.toLowerCase());
                  return (
                    <div
                      key={t.id}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={isChecked}
                      onClick={() => onTypeToggle(t.id)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          onTypeToggle(t.id);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        isChecked && "bg-muted font-medium",
                      )}
                    >
                      <FilterCheckbox checked={isChecked} />
                      <span className="font-normal leading-none truncate">
                        {t.label}
                      </span>
                      {t.count > 0 && (
                        <span className="ml-auto shrink-0 text-11 font-mono text-muted-foreground">
                          {t.count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <FilterTagsSection
        matchingTags={matchingTags}
        activeTags={activeTags}
        onTagToggle={onTagToggle}
        showAutomaticTags={showAutomaticTags}
        onToggleShowAutomaticTags={onToggleShowAutomaticTags}
        onCreateTag={onCreateTag}
        onUpdateTag={onUpdateTag}
        onDeleteTag={onDeleteTag}
        onDeleteAutomaticTags={onDeleteAutomaticTags}
        isDeletingAutomatic={isDeletingAutomatic}
        onSplitTag={onSplitTag}
      />

      {matchingFileItems.length > 0 && (
        <div className="-mx-2 px-2 border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
          <button
            type="button"
            onClick={() => setFilesOpen(!filesOpen)}
            className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground cursor-pointer select-none"
          >
            <span>Files</span>
            {filesOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>

          {filesOpen && (
            <div className="space-y-0.5 pt-1 select-none">
              {matchingFileItems.map((item) => {
                const isChecked = fileStatus === item.id;
                return (
                  <div
                    key={item.id}
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={isChecked}
                    onClick={() => onFileStatusToggle(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        onFileStatusToggle(item.id);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                      isChecked && "bg-muted font-medium",
                    )}
                  >
                    <FilterCheckbox checked={isChecked} />
                    <span className="font-normal leading-none">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {matchingReadingItems.length > 0 && (
        <div className="-mx-2 px-2 border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
          <button
            type="button"
            onClick={() => setReadingOpen(!readingOpen)}
            className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground cursor-pointer select-none"
          >
            <span>Progress</span>
            {readingOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>

          {readingOpen && (
            <div className="space-y-0.5 pt-1 select-none">
              {matchingReadingItems.map((item) => {
                const isChecked = readStatusSet.has(item.id);
                return (
                  <div
                    key={item.id}
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={isChecked}
                    onClick={() => onReadStatusToggle(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        onReadStatusToggle(item.id);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                      isChecked && "bg-muted font-medium",
                    )}
                  >
                    <FilterCheckbox checked={isChecked} />
                    <span className="font-normal leading-none">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showDateSection && (
        <div className="-mx-2 px-2 border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
          <button
            type="button"
            onClick={() => setYearOpen(!yearOpen)}
            className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground cursor-pointer select-none"
          >
            <div className="flex items-center gap-1.5">
              <span>Date</span>
              {hasDateFilter && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {hasDateFilter && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearDate();
                      }}
                      className="text-12 text-foreground underline cursor-pointer px-1 py-0.5 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      Clear
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Clear date filter</TooltipContent>
                </Tooltip>
              )}
              {yearOpen ? (
                <ChevronUp className="size-3.5 text-foreground shrink-0" />
              ) : (
                <ChevronDown className="size-3.5 text-foreground shrink-0" />
              )}
            </div>
          </button>

          {yearOpen && (
            <div className="pt-1 flex flex-col gap-0.5 select-none">
              <SingleDatePopover
                label="Start date"
                date={startDate}
                onSelectDate={onStartDateSelect}
                open={startDateOpen}
                onOpenChange={setStartDateOpen}
                variant="ghost"
                actionBtnClass="w-full justify-start h-8 px-2 text-12 font-normal rounded-md border-0 bg-transparent hover:bg-muted text-foreground transition-colors shadow-none cursor-pointer"
              />
              <SingleDatePopover
                label="End date"
                date={endDate}
                onSelectDate={onEndDateSelect}
                open={endDateOpen}
                onOpenChange={setEndDateOpen}
                variant="ghost"
                actionBtnClass="w-full justify-start h-8 px-2 text-12 font-normal rounded-md border-0 bg-transparent hover:bg-muted text-foreground transition-colors shadow-none cursor-pointer"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface LibraryFilterPopoverProps {
  scopeId?: string;
  items?: Item[];
  className?: string;
}

export function LibraryFilterPopover({
  scopeId: propScopeId,
  items,
  className,
}: LibraryFilterPopoverProps) {
  const scopeId = propScopeId || "user";
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { canEditItem } = useLibraryPermissions();

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
        <div
          role="presentation"
          className="relative flex items-center mb-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0"
            strokeWidth={1.5}
          />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full pl-8 pr-7 text-13 bg-background border-border hover:border-border-hover rounded-md focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring text-foreground placeholder:text-muted-foreground shadow-none"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== "Escape") e.stopPropagation();
            }}
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

        {facets.activeCount > 0 && (
          <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-border text-11 shrink-0">
            <span className="text-muted-foreground font-normal">
              {facets.activeCount} {facets.activeCount === 1 ? "filter" : "filters"} active
            </span>
            <button
              type="button"
              onClick={facets.handleClearAllFilters}
              className="text-11 font-medium text-primary hover:underline cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}

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
          showAutomaticTags={facets.showAutomaticTags}
          onToggleShowAutomaticTags={facets.setShowAutomaticTags}
          onCreateTag={canEditItem ? facets.createTag : undefined}
          onUpdateTag={canEditItem ? facets.updateTag : undefined}
          onDeleteTag={canEditItem ? facets.deleteTag : undefined}
          onDeleteAutomaticTags={canEditItem ? facets.deleteAutomaticTags : undefined}
          isDeletingAutomatic={facets.isDeletingAutomatic}
          onSplitTag={canEditItem ? facets.splitTag : undefined}
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
