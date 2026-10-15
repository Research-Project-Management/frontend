'use client';

import React, { useState, useMemo } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  type TablePropertyKey,
  type TableColumnPropertiesPopoverProps,
  TABLE_PROPERTIES,
} from '@/features/projects/project-id/work-items/types/table-view.types';

export type { TableColumnPropertiesPopoverProps };

export function TableColumnPropertiesPopover({
  visibleProperties,
  onToggleProperty,
  compact = false,
}: TableColumnPropertiesPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return TABLE_PROPERTIES;
    return TABLE_PROPERTIES.filter((p) => p.label.toLowerCase().includes(q));
  }, [searchQuery]);

  const activeCount = useMemo(
    () => Object.values(visibleProperties).filter(Boolean).length,
    [visibleProperties]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Display properties"
            title="Display properties"
            className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer select-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-3.5 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted border border-border bg-background transition-colors cursor-pointer select-none relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-3.5 shrink-0" />
            <span>Display</span>
            <span className="rounded-md bg-muted px-1.5 py-0.2 text-10 font-mono font-medium text-foreground tabular-nums">
              {activeCount}
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 border-border bg-popover shadow-overlay z-100 rounded-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border px-1">
          <span className="text-xs font-semibold text-foreground">Display properties</span>
        </div>

        <div className="relative mb-2 px-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search properties..."
            className="h-7 pl-7 text-xs bg-background border-border placeholder:text-muted-foreground text-foreground rounded-md focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5 px-1 py-0.5">
          {filteredProperties.map((p) => {
            const Icon = p.icon;
            const isChecked = Boolean(visibleProperties[p.key]);

            return (
              <label
                key={p.key}
                className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-muted transition-colors text-foreground select-none"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 text-foreground shrink-0" />
                  <span>{p.label}</span>
                </div>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleProperty(p.key)}
                  className="size-3.5 rounded-sm"
                />
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
