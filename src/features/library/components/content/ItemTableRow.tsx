'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Book,
  BookOpen,
  File,
  CheckSquare,
  Square,
  Star,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  useIsItemSelected,
  useIsActiveItem,
} from '../../store/selectors';
import { useLibraryUIStore } from '../../store/library-ui.store';
import { ItemContextMenu } from './ItemContextMenu';
import type { Item } from '../../types/library.types';

export interface ItemTableRowProps {
  item: Item;
  index: number;
  columns: Record<string, boolean>;
  isTrash?: boolean;
  collections?: any[];
  onRowClick: (e: React.MouseEvent, item: Item, index: number) => void;
  onToggleStar: (item: Item, isStarred: boolean) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
}

// Helper for item icons
const getItemIcon = (type?: string) => {
  switch (type) {
    case 'book':
    case 'bookSection':
      return <Book className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'conferencePaper':
      return <BookOpen className="h-4 w-4 text-emerald-500 shrink-0" />;
    case 'journalArticle':
      return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
    default:
      return <File className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

// Formatted creator string
const formatAuthors = (authors: any) => {
  if (!authors) return '—';
  if (Array.isArray(authors)) {
    if (authors.length === 0) return '—';
    if (authors.length === 1) return authors[0];
    if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
    return `${authors[0]} et al.`;
  }
  return String(authors);
};

/**
 * ItemTableRow - High Performance Memoized Row Component
 *
 * Rule: Subscribes only to granular boolean selectors (useIsItemSelected, useIsActiveItem).
 * When another item is clicked, this component DOES NOT RE-RENDER.
 */
export const ItemTableRow = React.memo(function ItemTableRow({
  item,
  index,
  columns,
  isTrash = false,
  collections = [],
  onRowClick,
  onToggleStar,
  onDelete,
  onRestore,
  onPurge,
}: ItemTableRowProps) {
  const router = useRouter();

  // Granular Selectors - 60 FPS Re-render Barrier (True O(1))
  const isSelected = useIsItemSelected(item.id);
  const isActive = useIsActiveItem(item.id);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);

  const isStarred =
    Boolean((item as any).isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  return (
    <ItemContextMenu
      item={item}
      isTrash={isTrash}
      collections={collections}
      onToggleStar={() => onToggleStar(item, isStarred)}
      onDelete={onDelete ? () => onDelete(item.id) : undefined}
      onRestore={onRestore ? () => onRestore(item.id) : undefined}
      onPurge={onPurge ? () => onPurge(item.id) : undefined}
    >
      <tr
        draggable={true}
        aria-rowindex={index + 1}
        aria-selected={isSelected}
        onDragStart={(e) => {
          // Defer reads: read snapshot only on drag event, avoiding re-renders during selection
          const currentSelectedIds = useLibraryUIStore.getState().selectedIds;
          const idsToDrag = currentSelectedIds.has(item.id)
            ? Array.from(currentSelectedIds)
            : [item.id];
          e.dataTransfer.setData(
            'application/x-flux-items',
            JSON.stringify(idsToDrag),
          );
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => onRowClick(e, item, index)}
        onDoubleClick={() => {
          if (!isTrash) {
            router.push(`/reader?itemId=${item.id}`);
          }
        }}
        className={cn(
          'h-9 cursor-pointer transition-colors group select-none [content-visibility:auto] [contain-intrinsic-size:0_36px]',
          isSelected
            ? 'bg-primary/5 hover:bg-primary/10'
            : isActive
            ? 'bg-accent/40 hover:bg-accent/50'
            : 'hover:bg-muted/40',
        )}
      >
        {/* Checkbox Column */}
        <td
          className="px-2 text-center"
          onClick={(e) => {
            e.stopPropagation();
            toggleSelect(item.id);
          }}
        >
          <button
            type="button"
            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {isSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Square className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60" />
            )}
          </button>
        </td>

        {/* Star / Favorite Button */}
        <td
          className="px-1 text-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(item, isStarred);
          }}
        >
          <button
            type="button"
            className="inline-flex items-center justify-center cursor-pointer p-0.5 rounded hover:bg-muted"
            title={isStarred ? 'Bỏ yêu thích' : 'Yêu thích'}
          >
            <Star
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                isStarred
                  ? 'text-amber-500 fill-amber-500'
                  : 'text-muted-foreground/30 hover:text-amber-400 group-hover:opacity-100 opacity-0',
              )}
            />
          </button>
        </td>

        {/* Item Type Icon */}
        <td className="px-1 text-center">{getItemIcon(item.itemType)}</td>

        {/* Title */}
        <td className="px-3 truncate text-foreground font-medium">
          <span title={item.title || 'Untitled'}>
            {item.title || 'Untitled'}
          </span>
        </td>

        {/* Authors */}
        {columns.authors !== false && (
          <td className="px-3 truncate text-muted-foreground">
            <span
              title={
                Array.isArray(item.authors)
                  ? item.authors.join(', ')
                  : item.authors || ''
              }
            >
              {formatAuthors(item.authors)}
            </span>
          </td>
        )}

        {/* Year */}
        {columns.year !== false && (
          <td className="px-2 text-center text-muted-foreground font-mono">
            {item.year || '—'}
          </td>
        )}

        {/* Publication Venue */}
        {columns.publication !== false && (
          <td className="px-3 truncate text-muted-foreground">
            <span title={item.publicationTitle || (item as any).journal || ''}>
              {item.publicationTitle ||
                (item as any).journal ||
                (item as any).publisher ||
                '—'}
            </span>
          </td>
        )}

        {/* Item Type Label */}
        {columns.itemType && (
          <td className="px-3 truncate text-muted-foreground capitalize">
            {item.itemType || '—'}
          </td>
        )}

        {/* DOI */}
        {columns.doi && (
          <td className="px-3 truncate text-muted-foreground font-mono text-11">
            {item.doi ? (
              <a
                href={`https://doi.org/${item.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:underline text-primary"
              >
                {item.doi}
              </a>
            ) : (
              '—'
            )}
          </td>
        )}

        {/* Citation Key */}
        {columns.citationKey && (
          <td className="px-3 truncate text-muted-foreground font-mono text-11">
            {item.citationKey || (item as any).key || '—'}
          </td>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <td className="px-2 text-center text-muted-foreground font-mono">
            {(item as any).citationCount ?? '—'}
          </td>
        )}

        {/* Trash deletedAt */}
        {isTrash && (
          <td className="px-3 text-muted-foreground text-11">
            {item.deletedAt
              ? new Date(item.deletedAt).toLocaleDateString()
              : '—'}
          </td>
        )}
      </tr>
    </ItemContextMenu>
  );
});

export default ItemTableRow;
