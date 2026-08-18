'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { SortField, SortOrder } from '../../hooks/library/use-paper';

interface PaperTableHeaderProps {
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isAllSelected: boolean;
  isPartiallySelected?: boolean;
  onToggleSelectAll: () => void;
  showCollection?: boolean;
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
}: PaperTableHeaderProps) {
  const columns: ColumnDef[] = [
    { field: 'title', label: 'Title', sortable: true, className: 'text-left min-w-[240px] flex-1' },
    { field: 'authors', label: 'Creator / Authors', sortable: true, className: 'text-left w-[200px] max-w-[240px]' },
    { field: 'year', label: 'Year', sortable: true, className: 'text-left w-[72px]' },
    { field: 'journal', label: 'Publication / Venue', sortable: true, className: 'text-left w-[180px] max-w-[220px]' },
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
                'px-3 py-2 text-xs font-medium text-muted-foreground tracking-normal',
                col.className,
                col.sortable && 'cursor-pointer hover:text-foreground transition-colors'
              )}
              onClick={() => col.field && col.sortable && onSort(col.field)}
            >
              <div className="flex items-center gap-1.5 group">
                <span className="truncate">{col.label}</span>
                {col.sortable && (
                  <span className="shrink-0 text-muted-foreground/40 group-hover:text-foreground transition-colors">
                    {isSorted ? (
                      sortOrder === 'asc' ? (
                        <ArrowUp className="size-3 text-primary" />
                      ) : (
                        <ArrowDown className="size-3 text-primary" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                )}
              </div>
            </th>
          );
        })}

        {/* Action column space */}
        <th className="w-16 px-2 py-2" />
      </tr>
    </thead>
  );
}
