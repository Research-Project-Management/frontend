"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import { FilterFunnelIcon } from "@/shared/components/icons";
import type { Item, TagWithCount } from "@/features/library/types/core.types";
import { useLibraryFacetCounts } from "@/features/library/core/coordinator/facet-filter.coordinator";
import { FilterTagsSection } from "./FilterTagsSection";

function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors pointer-events-none",
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-border bg-transparent",
      )}
    >
      {checked && (
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          className="size-2.5 text-white shrink-0"
        >
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

interface FilterFacetSectionsProps {
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
  matchingFileItems: Array<{
    id: "has-pdf" | "missing-pdf" | "has-notes";
    label: string;
  }>;
  fileStatus: string;
  onFileStatusToggle: (id: "has-pdf" | "missing-pdf" | "has-notes") => void;
  showYearSection: boolean;
  fromYear: number | null;
  toYear: number | null;
  onYearPreset: (from: number | null, to: number | null) => void;
  onClearYear: () => void;
}

function FilterFacetSections({
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
  matchingFileItems,
  fileStatus,
  onFileStatusToggle,
  showYearSection,
  fromYear,
  toYear,
  onYearPreset,
  onClearYear,
}: FilterFacetSectionsProps) {
  const [filesOpen, setFilesOpen] = useState(true);
  const [typesOpen, setTypesOpen] = useState(true);
  const [yearOpen, setYearOpen] = useState(true);
  const [fromDraft, setFromDraft] = useState(fromYear ? String(fromYear) : "");
  const [toDraft, setToDraft] = useState(toYear ? String(toYear) : "");

  useEffect(() => {
    setFromDraft(fromYear ? String(fromYear) : "");
  }, [fromYear]);

  useEffect(() => {
    setToDraft(toYear ? String(toYear) : "");
  }, [toYear]);

  const commitYearInputs = (rawFrom: string, rawTo: string) => {
    const parsedFrom = rawFrom.trim() ? parseInt(rawFrom.trim(), 10) : null;
    const parsedTo = rawTo.trim() ? parseInt(rawTo.trim(), 10) : null;
    const validFrom =
      parsedFrom !== null && Number.isFinite(parsedFrom) && parsedFrom >= 1000 && parsedFrom <= 2100
        ? parsedFrom
        : null;
    const validTo =
      parsedTo !== null && Number.isFinite(parsedTo) && parsedTo >= 1000 && parsedTo <= 2100
        ? parsedTo
        : null;
    if (validFrom !== fromYear || validTo !== toYear) {
      onYearPreset(validFrom, validTo);
    }
  };

  const itemTypeSet = useMemo(
    () => new Set(itemTypes.map((it) => it.toLowerCase())),
    [itemTypes],
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
              <div className="max-h-36 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
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

      {showYearSection && (
        <div className="-mx-2 px-2 border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
          <div className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground select-none">
            <button
              type="button"
              onClick={() => setYearOpen(!yearOpen)}
              className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
            >
              <span>Year</span>
            </button>
            <div className="flex items-center gap-1">
              {(fromYear !== null || toYear !== null) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFromDraft("");
                    setToDraft("");
                    onClearYear();
                  }}
                  className="text-11 text-muted-foreground hover:text-foreground cursor-pointer px-1 rounded"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setYearOpen(!yearOpen)}
                className="size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer"
                aria-label={yearOpen ? "Collapse year" : "Expand year"}
              >
                {yearOpen ? (
                  <ChevronUp className="size-3.5 text-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 text-foreground shrink-0" />
                )}
              </button>
            </div>
          </div>

          {yearOpen && (
            <div className="pt-1 px-1 flex items-center gap-1.5 select-none">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="From"
                aria-label="From year"
                value={fromDraft}
                onChange={(e) =>
                  setFromDraft(e.target.value.replace(/\D/g, ""))
                }
                onBlur={() => commitYearInputs(fromDraft, toDraft)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitYearInputs(fromDraft, toDraft);
                  }
                }}
                className="w-full h-7 px-2 rounded-md border border-border bg-background text-12 text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/40 tabular-nums"
              />
              <span className="text-muted-foreground text-12 shrink-0">–</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="To"
                aria-label="To year"
                value={toDraft}
                onChange={(e) =>
                  setToDraft(e.target.value.replace(/\D/g, ""))
                }
                onBlur={() => commitYearInputs(fromDraft, toDraft)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitYearInputs(fromDraft, toDraft);
                  }
                }}
                className="w-full h-7 px-2 rounded-md border border-border bg-background text-12 text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/40 tabular-nums"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LibraryFilterPopoverProps {
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

  const facets = useLibraryFacetCounts({
    scopeId,
    items,
    searchQuery,
    isOpen,
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          className={cn(
            "size-8 rounded-md border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors shrink-0 select-none inline-flex items-center justify-center",
            (isOpen || facets.activeCount > 0) && "bg-muted",
            className,
          )}
          aria-label="Filter references"
        >
          <FilterFunnelIcon className="size-4 shrink-0 text-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 max-h-[85vh] p-2 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 font-sans flex flex-col select-none"
      >
        <div
          role="presentation"
          className="-mx-2 -mt-2 mb-1 px-2.5 h-8 border-b border-border flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Search
            className="size-3.5 text-muted-foreground pointer-events-none shrink-0"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 min-w-0 h-full bg-transparent border-none outline-none ring-0 text-12 text-foreground placeholder:text-muted-foreground"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== "Escape") e.stopPropagation();
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer rounded"
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
          matchingFileItems={facets.matchingFileItems}
          fileStatus={facets.fileStatus}
          onFileStatusToggle={facets.handleFileStatusToggle}
          showYearSection={facets.dateSectionMatch.matches}
          fromYear={facets.fromYear}
          toYear={facets.toYear}
          onYearPreset={facets.handleYearPreset}
          onClearYear={facets.handleClearDate}
        />
      </PopoverContent>
    </Popover>
  );
}

export default LibraryFilterPopover;
