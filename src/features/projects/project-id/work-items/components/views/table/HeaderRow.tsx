'use client';

import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, SlidersHorizontal, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';
import {
  type TablePropertyKey,
  type TableSortField,
  type TableSortOrder,
  type ColumnPropertiesPopoverProps,
  TABLE_PROPERTIES,
  DEFAULT_COLUMN_WIDTHS,
} from '@/features/projects/project-id/work-items/types/work-item.types';

export type { ColumnPropertiesPopoverProps };

export function ColumnPropertiesPopover({
  visibleProperties,
  onToggleProperty,
  compact = false,
}: ColumnPropertiesPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return TABLE_PROPERTIES;
    return TABLE_PROPERTIES.filter((p) => p.label.toLowerCase().includes(q));
  }, [searchQuery]);

  const activeCount = useMemo(
    () => Object.values(visibleProperties).filter(Boolean).length,
    [visibleProperties]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            type="button"
            aria-label="Display properties"
            title="Display properties"
            className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer select-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-3.5 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted border border-border bg-background transition-colors cursor-pointer select-none relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-3.5 shrink-0" />
            <span>Display</span>
            <span className="rounded-md bg-muted px-1.5 py-0.2 text-10 font-mono font-medium text-foreground tabular-nums">
              {activeCount}
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 border-border bg-popover shadow-overlay z-100 rounded-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border px-1">
          <span className="text-xs font-semibold text-foreground">Display properties</span>
        </div>

        <div className="relative mb-2 px-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search properties..."
            className="h-7 pl-7 text-xs bg-background border-border placeholder:text-muted-foreground text-foreground rounded-md focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5 px-1 py-0.5">
          {filteredProperties.map((p) => {
            const Icon = p.icon;
            const isChecked = Boolean(visibleProperties[p.key]);

            return (
              <label
                key={p.key}
                className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-muted transition-colors text-foreground select-none"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 text-foreground shrink-0" />
                  <span>{p.label}</span>
                </div>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleProperty(p.key)}
                  className="size-3.5 rounded-sm"
                />
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface GroupHeaderProps {
  title: string;
  color?: string;
  icon?: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  onQuickAdd?: () => void;
  isReadOnly?: boolean;
}

export function GroupHeader({
  title,
  color,
  icon,
  count,
  onToggle,
}: GroupHeaderProps) {
  return (
    <div
      role="row"
      onClick={onToggle}
      className="sticky top-9 z-20 flex items-center h-9 px-2.5 border-b border-border bg-muted/50 hover:bg-muted/70 backdrop-blur-xs transition-colors cursor-pointer select-none gap-2 text-xs font-medium text-foreground w-full"
    >
      <div className="sticky left-2.5 flex items-center gap-2 shrink-0">
        {icon ? (
          icon
        ) : (
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: color || '#6B7280' }}
          />
        )}

        <span className="font-semibold text-foreground truncate">{title}</span>

        <span className="rounded-md bg-background border border-border px-1.5 py-0.2 text-10 font-mono font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
    </div>
  );
}

export interface HeaderRowProps {
  visibleProperties: Record<TablePropertyKey, boolean>;
  columnWidths?: Record<string, number>;
  onToggleProperty?: (key: TablePropertyKey) => void;
  sortField?: TableSortField;
  sortOrder?: TableSortOrder;
  onSort?: (field: TableSortField) => void;
}

export function HeaderRow({
  visibleProperties,
  columnWidths,
  onToggleProperty,
  sortField,
  sortOrder,
  onSort,
}: HeaderRowProps) {
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
      {/* 1. First Column: Work items Title (Frozen / Sticky Left, Expands Responsively) */}
      <div
        role="columnheader"
        style={{
          minWidth: `${titleWidth}px`,
          flex: `2.4 1 ${titleWidth}px`,
          left: 0,
        }}
        className="sticky left-0 z-30 flex items-center px-3 h-full border-r border-border group/header bg-background"
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
        const isLabels = p.key === 'labels';

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
            style={{
              minWidth: `${propWidth}px`,
              flex: isLabels ? `1.6 1 ${propWidth}px` : `1 1 ${propWidth}px`,
            }}
            onClick={() => isSortable && onSort?.(p.key as TableSortField)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 h-full text-xs font-medium text-foreground select-none transition-colors outline-none group/col border-r border-border whitespace-nowrap',
              isSortable && 'cursor-pointer hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <Icon className="size-3.5 shrink-0 text-foreground" />
            <span className="truncate">{p.label}</span>
            {isSortable && renderSortIndicator(p.key as TableSortField)}
          </div>
        );
      })}

      {/* 3. Fixed Actions Column Header (Flush right edge, no trailing spacer) */}
      <div
        role="columnheader"
        aria-label="Actions"
        style={{ width: '48px', minWidth: '48px' }}
        className="flex items-center justify-center h-full shrink-0"
      >
        {onToggleProperty && (
          <ColumnPropertiesPopover
            visibleProperties={visibleProperties}
            onToggleProperty={onToggleProperty}
            compact
          />
        )}
      </div>
    </div>
  );
}
