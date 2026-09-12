'use client';

import React, { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

export interface CollapsibleSearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (val: string) => void;
  ariaLabel?: string;
  className?: string;
}

export function CollapsibleSearchInput({
  placeholder = 'Search...',
  value = '',
  onChange,
  ariaLabel = 'Search',
  className,
}: CollapsibleSearchInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = isExpanded || Boolean(value);

  return (
    <div
      role="search"
      tabIndex={active ? -1 : 0}
      aria-label={ariaLabel}
      className={cn(
        'relative flex items-center transition-colors duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'w-48 sm:w-64 border border-border bg-background'
          : 'w-8 hover:bg-muted cursor-pointer',
        className,
      )}
      onClick={() => {
        if (!isExpanded) {
          setIsExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
      onKeyDown={(e) => {
        if (!isExpanded && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          setIsExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
    >
      <Search
        className={cn(
          'absolute top-1/2 -translate-y-1/2 size-3.5 transition-colors duration-300 z-10 text-foreground shrink-0',
          active ? 'left-2.5 translate-x-0' : 'left-1/2 -translate-x-1/2',
        )}
      />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={() => !value && setIsExpanded(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsExpanded(false);
            onChange?.('');
          }
        }}
        className={cn(
          'h-full border-none shadow-none pl-8 pr-3 text-xs bg-transparent focus-visible:ring-0 transition-opacity duration-200',
          active ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />
    </div>
  );
}

export default CollapsibleSearchInput;
