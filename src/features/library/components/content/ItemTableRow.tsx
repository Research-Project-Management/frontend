'use client';

import React, { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Paperclip,
  StickyNote,
  ShieldAlert,
} from 'lucide-react';
import { Checkbox } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  useIsItemSelected,
  useIsActiveItem,
  useIsInspectorOpen,
} from '../../store/selectors';
import { useLibraryUIStore } from '../../store/library-ui.store';
import { ItemContextMenu } from './ItemContextMenu';
import type { Item } from '../../types/library.types';
import { cleanAcademicText, formatAcademicAuthors } from '../../utils';

export interface ItemTableRowProps {
  item: Item;
  index: number;
  columns: Record<string, boolean>;
  density?: 'comfortable' | 'compact';
  isTrash?: boolean;
  collections?: any[];
  onRowClick: (e: React.MouseEvent, item: Item, index: number) => void;
  onToggleSelect?: (id: string, e: React.MouseEvent, index: number) => void;
  onToggleStar?: (item: Item, isStarred: boolean) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
  onMoveToCollection?: (itemId: string, collectionId: string) => void;
  onDetachFromCollection?: (id: string) => void;
}

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
  density = 'comfortable',
  isTrash = false,
  collections = [],
  onRowClick,
  onToggleSelect,
  onToggleStar,
  onDelete,
  onRestore,
  onPurge,
  onMoveToCollection,
  onDetachFromCollection,
}: ItemTableRowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q');
  const qParam = currentQuery ? `?q=${encodeURIComponent(currentQuery)}` : '';

  // Granular Selectors - 60 FPS Re-render Barrier (True O(1))
  const isSelected = useIsItemSelected(item.id);
  const isActive = useIsActiveItem(item.id);
  const isRowActive = isActive;
  const isHighlighted = isSelected || isRowActive;
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);

  const cleanTitle = cleanAcademicText(item.title) || 'Untitled';
  const authorTooltip = React.useMemo(() => {
    if (!item.authors) return '';
    if (Array.isArray(item.authors)) {
      return item.authors
        .map((a: any) => (typeof a === 'string' ? cleanAcademicText(a) : a?.name || ''))
        .filter(Boolean)
        .join(', ');
    }
    return cleanAcademicText(String(item.authors));
  }, [item.authors]);

  const isStarred =
    Boolean(item.isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  const isRetracted = Boolean(
    item.isRetracted ||
    (item as any).retractionStatus === 'retracted' ||
    (item as any).is_retracted
  );
  const hasAttachment = Boolean(
    item.hasFile ||
    (item.attachmentCount ?? 0) > 0 ||
    item.fileUrl ||
    (Array.isArray(item.attachments) && item.attachments.length > 0)
  );
  const attachmentCount =
    item.attachmentCount ||
    (Array.isArray(item.attachments) ? item.attachments.length : 1);
  const hasNotes = Boolean(
    (item.noteCount ?? 0) > 0 ||
    (Array.isArray(item.notes) && item.notes.length > 0)
  );
  const noteCount =
    item.noteCount ||
    (Array.isArray(item.notes) ? item.notes.length : 1);

  const handleMoveToCollection = useCallback(
    (colId: string) => {
      onMoveToCollection?.(item.id, colId);
    },
    [onMoveToCollection, item.id],
  );

  const handleToggleStarContextMenu = useCallback(() => {
    onToggleStar?.(item, isStarred);
  }, [onToggleStar, item, isStarred]);

  const handleDeleteContextMenu = useCallback(() => {
    onDelete?.(item.id);
  }, [onDelete, item.id]);

  const handleRestoreContextMenu = useCallback(() => {
    onRestore?.(item.id);
  }, [onRestore, item.id]);

  const handlePurgeContextMenu = useCallback(() => {
    onPurge?.(item.id);
  }, [onPurge, item.id]);

  return (
    <ItemContextMenu
      item={item}
      isTrash={isTrash}
      collections={collections}
      onToggleStar={onToggleStar ? handleToggleStarContextMenu : undefined}
      onDelete={onDelete ? handleDeleteContextMenu : undefined}
      onRestore={onRestore ? handleRestoreContextMenu : undefined}
      onPurge={onPurge ? handlePurgeContextMenu : undefined}
      onMoveToCollection={onMoveToCollection ? handleMoveToCollection : undefined}
      onDetachFromCollection={onDetachFromCollection ? () => onDetachFromCollection(item.id) : undefined}
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
            JSON.stringify({ ids: idsToDrag }),
          );
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={(e) => onRowClick(e, item, index)}
        onDoubleClick={() => {
          if (!isTrash) {
            router.push(`/library/papers/${item.id}${qParam}`);
          }
        }}
        className={cn(
          'cursor-pointer transition-colors duration-75 group select-none text-13 h-[34px]',
          isRowActive || isSelected
            ? 'bg-muted'
            : 'hover:bg-muted/60',
        )}
      >
        {/* Title with Checkbox & Status Indicators */}
        <td className="px-3 h-[34px] py-0 align-middle min-w-0">
          <div className="flex items-center gap-2 min-w-0 h-full">
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSelect) {
                  onToggleSelect(item.id, e, index);
                } else {
                  toggleSelect(item.id);
                }
              }}
              className="flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Checkbox
                checked={isSelected}
                tabIndex={-1}
                aria-label="Select item"
                className={cn(
                  'size-3.5 border-border data-[state=checked]:border-primary transition-opacity duration-150 pointer-events-none',
                  !isSelected && 'opacity-0 group-hover:opacity-100',
                )}
              />
            </div>
            {isRetracted && (
              <span
                title="This item has been retracted"
                className="inline-flex items-center shrink-0"
              >
                <ShieldAlert className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
              </span>
            )}
            {hasAttachment && (
              <span
                title={`${attachmentCount} attachment(s)`}
                className="inline-flex items-center shrink-0"
              >
                <Paperclip className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              </span>
            )}
            {hasNotes && (
              <span
                title={`${noteCount} note(s)`}
                className="inline-flex items-center shrink-0"
              >
                <StickyNote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              </span>
            )}
            <span
              className="truncate text-13 text-foreground font-normal"
              title={cleanTitle}
            >
              {cleanTitle}
            </span>
          </div>
        </td>

        {/* Authors */}
        {columns.authors !== false && (
          <td className="px-3 h-[34px] py-0 align-middle truncate text-13 text-foreground font-normal">
            <span title={authorTooltip}>
              {formatAcademicAuthors(item.authors)}
            </span>
          </td>
        )}

        {/* Year */}
        {columns.year !== false && (
          <td className="px-2 h-[34px] py-0 align-middle text-center text-13 font-mono tabular-nums text-foreground font-normal">
            {item.year || '—'}
          </td>
        )}

        {/* Publication Venue */}
        {columns.publication !== false && (
          <td className="px-3 h-[34px] py-0 align-middle truncate text-13 text-foreground font-normal">
            <span title={cleanAcademicText(item.publicationTitle || (item as any).journal || (item as any).publisher || '')}>
              {cleanAcademicText(
                item.publicationTitle ||
                (item as any).journal ||
                (item as any).publisher ||
                ''
              ) || '—'}
            </span>
          </td>
        )}

        {/* Item Type Label */}
        {columns.itemType && (
          <td className="px-3 h-[34px] py-0 align-middle truncate text-13 capitalize text-foreground font-normal">
            {item.itemType || '—'}
          </td>
        )}

        {/* DOI */}
        {columns.doi && (
          <td className="px-3 h-[34px] py-0 align-middle truncate text-13 font-mono tabular-nums text-foreground font-normal">
            {item.doi ? (
              <a
                href={`https://doi.org/${item.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:underline text-foreground transition-colors"
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
          <td className="px-3 h-[34px] py-0 align-middle truncate text-13 font-mono text-foreground font-normal">
            {item.citationKey || (item as any).key || '—'}
          </td>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <td className="px-2 h-[34px] py-0 align-middle text-center text-13 font-mono tabular-nums text-foreground font-normal">
            {(item as any).citationCount ?? '—'}
          </td>
        )}

        {/* Trash deletedAt */}
        {isTrash && (
          <td className="px-3 h-[34px] py-0 align-middle text-13 font-mono tabular-nums text-foreground font-normal">
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
