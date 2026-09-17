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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

export type LibraryColumnKey =
  | 'authors'
  | 'year'
  | 'publication'
  | 'itemType'
  | 'publisher'
  | 'dateAdded'
  | 'dateModified'
  | 'doi'
  | 'citationKey'
  | 'citations'
  | 'references'
  | 'pages'
  | 'volume'
  | 'issue'
  | 'edition'
  | 'language'
  | 'extra'
  | 'collection';

export type LibraryOrderBy =
  | 'createdAt'
  | 'updatedAt'
  | 'year'
  | 'title'
  | 'authors'
  | 'itemType'
  | 'citationCount'
  | 'lastReadAt';

export interface LibraryDisplayOptions {
  columns: Record<LibraryColumnKey, boolean>;
  orderBy: LibraryOrderBy;
  orderDirection: 'asc' | 'desc';
  density?: 'comfortable' | 'compact';
}

export const DEFAULT_LIBRARY_DISPLAY_OPTIONS: LibraryDisplayOptions = {
  columns: {
    authors: true,
    year: true,
    publication: true,
    itemType: true,
    publisher: false,
    dateAdded: false,
    dateModified: false,
    doi: true,
    citationKey: false,
    citations: true,
    references: false,
    pages: false,
    volume: false,
    issue: false,
    edition: false,
    language: false,
    extra: false,
    collection: false,
  },
  orderBy: 'createdAt',
  orderDirection: 'desc',
  density: 'comfortable',
};

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
          variant="outline"
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
        className="w-72 p-3 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 flex flex-col gap-2.5 select-none font-sans no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        {/* 1. Display Properties (Columns) */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setColumnsOpen(!columnsOpen)}
            className="flex w-full items-center justify-between py-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
          >
            <span>Columns</span>
            {columnsOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {columnsOpen && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 select-none">
              <span className="px-2.5 py-1 rounded-md text-11 font-medium bg-muted text-muted-foreground border border-transparent cursor-not-allowed select-none">
                Title
              </span>
              {COLUMN_ITEMS.map((item) => {
                const isSelected = Boolean(columns[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleColumnToggle(item.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-11 font-medium border transition-colors cursor-pointer select-none",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground font-semibold"
                        : "bg-background border-border text-foreground hover:bg-muted font-normal"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Order by */}
        <div className="border-t border-border pt-2 shrink-0">
          <div className="flex items-center justify-between py-1">
            <button
              type="button"
              onClick={() => setOrderByOpen(!orderByOpen)}
              className="flex items-center gap-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
            >
              <span>Order by</span>
              {orderByOpen ? (
                <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleOrderDirection}
              className="size-6 flex items-center justify-center rounded-md border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
              title={orderDirection === 'asc' ? 'Ascending (A to Z / Low to High)' : 'Descending (Z to A / High to Low)'}
              aria-label="Toggle sort direction"
            >
              {orderDirection === 'asc' ? (
                <ArrowUpNarrowWide className="size-3 text-foreground shrink-0" />
              ) : (
                <ArrowDownNarrowWide className="size-3 text-foreground shrink-0" />
              )}
            </button>
          </div>

          {orderByOpen && (
            <div role="radiogroup" aria-label="Order by" className="space-y-0.5 pt-1">
              {ORDER_BY_OPTIONS.map((opt) => {
                const isSelected = orderBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleOrderByChange(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 py-1.5 px-2 rounded-md text-12 transition-colors cursor-pointer select-none",
                      isSelected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "size-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      )}
                    >
                      {isSelected && <Check className="size-2 text-primary-foreground stroke-[3] shrink-0" />}
                    </div>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Density */}
        <div className="border-t border-border pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setDensityOpen(!densityOpen)}
            className="flex w-full items-center justify-between py-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
          >
            <span>Density</span>
            {densityOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {densityOpen && (
            <div role="radiogroup" aria-label="Density" className="space-y-0.5 pt-1">
              {[
                { value: 'comfortable' as const, label: 'Comfortable' },
                { value: 'compact' as const, label: 'Compact' },
              ].map((item) => {
                const isSelected = density === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleDensityChange(item.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 py-1.5 px-2 rounded-md text-12 transition-colors cursor-pointer select-none",
                      isSelected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "size-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background"
                      )}
                    >
                      {isSelected && <Check className="size-2.5 text-primary-foreground stroke-[3] shrink-0" />}
                    </div>
                    <span>{item.label}</span>
                  </button>
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
