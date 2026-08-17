'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { SortField, SortOrder } from '../../../hooks/library/use-paper';

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
    { field: 'title', label: 'Title', sortable: true, className: 'text-left min-w-[200px] max-w-[400px]' },
    { field: 'authors', label: 'Creator / Authors', sortable: true, className: 'text-left w-[220px] max-w-[220px]' },
    { field: 'year', label: 'Year', sortable: true, className: 'text-left w-[70px] max-w-[70px]' },
    { field: 'journal', label: 'Publication / Venue', sortable: true, className: 'text-left w-[180px] max-w-[180px]' },
    ...(showCollection ? [{ field: null, label: 'Collection', sortable: false, className: 'text-left w-[130px] max-w-[130px]' }] : []),
    { field: 'createdAt', label: 'Date Added', sortable: true, className: 'text-left w-[110px] max-w-[110px]' },
  ];

  return (
    <thead className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60 select-none">
      <tr className="h-10 text-xs font-semibold text-muted-foreground">
        {/* Select All Checkbox & Attachment Indicator header */}
        <th className="w-12 px-3 py-2 text-center align-middle">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
              onCheckedChange={onToggleSelectAll}
              aria-label="Select all papers"
              className="size-4 rounded border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        </th>

        {/* Attachment icon column header */}
        <th className="w-8 px-1 py-2 text-center align-middle" title="Attachment" />

        {/* Dynamic Column Headers */}
        {columns.map((col, idx) => {
          const isSorted = col.field && sortField === col.field;
          return (
            <th
              key={idx}
              className={cn(
                'px-3 py-2 text-xs font-medium text-muted-foreground tracking-tight',
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
