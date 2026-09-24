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
    <thead className="sticky top-0 z-10 bg-background select-none">
      <tr className="h-[34px] text-foreground font-medium text-12">
        {/* Title (Primary Column: Checkbox + Title) */}
        <th className="px-3 h-[34px] py-0 align-middle font-medium select-none text-left bg-background border-b border-border">
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
              className="flex items-center gap-1.5 cursor-pointer min-w-0 text-foreground"
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
            className="px-3 h-[34px] py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border"
          >
            <div className="flex items-center gap-1.5">
              <span>Authors</span>
              {renderSortIndicator('authors')}
            </div>
          </th>
        )}

        {/* Year */}
        {columns.year !== false && (
          <th
            onClick={() => onSort('year')}
            className="px-2 h-[34px] py-0 align-middle text-center font-medium cursor-pointer text-foreground select-none bg-background border-b border-border"
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Year</span>
              {renderSortIndicator('year')}
            </div>
          </th>
        )}

        {/* Publication Venue */}
        {columns.publication !== false && (
          <th
            onClick={() => onSort('publicationTitle')}
            className="px-3 h-[34px] py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border"
          >
            <div className="flex items-center gap-1.5">
              <span>Publication</span>
              {renderSortIndicator('publicationTitle')}
            </div>
          </th>
        )}

        {/* Item Type */}
        {columns.itemType && (
          <th className="px-3 h-[34px] py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            Type
          </th>
        )}

        {/* DOI */}
        {columns.doi && (
          <th className="px-3 h-[34px] py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            DOI
          </th>
        )}

        {/* Citation Key */}
        {columns.citationKey && (
          <th className="px-3 h-[34px] py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            Citation Key
          </th>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <th
            onClick={() => onSort('citationCount')}
            className="px-2 h-[34px] py-0 align-middle text-center font-medium cursor-pointer text-foreground select-none bg-background border-b border-border"
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Citations</span>
              {renderSortIndicator('citationCount')}
            </div>
          </th>
        )}

        {/* Trash deletedAt column */}
        {isTrash && (
          <th className="px-3 h-[34px] py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            Date Deleted
          </th>
        )}
      </tr>
    </thead>
  );
}

export default ItemTableHeader;
