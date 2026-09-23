'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui';

export interface ItemTableHeaderProps {
  columns: Record<string, boolean>;
  isTrash?: boolean;
  isAllSelected: boolean;
  onSelectAll: () => void;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (columnKey: string) => void;
}

export function ItemTableHeader({
  columns,
  isTrash = false,
  isAllSelected,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
}: ItemTableHeaderProps) {
  const renderSortIndicator = (key: string) => {
    if (sortColumn !== key) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp className="size-3 text-foreground ml-1 shrink-0" strokeWidth={1.5} />
    ) : (
      <ArrowDown className="size-3 text-foreground ml-1 shrink-0" strokeWidth={1.5} />
    );
  };

  return (
    <thead className="sticky top-0 z-10 bg-background/95 border-b border-border backdrop-blur-xs select-none">
      <tr className="h-8 text-foreground font-medium text-12">
        {/* Title (Primary Column: Checkbox + Title) */}
        <th className="w-auto px-3 font-medium select-none">
          <div className="flex items-center gap-2 w-full">
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelectAll();
              }}
              title={isAllSelected ? 'Deselect all' : 'Select all'}
              className="flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Checkbox
                checked={isAllSelected}
                tabIndex={-1}
                aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
                className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none"
              />
            </div>
            <div
              onClick={() => onSort('title')}
              className="flex items-center gap-1 cursor-pointer min-w-0 text-foreground"
            >
              <span>Title</span>
              {renderSortIndicator('title')}
            </div>
          </div>
        </th>

        {/* Authors */}
        {columns.authors !== false && (
          <th
            onClick={() => onSort('authors')}
            className="w-48 min-w-[160px] px-3 font-medium cursor-pointer text-foreground select-none"
          >
            <div className="flex items-center gap-1">
              <span>Authors</span>
              {renderSortIndicator('authors')}
            </div>
          </th>
        )}

        {/* Year */}
        {columns.year !== false && (
          <th
            onClick={() => onSort('year')}
            className="w-16 min-w-[64px] px-2 text-center font-medium cursor-pointer text-foreground select-none"
          >
            <div className="flex items-center justify-center gap-1">
              <span>Year</span>
              {renderSortIndicator('year')}
            </div>
          </th>
        )}

        {/* Publication Venue */}
        {columns.publication !== false && (
          <th
            onClick={() => onSort('publicationTitle')}
            className="w-44 min-w-[140px] px-3 font-medium cursor-pointer text-foreground select-none"
          >
            <div className="flex items-center gap-1">
              <span>Publication</span>
              {renderSortIndicator('publicationTitle')}
            </div>
          </th>
        )}

        {/* Item Type */}
        {columns.itemType && (
          <th className="w-28 min-w-[100px] px-3 font-medium text-foreground">
            Type
          </th>
        )}

        {/* DOI */}
        {columns.doi && (
          <th className="w-32 min-w-[120px] px-3 font-medium text-foreground">
            DOI
          </th>
        )}

        {/* Citation Key */}
        {columns.citationKey && (
          <th className="w-32 min-w-[110px] px-3 font-medium text-foreground">
            Citation Key
          </th>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <th
            onClick={() => onSort('citationCount')}
            className="w-20 min-w-[70px] px-2 text-center font-medium cursor-pointer text-foreground select-none"
          >
            <div className="flex items-center justify-center gap-1">
              <span>Citations</span>
              {renderSortIndicator('citationCount')}
            </div>
          </th>
        )}

        {/* Trash deletedAt column */}
        {isTrash && (
          <th className="w-32 min-w-[110px] px-3 font-medium text-foreground">
            Date Deleted
          </th>
        )}
      </tr>
    </thead>
  );
}

export default ItemTableHeader;
