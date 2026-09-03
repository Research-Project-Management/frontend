'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import type { SortField, SortOrder } from '@/features/workspaces/library/hooks/library/use-items';

interface PaperTableHeaderProps {
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isAllSelected: boolean;
  isPartiallySelected?: boolean;
  onToggleSelectAll: () => void;
  showCollection?: boolean;
  showLastRead?: boolean;
}

interface ColumnDef {
  field: SortField | null;
  label: string;
  className?: string;
  sortable?: boolean;
}

export default function ItemTableHeader({
  sortField,
  sortOrder,
  onSort,
  isAllSelected,
  isPartiallySelected,
  onToggleSelectAll,
  showCollection = true,
  showLastRead = false,
}: PaperTableHeaderProps) {
  const columns: ColumnDef[] = [
    { field: 'title', label: 'Title', sortable: true, className: 'text-left min-w-[240px] flex-1' },
    { field: 'authors', label: 'Creator', sortable: true, className: 'text-left w-[240px] max-w-[320px]' },
    ...(showLastRead
      ? ([
          {
            field: 'lastReadAt',
            label: 'Last Read',
            sortable: true,
            className: 'text-left w-[200px] max-w-[240px]',
          },
        ] as ColumnDef[])
      : []),
  ];

  return (
    <thead className="sticky top-0 z-20 bg-background select-none font-sans">
      <tr className="h-9 text-xs font-medium text-foreground border-b border-border/60">
        {/* Select All Checkbox */}
        <th className="w-10 px-2.5 py-1.5 text-center align-middle">
          <div className="flex items-center justify-center">
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                    onCheckedChange={onToggleSelectAll}
                    aria-label="Select all items"
                    className="size-3.5 rounded-md border-border cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6} className="text-[11px] font-normal px-2 py-0.5 rounded-md shadow-sm border border-border/80 bg-popover text-foreground">
                {isAllSelected ? 'Deselect all items' : 'Select all items'}
              </TooltipContent>
            </Tooltip>
          </div>
        </th>

        {/* Dynamic Column Headers */}
        {columns.map((col, idx) => {
          const isSorted = col.field && sortField === col.field;
          const sortTooltipText = col.sortable && col.field
            ? isSorted
              ? sortOrder === 'asc'
                ? `Sorted ascending (${col.label})`
                : `Sorted descending (${col.label})`
              : `Sort by ${col.label}`
            : undefined;

          const headerContent = (
            <div className="inline-flex items-center gap-1.5 group/col">
              <span
                className={cn(
                  'truncate rounded-md px-1.5 py-0.5 -mx-1.5 text-foreground font-medium',
                  col.sortable && 'hover:bg-black/5 dark:hover:bg-white/5'
                )}
              >
                {col.label}
              </span>
              {col.sortable && isSorted && (
                <span className="shrink-0 text-foreground">
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="size-3.5 text-foreground" />
                  ) : (
                    <ArrowDown className="size-3.5 text-foreground" />
                  )}
                </span>
              )}
            </div>
          );

          return (
            <th
              key={idx}
              role="columnheader"
              aria-sort={col.sortable && col.field ? (isSorted ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
              className={cn(
                'px-3 py-2 text-xs font-medium select-none text-foreground',
                col.className,
                col.sortable ? 'cursor-pointer' : ''
              )}
              onClick={() => col.field && col.sortable && onSort(col.field)}
            >
              {sortTooltipText ? (
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    {headerContent}
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6} className="text-[11px] font-normal px-2 py-0.5 rounded-md shadow-sm border border-border/80 bg-popover text-foreground">
                    {sortTooltipText}
                  </TooltipContent>
                </Tooltip>
              ) : (
                headerContent
              )}
            </th>
          );
        })}

        {/* Action column space */}
        <th className="w-10 px-2 py-2" />
      </tr>
    </thead>
  );
}


