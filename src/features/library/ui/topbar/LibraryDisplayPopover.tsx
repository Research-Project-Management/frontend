'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ArrowUpNarrowWide, ArrowDownNarrowWide, Search, X, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import {
  getDefaultSortDirection,
  type LibraryDisplayOptions,
  type LibraryColumnKey,
  type LibraryOrderBy,
} from '@/features/library/types/ingestion.types';
import { useLibraryUIStore } from '@/features/library/core/store/ui.store';
import { Input } from '@/shared/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

export type {
  LibraryColumnKey,
  LibraryOrderBy,
  LibraryDisplayOptions,
};

interface LibraryDisplayPopoverProps {
  options: LibraryDisplayOptions;
  onOptionsChange: (options: LibraryDisplayOptions) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  isTrash?: boolean;
  hasActiveSearch?: boolean;
}

export const COLUMN_ITEMS: Array<{ key: LibraryColumnKey; label: string }> = [
  { key: "authors", label: "Creator" },
  { key: "year", label: "Year" },
  { key: "publication", label: "Publication" },
  { key: "itemType", label: "Item Type" },
  { key: "doi", label: "DOI" },
  { key: "citationKey", label: "Citation Key" },
  { key: "createdAt", label: "Date Added" },
  { key: "citations", label: "Citations" },
];

const ORDER_BY_OPTIONS: Array<{ value: LibraryOrderBy; label: string }> = [
  { value: "createdAt", label: "Date Added" },
  { value: "updatedAt", label: "Date Modified" },
  { value: "year", label: "Year" },
  { value: "title", label: "Title" },
  { value: "authors", label: "Creator" },
  { value: "publicationTitle", label: "Publication" },
  { value: "citationKey", label: "Citation Key" },
];

export function LibraryDisplayPopover({
  options,
  onOptionsChange,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  className,
  isTrash,
  hasActiveSearch,
}: LibraryDisplayPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [columnsOpen, setColumnsOpen] = useState(true);
  const [orderByOpen, setOrderByOpen] = useState(true);

  const { columns, orderBy, orderDirection } = options;

  const orderByOptions = React.useMemo(() => {
    const list: Array<{ value: LibraryOrderBy; label: string }> = [];
    if (hasActiveSearch || orderBy === "relevance") {
      list.push({ value: "relevance", label: "Relevance" });
    }
    list.push(...ORDER_BY_OPTIONS);
    if (isTrash || orderBy === "deletedAt") {
      list.push({ value: "deletedAt" as LibraryOrderBy, label: "Date Deleted" });
    }
    return list;
  }, [hasActiveSearch, isTrash, orderBy]);

  const handleColumnToggle = (key: LibraryColumnKey) => {
    onOptionsChange({
      ...options,
      columns: {
        ...columns,
        [key]: !columns[key],
      },
    });
  };

  const handleOrderByChange = (val: LibraryOrderBy) => {
    onOptionsChange({
      ...options,
      orderBy: val,
      orderDirection:
        val === orderBy ? orderDirection : getDefaultSortDirection(val),
    });
  };

  const toggleOrderDirection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOptionsChange({
      ...options,
      orderDirection: orderDirection === "asc" ? "desc" : "asc",
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            open && "bg-muted",
            className,
          )}
          aria-label="Display options"
        >
          <span>Display</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-74 sm:w-76 max-h-[85vh] overflow-y-auto p-2 rounded-md text-12 border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-1.5 select-none font-sans no-scrollbar"
      >
        {/* 1. Display Properties (Columns) */}
        <div>
          <button
            type="button"
            onClick={() => setColumnsOpen(!columnsOpen)}
            className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground cursor-pointer select-none"
          >
            <span>Columns</span>
            {columnsOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>

          {columnsOpen && (
            <div className="flex flex-wrap items-center gap-1 pt-1 px-0.5 select-none">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="h-6 px-2 text-11 font-medium rounded-md bg-primary text-primary-foreground border border-primary select-none inline-flex items-center justify-center cursor-default">
                    Title
                  </span>
                </TooltipTrigger>
                <TooltipContent>Always visible</TooltipContent>
              </Tooltip>
              {COLUMN_ITEMS.map((item) => {
                const isSelected = Boolean(columns[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleColumnToggle(item.key)}
                    className={cn(
                      "h-6 px-2 text-11 font-medium rounded-md border transition-colors cursor-pointer select-none inline-flex items-center justify-center",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground font-medium"
                        : "border-border bg-background text-foreground hover:bg-muted font-normal",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="-mx-2 border-t border-border my-0.5" />

        {/* 2. Order by */}
        <div>
          <div className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground select-none">
            <button
              type="button"
              onClick={() => setOrderByOpen(!orderByOpen)}
              className="text-12 font-medium text-foreground cursor-pointer"
            >
              <span>Order by</span>
            </button>

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleOrderDirection}
                    className="p-0.5 text-foreground hover:bg-muted rounded cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden"
                    aria-label="Toggle sort direction"
                  >
                    {orderDirection === "asc" ? (
                      <ArrowUpNarrowWide className="size-3.5 text-foreground shrink-0" />
                    ) : (
                      <ArrowDownNarrowWide className="size-3.5 text-foreground shrink-0" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {orderDirection === "asc" ? "Ascending" : "Descending"}
                </TooltipContent>
              </Tooltip>

              <button
                type="button"
                onClick={() => setOrderByOpen(!orderByOpen)}
                className="p-0.5 text-foreground hover:bg-muted rounded cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden"
                aria-label={
                  orderByOpen ? "Collapse order by" : "Expand order by"
                }
              >
                {orderByOpen ? (
                  <ChevronUp className="size-3.5 shrink-0 text-foreground" />
                ) : (
                  <ChevronDown className="size-3.5 shrink-0 text-foreground" />
                )}
              </button>
            </div>
          </div>

          {orderByOpen && (
            <div className="space-y-0.5 pt-0.5 select-none">
              {orderByOptions.map((opt) => {
                const isSelected = orderBy === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex w-full items-center gap-2 py-1 px-1.5 rounded-md text-12 text-foreground transition-colors cursor-pointer select-none hover:bg-muted",
                      isSelected ? "font-medium" : "font-normal",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleOrderByChange(opt.value)}
                      className="size-3.5 border-border data-[state=checked]:border-primary cursor-pointer shrink-0"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default LibraryDisplayPopover;
