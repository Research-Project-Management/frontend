'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';

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
      } else {
        params.delete('q');
      }
      const newQuery = params.toString();
      router.replace(newQuery ? `${pathname}?${newQuery}` : pathname);
    }, 300);

    return () => clearTimeout(timer);
  }, [internalValue, urlSearch, pathname, router, searchParams, isControlled]);

  const active = isExpanded || Boolean(effectiveValue);

  const expand = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setTimeout(() => inputRef.current?.focus(), 50);
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

  return (
    <div
      role="search"
      tabIndex={active ? -1 : 0}
      aria-label={placeholder}
      className={cn(
        'relative flex items-center transition-colors duration-150 h-8 rounded-md overflow-hidden group focus-visible:ring-1 focus-visible:ring-ring select-none',
        active
          ? 'w-40 sm:w-52 border border-border bg-white dark:bg-card shadow-2xs hover:border-foreground/30'
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
        strokeWidth={1.5}
        className={cn(
          'absolute top-1/2 -translate-y-1/2 size-3.5 transition-colors duration-150 z-10 shrink-0 text-foreground',
          active
            ? 'left-2 translate-x-0'
            : 'left-1/2 -translate-x-1/2'
        )}
      />
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
          'h-full text-12 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground placeholder:font-normal transition-opacity duration-200 pl-7 pr-6 text-foreground',
          active ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      />
      {active && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleClear}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer p-0.5 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Clear search"
        >
          <X className="size-3 shrink-0" />
        </button>
      )}
    </div>
  );
}

export default TopbarSearch;
