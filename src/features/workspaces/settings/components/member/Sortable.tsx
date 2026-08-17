'use client';

import React from 'react';
import { ArrowDownAZ, ArrowUpZA, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { SortField, SortDirection } from '../../hooks/use-member';

export interface SortableProps {
  label: string;
  field: SortField;
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: SortField, dir: SortDirection) => void;
  ascLabel?: string;
  descLabel?: string;
}

export function Sortable({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  ascLabel = 'A → Z',
  descLabel = 'Z → A',
}: SortableProps) {
  const active = sortField === field;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer outline-none group"
        >
          <span className={cn('transition-colors', active ? 'text-foreground font-semibold' : '')}>
            {label}
          </span>
          <ChevronDown
            className={cn(
              'size-3 shrink-0 transition-all',
              active ? 'text-foreground opacity-100' : 'text-muted-foreground/50 group-hover:opacity-100 opacity-60',
              active && sortDirection === 'asc' && 'rotate-180',
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44 p-1 text-xs shadow-lg">
        <DropdownMenuItem
          onClick={() => onSort(field, 'asc')}
          className={cn(
            'flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 text-xs',
            active && sortDirection === 'asc' && 'bg-accent font-medium',
          )}
        >
          <ArrowDownAZ className="size-3.5 text-muted-foreground shrink-0" />
          <span>{ascLabel}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSort(field, 'desc')}
          className={cn(
            'flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 text-xs',
            active && sortDirection === 'desc' && 'bg-accent font-medium',
          )}
        >
          <ArrowUpZA className="size-3.5 text-muted-foreground shrink-0" />
          <span>{descLabel}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { Sortable as SortableHeader };
export default Sortable;
