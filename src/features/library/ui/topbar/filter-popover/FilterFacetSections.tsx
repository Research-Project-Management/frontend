"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { SingleDatePopover } from "@/shared/components/ui/single-date-popover";
import type { TagWithCount } from "@/features/library/domain/types/tags.types";

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
  const [tagsOpen, setTagsOpen] = useState(true);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  return (
    <div className="space-y-1.5 flex-1 min-h-0 overflow-y-auto no-scrollbar">
      {/* Empty State if Search Query Yields 0 Matches */}
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

      {/* Type Section */}
      {matchingTypeItems.length > 0 && (
        <div className="border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
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
                  const isChecked = itemTypes.some(
                    (it) => it.toLowerCase() === t.id.toLowerCase(),
                  );
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

      {/* Tags Section */}
      {matchingTags.length > 0 && (
        <div className="border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
          <button
            type="button"
            onClick={() => setTagsOpen(!tagsOpen)}
            className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground cursor-pointer select-none"
          >
            <span>Tags</span>
            {tagsOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>

          {tagsOpen && (
            <div className="pt-1 select-none">
              <div className="max-h-40 overflow-y-auto space-y-0.5 no-scrollbar">
                {matchingTags.map(({ tag }) => {
                  const isSelected = activeTags.some(
                    (t) => t.toLowerCase() === tag.name.toLowerCase(),
                  );
                  const tagCount = tag._count?.itemTags ?? tag.itemCount ?? 0;
                  return (
                    <div
                      key={tag.id}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={isSelected}
                      onClick={() => onTagToggle(tag.name)}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          onTagToggle(tag.name);
                        }
                      }}
                      className={cn(
                        "flex items-start gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                        isSelected
                          ? "bg-muted font-medium"
                          : "hover:bg-muted font-normal",
                      )}
                    >
                      <div className="pt-0.5 shrink-0">
                        <FilterCheckbox checked={isSelected} />
                      </div>
                      <span className="flex-1 min-w-0 break-words whitespace-normal leading-snug tracking-tight text-12">
                        {tag.name}
                      </span>
                      {tagCount > 0 && (
                        <span className="shrink-0 text-11 font-mono text-muted-foreground pt-0.5">
                          {tagCount}
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

      {/* Files Section */}
      {matchingFileItems.length > 0 && (
        <div className="border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
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

      {/* Progress Section */}
      {matchingReadingItems.length > 0 && (
        <div className="border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
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
                const isChecked = readStatuses.includes(item.id);
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

      {/* Date Section */}
      {showDateSection && (
        <div className="border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
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
