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
  | 'citations'
  | 'dateAdded'
  | 'collection';

export type LibraryOrderBy =
  | 'createdAt'
  | 'year'
  | 'title'
  | 'authors'
  | 'citationCount'
  | 'lastReadAt';

export interface LibraryDisplayOptions {
  columns: Record<LibraryColumnKey, boolean>;
  orderBy: LibraryOrderBy;
  orderDirection: 'asc' | 'desc';
  density?: 'comfortable' | 'compact';
}

export interface LibraryDisplayPopoverProps {
  options: LibraryDisplayOptions;
  onOptionsChange: (options: LibraryDisplayOptions) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const COLUMN_ITEMS: Array<{ key: LibraryColumnKey; label: string }> = [
  { key: 'authors', label: 'Creator / Authors' },
  { key: 'year', label: 'Year' },
  { key: 'publication', label: 'Publication / Venue' },
  { key: 'citations', label: 'Citation count' },
  { key: 'dateAdded', label: 'Date added' },
  { key: 'collection', label: 'Collection' },
];

const ORDER_BY_OPTIONS: Array<{ value: LibraryOrderBy; label: string }> = [
  { value: 'createdAt', label: 'Date added' },
  { value: 'year', label: 'Publication year' },
  { value: 'title', label: 'Title' },
  { value: 'authors', label: 'Creator' },
  { value: 'citationCount', label: 'Citations' },
  { value: 'lastReadAt', label: 'Last read' },
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
            "h-8 px-2.5 text-12 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shadow-2xs shrink-0 select-none",
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
        className="w-72 max-h-[85vh] overflow-y-auto p-3 rounded-md border border-border bg-popover text-popover-foreground shadow-2xs z-50 flex flex-col gap-3 select-none thin-scrollbar font-sans"
      >
        {/* 1. Display Properties (Columns) */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setColumnsOpen(!columnsOpen)}
            className="flex w-full items-center justify-between py-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
          >
            <span>Display properties</span>
            {columnsOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {columnsOpen && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 select-none">
              <span className="px-2 py-1 rounded-md text-11 font-medium bg-muted text-muted-foreground border border-transparent cursor-not-allowed select-none">
                Title (required)
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
              className="p-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "size-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
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
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-12 font-medium text-foreground">Density</span>
          </div>
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-md border border-border">
            <button
              type="button"
              onClick={() => handleDensityChange('comfortable')}
              className={cn(
                "py-1 text-11 font-medium rounded transition-colors text-center cursor-pointer",
                density === 'comfortable'
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => handleDensityChange('compact')}
              className={cn(
                "py-1 text-11 font-medium rounded transition-colors text-center cursor-pointer",
                density === 'compact'
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Compact
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default LibraryDisplayPopover;
