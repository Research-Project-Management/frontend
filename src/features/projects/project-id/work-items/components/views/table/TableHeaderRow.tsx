'use client';

import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  type TablePropertyKey,
  type TableSortField,
  type TableSortOrder,
  TABLE_PROPERTIES,
  DEFAULT_COLUMN_WIDTHS,
} from '../../../types/table-view.types';
import { TableColumnPropertiesPopover } from './TableColumnPropertiesPopover';

export interface TableHeaderRowProps {
  visibleProperties: Record<TablePropertyKey, boolean>;
  columnWidths?: Record<string, number>;
  onResizeColumn?: (key: string, width: number) => void;
  onToggleProperty?: (key: TablePropertyKey) => void;
  onResetProperties?: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  sortField?: TableSortField;
  sortOrder?: TableSortOrder;
  onSort?: (field: TableSortField) => void;
}

export function TableHeaderRow({
  visibleProperties,
  columnWidths,
  onResizeColumn,
  onToggleProperty,
  onResetProperties,
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
  sortField,
  sortOrder,
  onSort,
}: TableHeaderRowProps) {
  const activeProperties = useMemo(
    () => TABLE_PROPERTIES.filter((p) => visibleProperties[p.key]),
    [visibleProperties]
  );

  const renderSortIndicator = (field: TableSortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 text-foreground ml-1 shrink-0" />
    ) : (
      <ArrowDown className="size-3 text-foreground ml-1 shrink-0" />
    );
  };

  const titleWidth = columnWidths?.title || DEFAULT_COLUMN_WIDTHS.title;

  return (
    <div
      role="row"
      className="sticky top-0 z-20 flex items-center h-9 border-b border-border bg-background text-11 font-medium text-muted-foreground select-none w-full"
    >
      {/* 1. First Column: Work items Title (Frozen / Sticky Left) */}
      <div
        role="columnheader"
        style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px`, left: 0 }}
        className="sticky left-0 z-30 flex items-center px-2.5 h-full border-r border-border shrink-0 group/header bg-background"
      >
        <div className="flex items-center w-full">
          <span
            onClick={() => onSort?.('title')}
            className="flex items-center gap-1.5 text-11 font-medium text-foreground cursor-pointer hover:text-foreground transition-colors truncate"
          >
            <span>Work items</span>
            {renderSortIndicator('title')}
          </span>
        </div>
      </div>

      {/* 2. Dynamic Property Headers */}
      <div className="flex items-center h-full">
        {activeProperties.map((p) => {
          const Icon = p.icon;
          const isSortable = [
            'state',
            'priority',
            'dueDate',
            'startDate',
            'createdOn',
            'updatedOn',
          ].includes(p.key);
          const propWidth = columnWidths?.[p.key] || DEFAULT_COLUMN_WIDTHS[p.key] || p.minWidth || 144;

          return (
            <div
              key={p.key}
              role="columnheader"
              tabIndex={isSortable ? 0 : undefined}
              aria-sort={
                sortField === p.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined
              }
              aria-label={isSortable ? `Sort by ${p.label}` : p.label}
              onKeyDown={(e) => {
                if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSort?.(p.key as TableSortField);
                }
              }}
              style={{ width: `${propWidth}px`, minWidth: `${propWidth}px` }}
              onClick={() => isSortable && onSort?.(p.key as TableSortField)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 h-full text-xs font-medium text-foreground select-none transition-colors outline-none shrink-0 group/col border-r border-border',
                isSortable && 'cursor-pointer hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className="size-3.5 shrink-0 text-foreground" />
              <span className="truncate">{p.label}</span>
              {isSortable && renderSortIndicator(p.key as TableSortField)}
            </div>
          );
        })}
      </div>

      {/* 3. Fixed Actions Column Header */}
      <div
        role="columnheader"
        aria-label="Actions"
        style={{ width: '48px', minWidth: '48px' }}
        className="flex items-center justify-center h-full shrink-0 border-r border-border"
      >
        {onToggleProperty && (
          <TableColumnPropertiesPopover
            visibleProperties={visibleProperties}
            onToggleProperty={onToggleProperty}
            onResetProperties={onResetProperties}
            compact
          />
        )}
      </div>
      <div className="flex-1 h-full min-w-0" />
    </div>
  );
}
