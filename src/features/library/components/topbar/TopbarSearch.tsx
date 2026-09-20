'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

export interface TopbarSearchProps {
  placeholder?: string;
  className?: string;
}

export function TopbarSearch({
  placeholder = 'Search references...',
  className,
}: TopbarSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get('q') || '';
  const [value, setValue] = useState(currentSearch);
  const [isExpanded, setIsExpanded] = useState(Boolean(currentSearch));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(currentSearch);
    if (currentSearch) {
      setIsExpanded(true);
    }
  }, [currentSearch]);

  // Debounced URL sync
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value === currentSearch) return;

      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      } else {
        params.delete('q');
      }
      const newQuery = params.toString();
      router.replace(newQuery ? `${pathname}?${newQuery}` : pathname);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, currentSearch, pathname, router, searchParams]);

  const active = isExpanded || Boolean(value);

  const expand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const collapse = () => {
    if (!value) {
      setIsExpanded(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue('');
    setIsExpanded(false);
  };

  return (
    <div
      role="search"
      tabIndex={active ? -1 : 0}
      aria-label={placeholder}
      className={cn(
        'relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-1 focus-visible:ring-ring select-none',
        active
          ? 'w-48 sm:w-64 border border-border bg-background'
          : 'w-8 hover:bg-muted cursor-pointer',
        className
      )}
      onClick={expand}
      onKeyDown={(e) => {
        if (!isExpanded && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          expand();
        }
      }}
    >
      <Search
        className={cn(
          'absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 shrink-0',
          active
            ? 'left-2.5 translate-x-0 text-muted-foreground'
            : 'left-1/2 -translate-x-1/2 text-muted-foreground'
        )}
      />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={collapse}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setValue('');
            setIsExpanded(false);
          }
        }}
        className={cn(
          'h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/60 placeholder:font-normal transition-opacity duration-200 pl-8 pr-7 text-foreground',
          active ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />
      {active && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer p-0.5 rounded-md"
          aria-label="Clear search"
        >
          <X className="size-3.5 shrink-0" />
        </button>
      )}
    </div>
  );
}

export default TopbarSearch;
