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

  const getAriaSort = (key: string): React.AriaAttributes['aria-sort'] => {
    if (sortColumn !== key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <thead className="sticky top-0 z-10 bg-background select-none">
      <tr className="h-8 text-foreground font-medium text-12">
        {/* Title (Primary Column: Checkbox + Title) */}
        <th
          scope="col"
          className="px-3 h-8 py-0 align-middle font-medium select-none text-left bg-background border-b border-border"
        >
          <div className="flex items-center gap-2 w-full">
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAll();
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectAll();
                }
              }}
              title={isAllSelected ? 'Deselect all' : 'Select all'}
              aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
              className="flex items-center justify-center shrink-0 cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Checkbox
                checked={isAllSelected}
                tabIndex={-1}
                aria-hidden="true"
                className="size-3.5 border-border data-[state=checked]:border-primary pointer-events-none"
              />
            </div>
            <button
              type="button"
              onClick={() => onSort('title')}
              aria-sort={getAriaSort('title')}
              className="flex items-center gap-1.5 cursor-pointer min-w-0 text-foreground text-12 font-medium bg-transparent border-0 p-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-xs"
            >
              <span>Title</span>
              {renderSortIndicator('title')}
            </button>
          </div>
        </th>

        {/* Authors */}
        {columns.authors !== false && (
          <th
            scope="col"
            aria-sort={getAriaSort('authors')}
            onClick={() => onSort('authors')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('authors');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
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
            scope="col"
            aria-sort={getAriaSort('year')}
            onClick={() => onSort('year')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('year');
              }
            }}
            tabIndex={0}
            className="px-2 h-8 py-0 align-middle text-center font-medium cursor-pointer text-foreground select-none bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
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
            scope="col"
            aria-sort={getAriaSort('publicationTitle')}
            onClick={() => onSort('publicationTitle')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('publicationTitle');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center gap-1.5">
              <span>Publication</span>
              {renderSortIndicator('publicationTitle')}
            </div>
          </th>
        )}

        {/* Item Type */}
        {columns.itemType && (
          <th scope="col" className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            Type
          </th>
        )}

        {/* DOI */}
        {columns.doi && (
          <th scope="col" className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            DOI
          </th>
        )}

        {/* Citation Key */}
        {columns.citationKey && (
          <th
            scope="col"
            aria-sort={getAriaSort('citationKey')}
            onClick={() => onSort('citationKey')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('citationKey');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center gap-1.5">
              <span>Citation Key</span>
              {renderSortIndicator('citationKey')}
            </div>
          </th>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <th
            scope="col"
            aria-sort={getAriaSort('citationCount')}
            onClick={() => onSort('citationCount')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('citationCount');
              }
            }}
            tabIndex={0}
            className="px-2 h-8 py-0 align-middle text-center font-medium cursor-pointer text-foreground select-none bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center justify-center gap-1.5">
              <span>Citations</span>
              {renderSortIndicator('citationCount')}
            </div>
          </th>
        )}

        {/* Trash deletedAt column */}
        {isTrash && (
          <th scope="col" className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            Date Deleted
          </th>
        )}
      </tr>
    </thead>
  );
}

export default ItemTableHeader;
