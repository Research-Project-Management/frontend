'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';
import type { SortField, SortOrder } from '../../hooks/library/use-papers';

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

export default function PaperTableHeader({
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
    <thead className="sticky top-0 z-20 bg-background select-none">
      <tr className="h-9 text-xs font-medium text-muted-foreground border-b border-border/40">
        {/* Select All Checkbox */}
        <th className="w-10 px-2.5 py-1.5 text-center align-middle">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
              onCheckedChange={onToggleSelectAll}
              aria-label="Select all papers"
              className="size-3.5 rounded border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        </th>

        {/* Dynamic Column Headers */}
        {columns.map((col, idx) => {
          const isSorted = col.field && sortField === col.field;
          return (
            <th
              key={idx}
              className={cn(
                'px-3 py-2 text-xs font-medium select-none',
                col.className,
                col.sortable ? 'cursor-pointer text-muted-foreground' : 'text-muted-foreground'
              )}
              onClick={() => col.field && col.sortable && onSort(col.field)}
            >
              <div className="inline-flex items-center gap-1.5 group/col">
                <span
                  className={cn(
                    'truncate transition-colors rounded px-1.5 py-0.5 -mx-1.5',
                    col.sortable && 'hover:text-foreground hover:bg-muted/60',
                    isSorted && 'text-foreground font-semibold'
                  )}
                >
                  {col.label}
                </span>
                {col.sortable && isSorted && (
                  <span className="shrink-0 text-foreground">
                    {sortOrder === 'asc' ? (
                      <ArrowUp className="size-3.5" />
                    ) : (
                      <ArrowDown className="size-3.5" />
                    )}
                  </span>
                )}
              </div>
            </th>
          );
        })}

        {/* Action column space */}
        <th className="w-10 px-2 py-2" />
      </tr>
    </thead>
  );
}
