'use client';

import React, { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import type { Item } from '../../types/work-item.types';

export function ParentHierarchyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-3.5 shrink-0 text-foreground', className)}
    >
      <rect x="2" y="2.5" width="12" height="4" rx="1" />
      <rect x="9.5" y="9.5" width="4.5" height="4" rx="1" />
      <path d="M4.5 6.5v4a1 1 0 0 0 1 1h2.5" />
      <path d="M6.5 10l1.5 1.5-1.5 1.5" />
    </svg>
  );
}

export const AddParentIcon = ParentHierarchyIcon;

import type { ParentItemPopoverProps } from '../../types/picker.types';

export type { ParentItemPopoverProps };

export const ParentItemPopover: React.FC<ParentItemPopoverProps> = ({
  open,
  onOpenChange,
  parentId: propParentId,
  setParentId: propSetParentId,
  currentParentId,
  onSelectParent,
  items: propItems,
  availableItems,
  actionBtnClass,
  isReadOnly = false,
}) => {
  const parentId = propParentId !== undefined ? propParentId : currentParentId;
  const setParentId = propSetParentId || onSelectParent || (() => {});
  const items = propItems || availableItems || [];
  const [query, setQuery] = useState('');

  const selectedParent = useMemo(() => {
    if (!parentId) return null;
    return items.find((item) => item.id === parentId) || null;
  }, [parentId, items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items
      .filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const identMatch = item.identifier?.toLowerCase().includes(q);
        return Boolean(titleMatch || identMatch);
      })
      .slice(0, 30);
  }, [items, query]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
            actionBtnClass,
            open && 'bg-muted border-border',
            selectedParent && 'font-medium'
          )}
        >
          <ParentHierarchyIcon />
          <span className="truncate max-w-[120px]">
            {selectedParent ? selectedParent.identifier || selectedParent.title : 'Add parent'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-64 p-1.5 rounded-md border border-border bg-popover shadow-overlay z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work items..."
            aria-label="Search work items"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {parentId && (
            <button
              type="button"
              onClick={() => {
                setParentId(null);
                onOpenChange(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left text-foreground"
            >
              <span>Remove parent</span>
            </button>
          )}
          {filteredItems.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No work items found
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = parentId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setParentId(isSelected ? null : item.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left gap-2',
                    isSelected && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    {item.identifier && (
                      <span className="text-10 font-mono text-foreground shrink-0">
                        {item.identifier}
                      </span>
                    )}
                    <span className="truncate text-foreground">{item.title}</span>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const ParentPicker = ParentItemPopover;
