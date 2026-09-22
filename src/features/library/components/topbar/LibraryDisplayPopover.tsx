'use client';

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Check,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
export type {
  LibraryColumnKey,
  LibraryOrderBy,
  LibraryDisplayOptions,
} from '../../types/display.types';
export { DEFAULT_LIBRARY_DISPLAY_OPTIONS } from '../../types/display.types';
import type { LibraryDisplayOptions, LibraryColumnKey, LibraryOrderBy } from '../../types/display.types';

export interface LibraryDisplayPopoverProps {
  options: LibraryDisplayOptions;
  onOptionsChange: (options: LibraryDisplayOptions) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export const COLUMN_ITEMS: Array<{ key: LibraryColumnKey; label: string }> = [
  { key: 'authors', label: 'Creator' },
  { key: 'year', label: 'Year' },
  { key: 'publication', label: 'Publication' },
  { key: 'itemType', label: 'Item Type' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'dateAdded', label: 'Date Added' },
  { key: 'dateModified', label: 'Date Modified' },
  { key: 'doi', label: 'DOI' },
  { key: 'citationKey', label: 'Citation Key' },
  { key: 'citations', label: 'Citations' },
  { key: 'references', label: 'References' },
  { key: 'pages', label: 'Pages' },
  { key: 'volume', label: 'Volume' },
  { key: 'issue', label: 'Issue' },
  { key: 'edition', label: 'Edition' },
  { key: 'language', label: 'Language' },
  { key: 'extra', label: 'Extra' },
  { key: 'collection', label: 'Collection' },
];

const ORDER_BY_OPTIONS: Array<{ value: LibraryOrderBy; label: string }> = [
  { value: 'createdAt', label: 'Date Added' },
  { value: 'updatedAt', label: 'Date Modified' },
  { value: 'year', label: 'Year' },
  { value: 'title', label: 'Title' },
  { value: 'authors', label: 'Creator' },
  { value: 'itemType', label: 'Item Type' },
  { value: 'citationCount', label: 'Citations' },
  { value: 'lastReadAt', label: 'Last Read' },
];

export function LibraryDisplayPopover({
  options,
  onOptionsChange,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  className,
}: LibraryDisplayPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [columnsOpen, setColumnsOpen] = useState(true);
  const [orderByOpen, setOrderByOpen] = useState(true);
  const [densityOpen, setDensityOpen] = useState(true);

  const { columns, orderBy, orderDirection, density = 'comfortable' } = options;

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
    });
  };

  const toggleOrderDirection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOptionsChange({
      ...options,
      orderDirection: orderDirection === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleDensityChange = (d: 'comfortable' | 'compact') => {
    onOptionsChange({
      ...options,
      density: d,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          className={cn(
            "h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shadow-2xs shrink-0 select-none inline-flex items-center justify-center",
            open && "bg-muted",
            className
          )}
          aria-label="Display options"
        >
          <span>Display</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-68 sm:w-72 max-h-[85vh] overflow-y-auto p-2 rounded-md text-12 border-border bg-popover shadow-none space-y-1.5 select-none font-sans no-scrollbar"
      >
        {/* 1. Display Properties (Columns) */}
        <div>
          <button
            type="button"
            onClick={() => setColumnsOpen(!columnsOpen)}
            className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
          >
            <span>Columns</span>
            {columnsOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {columnsOpen && (
            <div className="flex flex-wrap items-center gap-1 pt-1 px-0.5 select-none">
              <span className="h-6 px-2 text-11 font-medium rounded-md bg-muted text-muted-foreground border border-transparent cursor-not-allowed select-none inline-flex items-center justify-center">
                Title
              </span>
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
                        ? "border-primary bg-primary text-primary-foreground font-semibold"
                        : "border-border/70 bg-background text-foreground hover:bg-muted font-normal"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 my-0.5" />

        {/* 2. Order by */}
        <div>
          <div className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground select-none">
            <button
              type="button"
              onClick={() => setOrderByOpen(!orderByOpen)}
              className="hover:text-foreground/80 transition-colors cursor-pointer text-12 font-medium"
            >
              <span>Order by</span>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleOrderDirection}
                className="size-6 flex items-center justify-center rounded-md border border-border hover:bg-muted text-foreground transition-colors cursor-pointer shadow-2xs"
                title={orderDirection === 'asc' ? 'Ascending (A to Z / Low to High)' : 'Descending (Z to A / High to Low)'}
                aria-label="Toggle sort direction"
              >
                {orderDirection === 'asc' ? (
                  <ArrowUpNarrowWide className="size-3 text-foreground shrink-0" />
                ) : (
                  <ArrowDownNarrowWide className="size-3 text-foreground shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setOrderByOpen(!orderByOpen)}
                className="p-0.5 text-foreground hover:text-foreground/80 transition-colors cursor-pointer"
                aria-label={orderByOpen ? "Collapse order by" : "Expand order by"}
              >
                {orderByOpen ? (
                  <ChevronUp className="size-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {orderByOpen && (
            <div className="space-y-0.5 pt-0.5 select-none">
              {ORDER_BY_OPTIONS.map((opt) => {
                const isSelected = orderBy === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex w-full items-center gap-2 py-1 px-1.5 rounded-md text-12 text-foreground transition-colors cursor-pointer select-none hover:bg-muted/50",
                      isSelected ? "font-medium" : "font-normal"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleOrderByChange(opt.value)}
                      className="size-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/50 my-0.5" />

        {/* 3. Density */}
        <div>
          <button
            type="button"
            onClick={() => setDensityOpen(!densityOpen)}
            className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
          >
            <span>Density</span>
            {densityOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {densityOpen && (
            <div className="space-y-0.5 pt-0.5 select-none">
              {[
                { value: 'comfortable' as const, label: 'Comfortable' },
                { value: 'compact' as const, label: 'Compact' },
              ].map((item) => {
                const isSelected = density === item.value;
                return (
                  <label
                    key={item.value}
                    className={cn(
                      "flex w-full items-center gap-2 py-1 px-1.5 rounded-md text-12 text-foreground transition-colors cursor-pointer select-none hover:bg-muted/50",
                      isSelected ? "font-medium" : "font-normal"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleDensityChange(item.value)}
                      className="size-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
                    />
                    <span>{item.label}</span>
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
