'use client';

import React from 'react';
import { FileText, Book, File, CheckSquare, Square } from 'lucide-react';
import { useLibraryViewStore } from '../../store/library-view.store';
import type { Item } from '../../types/library.types';
import { cn } from '@/shared/lib/utils';

interface ItemTableProps {
  items: Item[];
}

export function ItemTable({ items }: ItemTableProps) {
  const selectedIds = useLibraryViewStore((s) => s.selectedIds);
  const activeItemId = useLibraryViewStore((s) => s.activeItemId);
  const toggleSelect = useLibraryViewStore((s) => s.toggleSelect);
  const selectOnly = useLibraryViewStore((s) => s.selectOnly);
  const selectAll = useLibraryViewStore((s) => s.selectAll);
  const clearSelection = useLibraryViewStore((s) => s.clearSelection);

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll(items.map((it) => it.id));
    }
  };

  const getItemIcon = (type?: string) => {
    switch (type) {
      case 'book':
      case 'bookSection':
        return <Book className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'journalArticle':
        return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <div className="w-full h-full overflow-auto text-xs">
      <table className="w-full table-fixed text-left border-collapse select-none">
        <thead className="sticky top-0 z-10 bg-muted/40 border-b border-border/70 backdrop-blur">
          <tr className="h-8 text-muted-foreground font-medium">
            <th className="w-10 px-3 text-center">
              <button
                onClick={handleSelectAll}
                className="hover:text-foreground inline-flex items-center justify-center"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </th>
            <th className="w-8 px-1"></th>
            <th className="w-2/5 px-3 font-medium">Tiêu đề</th>
            <th className="w-1/4 px-3 font-medium">Tác giả</th>
            <th className="w-16 px-3 text-center font-medium">Năm</th>
            <th className="w-1/5 px-3 font-medium">Nơi xuất bản / Tạp chí</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isActive = activeItemId === item.id;

            return (
              <tr
                key={item.id}
                onClick={() => selectOnly(item.id)}
                className={cn(
                  'h-9 cursor-pointer transition-colors hover:bg-muted/50 group',
                  isSelected && 'bg-primary/5 hover:bg-primary/10',
                  isActive && 'bg-accent/40 font-medium'
                )}
              >
                {/* Checkbox column */}
                <td
                  className="px-3 text-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(item.id);
                  }}
                >
                  <button className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground">
                    {isSelected ? (
                      <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Square className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </td>

                {/* Type icon */}
                <td className="px-1 text-center">
                  {getItemIcon(item.itemType)}
                </td>

                {/* Title */}
                <td className="px-3 truncate text-foreground font-medium">
                  {item.title || 'Untitled'}
                </td>

                {/* Authors */}
                <td className="px-3 truncate text-muted-foreground">
                  {Array.isArray(item.authors)
                    ? item.authors.join(', ')
                    : item.authors || '—'}
                </td>

                {/* Year */}
                <td className="px-3 text-center text-muted-foreground font-mono">
                  {item.year || '—'}
                </td>

                {/* Publication / Journal */}
                <td className="px-3 truncate text-muted-foreground">
                  {item.publicationTitle || (item as any).journal || (item as any).publisher || '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
