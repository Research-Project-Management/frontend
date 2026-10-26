'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

export type QuickSearchMode = 'title_creator_year' | 'fields_tags' | 'everything';

const SEARCH_MODES: Array<{ id: QuickSearchMode; label: string; shortLabel: string }> = [
  { id: 'title_creator_year', label: 'Title, Creator, Year', shortLabel: 'Title/Creator' },
  { id: 'fields_tags', label: 'All Fields & Tags', shortLabel: 'Fields & Tags' },
  { id: 'everything', label: 'Everything (Full Text & Notes)', shortLabel: 'Everything' },
];

export interface TopbarSearchProps {
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

export default TopbarSearch;
