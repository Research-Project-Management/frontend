'use client';

import React from 'react';
import { ArrowUp, ArrowDown, Star, CheckSquare, Square } from 'lucide-react';

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
      <ArrowUp className="h-3 w-3 text-foreground" />
    ) : (
      <ArrowDown className="h-3 w-3 text-foreground" />
    );
  };

  return (
    <thead className="sticky top-0 z-10 bg-background/95 border-b border-border/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <tr className="h-8 text-muted-foreground font-medium text-12">
        {/* Checkbox */}
        <th className="w-9 px-2 text-center shrink-0">
          <button
            type="button"
            onClick={onSelectAll}
            className="hover:text-foreground inline-flex items-center justify-center cursor-pointer"
            title={isAllSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          >
            {isAllSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5 text-muted-foreground/60" />
            )}
          </button>
        </th>

        {/* Favorite / Star */}
        <th className="w-7 px-1 text-center shrink-0">
          <Star className="h-3 w-3 text-muted-foreground/40 mx-auto" />
        </th>

        {/* Type Icon */}
        <th className="w-7 px-1 text-center shrink-0"></th>

        {/* Title (Primary Column) */}
        <th
          onClick={() => onSort('title')}
          className="px-3 font-medium cursor-pointer hover:text-foreground transition-colors group/col"
        >
          <div className="flex items-center gap-1">
            <span>Tiêu đề</span>
            {renderSortIndicator('title')}
          </div>
        </th>

        {/* Authors */}
        {columns.authors !== false && (
          <th
            onClick={() => onSort('authors')}
            className="w-48 px-3 font-medium cursor-pointer hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-1">
              <span>Tác giả</span>
              {renderSortIndicator('authors')}
            </div>
          </th>
        )}

        {/* Year */}
        {columns.year !== false && (
          <th
            onClick={() => onSort('year')}
            className="w-16 px-2 text-center font-medium cursor-pointer hover:text-foreground transition-colors"
          >
            <div className="flex items-center justify-center gap-1">
              <span>Năm</span>
              {renderSortIndicator('year')}
            </div>
          </th>
        )}

        {/* Publication Venue */}
        {columns.publication !== false && (
          <th
            onClick={() => onSort('publicationTitle')}
            className="w-44 px-3 font-medium cursor-pointer hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-1">
              <span>Nơi xuất bản</span>
              {renderSortIndicator('publicationTitle')}
            </div>
          </th>
        )}

        {/* Item Type */}
        {columns.itemType && <th className="w-28 px-3 font-medium">Loại</th>}

        {/* DOI */}
        {columns.doi && <th className="w-32 px-3 font-medium">DOI</th>}

        {/* Citation Key */}
        {columns.citationKey && (
          <th className="w-32 px-3 font-medium">Citation Key</th>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <th className="w-20 px-2 text-center font-medium">Trích dẫn</th>
        )}

        {/* Trash deletedAt column */}
        {isTrash && <th className="w-32 px-3 font-medium">Ngày xóa</th>}
      </tr>
    </thead>
  );
}

export default ItemTableHeader;
