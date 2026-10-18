"use client";

import React from "react";
import { Loader2, ArrowUpDown, FileText } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import type { Item } from "@/features/library/domain/types/items.types";

export interface SavedSearchPreviewTableProps {
  isPreviewLoading: boolean;
  previewCount: number | null;
  previewSamples: Item[];
  sortBy: "dateAdded" | "year" | "title" | "creator";
  onSortByChange: (val: "dateAdded" | "year" | "title" | "creator") => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (val: "asc" | "desc") => void;
}

export function SavedSearchPreviewTable({
  isPreviewLoading,
  previewCount,
  previewSamples,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: SavedSearchPreviewTableProps) {
  return (
    <div className="flex-1 min-h-[160px] flex flex-col pt-1">
      {/* Table Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-border text-11">
        <div
          className="flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <span className="font-medium text-foreground">Preview results</span>
          {isPreviewLoading ? (
            <span className="flex items-center gap-1 text-foreground font-normal">
              <Loader2
                className="size-3 animate-spin text-foreground"
                aria-hidden="true"
              />
              Searching...
            </span>
          ) : previewCount !== null ? (
            <span className="text-foreground font-normal">
              ({previewCount} {previewCount === 1 ? "item" : "items"} found)
            </span>
          ) : null}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-foreground text-12 flex items-center gap-1 shrink-0">
            <ArrowUpDown
              className="size-3 text-foreground shrink-0"
              aria-hidden="true"
              strokeWidth={1.5}
            />
            Sort:
          </span>
          <Select value={sortBy} onValueChange={onSortByChange}>
            <SelectTrigger
              size="sm"
              aria-label="Sort by field"
              className="w-[130px] h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring rounded-md shrink-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
              <SelectItem
                value="dateAdded"
                className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
              >
                Date Added
              </SelectItem>
              <SelectItem
                value="year"
                className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
              >
                Year
              </SelectItem>
              <SelectItem
                value="title"
                className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
              >
                Title
              </SelectItem>
              <SelectItem
                value="creator"
                className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
              >
                Author
              </SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={onSortOrderChange}>
            <SelectTrigger
              size="sm"
              aria-label="Sort direction"
              className="w-[125px] h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring rounded-md shrink-0"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
              <SelectItem
                value="desc"
                className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
              >
                Descending
              </SelectItem>
              <SelectItem
                value="asc"
                className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
              >
                Ascending
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Line-separated Table (NO card border) */}
      <div className="max-h-40 min-h-[100px] overflow-y-auto overflow-x-auto scrollbar-thin text-11">
        {previewSamples.length > 0 ? (
          <table
            className="w-full text-left border-collapse min-w-[480px] sm:min-w-full"
            aria-label="Matching search preview publications"
          >
            <thead>
              <tr className="border-b border-border text-11 font-medium text-foreground">
                <th scope="col" className="py-1.5 pr-3">
                  Title
                </th>
                <th scope="col" className="py-1.5 px-3 w-40">
                  Creator
                </th>
                <th
                  scope="col"
                  className="py-1.5 px-3 w-28 hidden sm:table-cell"
                >
                  Type
                </th>
                <th scope="col" className="py-1.5 pl-3 w-16 text-right">
                  Year
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {previewSamples.map((item) => (
                <tr key={item.id} className="hover:bg-muted transition-colors">
                  <td
                    className="py-1.5 pr-3 max-w-[280px] truncate text-foreground font-medium"
                    title={item.title}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <FileText
                        className="size-3 text-foreground shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {item.title || "Untitled"}
                      </span>
                    </span>
                  </td>
                  <td
                    className="py-1.5 px-3 truncate text-foreground"
                    title={item.authors?.join(", ") || ""}
                  >
                    {item.authors?.[0]
                      ? `${item.authors[0]}${item.authors.length > 1 ? " et al." : ""}`
                      : "—"}
                  </td>
                  <td className="py-1.5 px-3 truncate text-foreground capitalize hidden sm:table-cell">
                    {item.itemType || "document"}
                  </td>
                  <td className="py-1.5 pl-3 text-right text-foreground font-mono">
                    {item.year || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="h-24 flex flex-col items-center justify-center text-center p-4 text-foreground">
            {isPreviewLoading ? (
              <p className="text-11">Searching publications...</p>
            ) : previewCount === 0 ? (
              <p className="text-11">
                No publications match the specified criteria.
              </p>
            ) : (
              <p className="text-11">
                Set conditions above to preview matching publications in
                real-time.
              </p>
            )}
          </div>
        )}
      </div>

      {previewCount !== null && previewCount > previewSamples.length && (
        <div className="pt-1.5 border-t border-border-subtle text-11 text-foreground text-center">
          + {previewCount - previewSamples.length} more publications match this
          search
        </div>
      )}
    </div>
  );
}
