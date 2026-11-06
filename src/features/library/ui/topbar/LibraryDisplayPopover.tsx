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
} from '@/features/library/domain/types/ingestion.types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
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
  const [densityOpen, setDensityOpen] = useState(true);

  const { columns, orderBy, orderDirection, density = "comfortable" } = options;

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

  const handleDensityChange = (d: "comfortable" | "compact") => {
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

        <div className="-mx-2 border-t border-border my-0.5" />

        {/* 3. Density */}
        <div>
          <button
            type="button"
            onClick={() => setDensityOpen(!densityOpen)}
            className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground cursor-pointer select-none"
          >
            <span>Density</span>
            {densityOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
            )}
          </button>

          {densityOpen && (
            <div className="space-y-0.5 pt-0.5 select-none">
              {[
                { value: "comfortable" as const, label: "Comfortable" },
                { value: "compact" as const, label: "Compact" },
              ].map((item) => {
                const isSelected = density === item.value;
                return (
                  <label
                    key={item.value}
                    className={cn(
                      "flex w-full items-center gap-2 py-1 px-1.5 rounded-md text-12 text-foreground transition-colors cursor-pointer select-none hover:bg-muted",
                      isSelected ? "font-medium" : "font-normal",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleDensityChange(item.value)}
                      className="size-3.5 border-border data-[state=checked]:border-primary cursor-pointer shrink-0"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="-mx-2 border-t border-border my-0.5" />

        {/* 4. Subcollection Items */}
        <div className="pt-0.5">
          <label className="flex w-full items-center justify-between py-1 px-1.5 rounded-md text-12 text-foreground transition-colors cursor-pointer select-none hover:bg-muted font-medium">
            <span>Show items from subcollections</span>
            <Checkbox
              checked={options.includeSubcollections ?? true}
              onCheckedChange={(checked) =>
                onOptionsChange({
                  ...options,
                  includeSubcollections: Boolean(checked),
                })
              }
              className="size-3.5 border-border data-[state=checked]:border-primary cursor-pointer shrink-0"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default LibraryDisplayPopover;

type QuickSearchMode = 'title_creator_year' | 'fields_tags' | 'everything';

const SEARCH_MODES: Array<{ id: QuickSearchMode; label: string; shortLabel: string }> = [
  { id: 'title_creator_year', label: 'Title, Creator, Year', shortLabel: 'Title/Creator' },
  { id: 'fields_tags', label: 'All Fields & Tags', shortLabel: 'Fields & Tags' },
  { id: 'everything', label: 'Everything (Full Text & Notes)', shortLabel: 'Everything' },
];

interface TopbarSearchProps {
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (val: string) => void;
  onClear?: () => void;
}

export function TopbarSearch({
  placeholder = 'Search references...',
  className,
  value: propValue,
  onChange: propOnChange,
  onClear: propOnClear,
}: TopbarSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isControlled = propOnChange !== undefined;
  const urlSearch = searchParams.get('q') || '';
  const rawMode = searchParams.get('searchMode');
  const currentSearchMode: QuickSearchMode =
    rawMode === 'title_creator_year' || rawMode === 'everything' || rawMode === 'fields_tags'
      ? rawMode
      : 'fields_tags';

  const [internalValue, setInternalValue] = useState(urlSearch);

  const effectiveValue = isControlled ? (propValue || '') : internalValue;
  const [isExpanded, setIsExpanded] = useState(Boolean(effectiveValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isControlled) {
      setInternalValue(urlSearch);
      if (urlSearch) {
        setIsExpanded(true);
      }
    } else if (propValue) {
      setIsExpanded(true);
    }
  }, [urlSearch, isControlled, propValue]);

  // Debounced URL sync (uncontrolled mode only)
  useEffect(() => {
    if (isControlled) return;

    const timer = setTimeout(() => {
      if (internalValue === urlSearch) return;

      const params = new URLSearchParams(searchParams.toString());
      if (internalValue.trim()) {
        params.set('q', internalValue.trim());
        params.delete('page');
      } else {
        params.delete('q');
        if (params.get('orderBy') === 'relevance') {
          params.delete('orderBy');
          params.delete('orderDirection');
        }
      }
      const newQuery = params.toString();
      router.replace(newQuery ? `${pathname}?${newQuery}` : pathname);
    }, 300);

    return () => clearTimeout(timer);
  }, [internalValue, urlSearch, pathname, router, searchParams, isControlled]);

  const active = isExpanded || Boolean(effectiveValue);

  useEffect(() => {
    if (isExpanded) {
      const timerId = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timerId);
    }
  }, [isExpanded]);

  const expand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
    }
  };

  const collapse = () => {
    if (!effectiveValue) {
      setIsExpanded(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isControlled) {
      propOnClear?.();
      propOnChange?.('');
    } else {
      setInternalValue('');
    }
    setIsExpanded(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isControlled) {
      propOnChange?.(val);
    } else {
      setInternalValue(val);
    }
  };

  const handleSelectSearchMode = (mode: QuickSearchMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === 'fields_tags') {
      params.delete('searchMode');
    } else {
      params.set('searchMode', mode);
    }
    params.delete('page');
    const newQuery = params.toString();
    router.replace(newQuery ? `${pathname}?${newQuery}` : pathname);
  };

  const activeModeLabel =
    SEARCH_MODES.find((m) => m.id === currentSearchMode)?.label || 'All Fields & Tags';

  return (
    <div
      role="search"
      tabIndex={active ? -1 : 0}
      aria-label={placeholder}
      className={cn(
        'relative flex items-center transition-colors duration-150 h-8 rounded-md overflow-hidden group focus-visible:ring-1 focus-visible:ring-ring select-none',
        active
          ? 'w-48 sm:w-60 border border-border bg-background hover:border-border-hover'
          : 'w-8 hover:bg-muted cursor-pointer',
        className,
      )}
      onClick={expand}
      onKeyDown={(e) => {
        if (!isExpanded && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          expand();
        }
      }}
    >
      {active ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => e.stopPropagation()}
              title={`Search mode: ${activeModeLabel}`}
              aria-label={`Search mode: ${activeModeLabel}`}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 h-6 px-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
            >
              <Search strokeWidth={1.5} className="size-3.5 shrink-0 text-foreground" />
              <ChevronDown strokeWidth={1.5} className="size-2.5 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="w-56 p-1 text-12 z-50"
          >
            {SEARCH_MODES.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSearchMode(m.id);
                }}
                className="flex items-center justify-between gap-2 text-12 cursor-pointer"
              >
                <span>{m.label}</span>
                {currentSearchMode === m.id && (
                  <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Search
          strokeWidth={1.5}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-3.5 text-muted-foreground group-hover:text-foreground transition-colors duration-150 z-10 shrink-0"
        />
      )}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        aria-label={placeholder}
        value={effectiveValue}
        onChange={handleChange}
        onBlur={collapse}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (isControlled) {
              propOnClear?.();
              propOnChange?.('');
            } else {
              setInternalValue('');
            }
            setIsExpanded(false);
          }
        }}
        className={cn(
          'h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground placeholder:font-normal transition-opacity duration-200 pl-8 pr-6 text-foreground',
          active ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
      {active && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 text-foreground hover:opacity-80 hover:bg-muted transition-colors cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-2 md:before:hidden"
          aria-label="Clear search"
        >
          <X className="size-3 shrink-0 text-foreground" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
