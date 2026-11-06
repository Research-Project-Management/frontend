"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { TagWithCount } from "@/features/library/types/core.types";

interface FilterTagsSectionProps {
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
}

export function FilterTagsSection({
  matchingTags,
  activeTags,
  onTagToggle,
  showAutomaticTags = true,
  onToggleShowAutomaticTags,
}: FilterTagsSectionProps) {
  const [tagsOpen, setTagsOpen] = useState(true);

  const activeTagSet = useMemo(
    () => new Set(activeTags.map((t) => t.toLowerCase())),
    [activeTags],
  );

  if (matchingTags.length === 0) {
    return null;
  }

  return (
    <div className="-mx-2 px-2 border-t border-border pt-1.5 mt-0.5 first:border-t-0 first:pt-0.5 first:mt-0 shrink-0">
      <div className="flex w-full items-center justify-between py-1 px-1 text-12 font-medium text-foreground select-none">
        <button
          type="button"
          onClick={() => setTagsOpen(!tagsOpen)}
          className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
        >
          <span>Tags</span>
        </button>

        <div className="flex items-center gap-0.5">
          {onToggleShowAutomaticTags && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  aria-label="Tag filter options"
                >
                  <MoreHorizontal className="size-3.5 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <DropdownMenuItem
                  onClick={() =>
                    onToggleShowAutomaticTags(!showAutomaticTags)
                  }
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Check
                    className={cn(
                      "size-3.5",
                      showAutomaticTags ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span>Show Automatic Tags</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            type="button"
            onClick={() => setTagsOpen(!tagsOpen)}
            className="size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer"
            aria-label={tagsOpen ? "Collapse tags" : "Expand tags"}
          >
            {tagsOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>
        </div>
      </div>

      {tagsOpen && (
        <div className="pt-1 select-none">
          <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
            {matchingTags.map(({ tag }) => {
              const isSelected = activeTagSet.has(tag.name.toLowerCase());

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
                    "flex items-center gap-2 py-0.5 px-1.5 rounded-md text-12 text-foreground cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    isSelected
                      ? "bg-muted font-medium"
                      : "hover:bg-muted font-normal",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors pointer-events-none",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border bg-transparent",
                    )}
                  >
                    {isSelected && (
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

                  <span className="flex-1 min-w-0 truncate leading-none text-12">
                    {tag.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
export default FilterTagsSection;
