'use client';

import React, { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Paperclip,
  StickyNote,
  ShieldAlert,
  AlertCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { ArchivalTag } from '@/shared/components/ui/archival-tag';
import { isItemRetracted } from '../../utils/retraction';
import { cn } from '@/shared/lib/utils';
import {
  useIsItemSelected,
  useIsActiveItem,
  useIsInspectorOpen,
} from '../../store/selectors';
import { useLibraryUIStore } from '../../store/library-ui.store';
import { ItemContextMenu } from './ItemContextMenu';
import type { Item, Collection } from '../../types/library.types';
import { cleanAcademicText, formatAcademicAuthors } from '../../utils';

export interface ItemTableRowProps {
  item: Item;
  index: number;
  columns: Record<string, boolean>;
  density?: 'comfortable' | 'compact';
  isTrash?: boolean;
  collections?: Collection[];
  onRowClick: (e: React.MouseEvent, item: Item, index: number) => void;
  onToggleSelect?: (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number) => void;
  onToggleStar?: (item: Item, isStarred: boolean) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
  onMoveToCollection?: (itemId: string, collectionId: string) => void;
  onDetachFromCollection?: (id: string) => void;
  isLast?: boolean;
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
  isLast = false,
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
  const currentProjectId = searchParams.get('projectId');
  const queryParts = [
    currentProjectId ? `projectId=${encodeURIComponent(currentProjectId)}` : '',
    currentQuery ? `q=${encodeURIComponent(currentQuery)}` : '',
  ].filter(Boolean);
  const qParam = queryParts.length ? `?${queryParts.join('&')}` : '';

  // Granular Selectors - 60 FPS Re-render Barrier (True O(1))
  const isSelected = useIsItemSelected(item.id);
  const isActive = useIsActiveItem(item.id);
  const isRowActive = isActive;
  const isHighlighted = isSelected || isRowActive;
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);

  const cleanTitle = cleanAcademicText(item.title) || 'Untitled';
  const authorTooltip = React.useMemo(() => {
    const raw =
      item.authors && item.authors.length > 0
        ? item.authors
        : item.creators;
    if (!raw) return '';
    const formatted = formatAcademicAuthors(raw, 999);
    return formatted !== '-' ? formatted : '';
  }, [item.authors, item.creators]);

  const isStarred =
    Boolean(item.isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  const isProcessing = Boolean(item._isProcessing);
  const processingStatus = item._processingStatus;
  const processingError = item._processingError;

  const isRetracted = isItemRetracted(item);
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
      onToggleStar={!isProcessing && onToggleStar ? handleToggleStarContextMenu : undefined}
      onDelete={!isProcessing && onDelete ? handleDeleteContextMenu : undefined}
      onRestore={!isProcessing && onRestore ? handleRestoreContextMenu : undefined}
      onPurge={!isProcessing && onPurge ? handlePurgeContextMenu : undefined}
      onMoveToCollection={!isProcessing && onMoveToCollection ? handleMoveToCollection : undefined}
      onDetachFromCollection={!isProcessing && onDetachFromCollection ? () => onDetachFromCollection(item.id) : undefined}
    >
      <tr
        draggable={!isProcessing}
        aria-rowindex={index + 1}
        aria-selected={isSelected}
        onDragStart={(e) => {
          if (isProcessing) return;
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
            if (isProcessing) {
              toast.info('Document is still processing metadata', {
                description: 'Full paper details will be available shortly.',
                id: 'document-processing-notice',
              });
              return;
            }
            router.push(`/library/papers/${item.id}${qParam}`);
          } else {
            toast.info('Restore this reference to open in reader', {
              id: 'trash-restore-prompt',
              action: onRestore ? {
                label: 'Restore',
                onClick: () => onRestore(item.id),
              } : undefined,
            });
          }
        }}
        className={cn(
          'cursor-pointer transition-colors duration-75 group text-13 h-8',
          !isLast && 'border-b border-border',
          isRowActive || isSelected
            ? 'bg-muted'
            : isProcessing
              ? 'bg-primary/[0.03] hover:bg-muted/60'
              : 'hover:bg-muted/60',
        )}
      >
        {/* Title with Checkbox & Status Indicators */}
        <td className="px-3 h-8 py-0 align-middle min-w-0">
          <div className="flex items-center gap-2 min-w-0 h-full">
            <div
              role="checkbox"
              aria-checked={isSelected}
              aria-label={`Select ${cleanTitle}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onToggleSelect) {
                    onToggleSelect(item.id, e, index);
                  } else {
                    toggleSelect(item.id);
                  }
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleSelect) {
                  onToggleSelect(item.id, e, index);
                } else {
                  toggleSelect(item.id);
                }
              }}
              className="flex items-center justify-center shrink-0 cursor-pointer rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Checkbox
                checked={isSelected}
                tabIndex={-1}
                aria-hidden="true"
                className={cn(
                  'size-3.5 border-border data-[state=checked]:border-primary transition-opacity duration-150 pointer-events-none',
                  !isSelected && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100',
                )}
              />
            </div>
            {isProcessing && processingStatus === 'FAILED' && (
              <span
                title={processingError || 'Extraction failed'}
                className="inline-flex items-center shrink-0"
              >
                <AlertCircle className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
              </span>
            )}
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
              className={cn(
                'truncate text-13 font-normal text-foreground',
                isProcessing && 'font-medium',
              )}
              title={cleanTitle}
            >
              {cleanTitle}
            </span>
          </div>
        </td>

        {/* Authors */}
        {columns.authors !== false && (
          <td className="px-3 h-8 py-0 align-middle truncate text-13 text-foreground font-normal">
            {isProcessing &&
            (!item.authors ||
              item.authors.length === 0 ||
              item.authors[0] === 'Processing metadata...' ||
              item.authors[0] === 'Uploading raw file...') ? (
              <span className="text-foreground text-12 italic">Extracting authors...</span>
            ) : (
              <span title={authorTooltip}>
                {formatAcademicAuthors(
                  item.authors && item.authors.length > 0
                    ? item.authors
                    : item.creators,
                )}
              </span>
            )}
          </td>
        )}

        {/* Year */}
        {columns.year !== false && (
          <td className="px-2 h-8 py-0 align-middle text-center text-13 font-mono tabular-nums text-foreground font-normal">
            {(item.year && item.year > 0 ? item.year : null) ||
              (item.publicationDate || item.date || '').match(/\b(1[7-9]\d{2}|20\d{2})\b/)?.[1] ||
              '-'}
          </td>
        )}

        {/* Publication Venue */}
        {columns.publication !== false && (
          <td className="px-3 h-8 py-0 align-middle truncate text-12 font-serif italic text-foreground/85 font-normal">
            {isProcessing && !item.publicationTitle ? (
              <span className="text-foreground text-12 italic">Recognizing venue...</span>
            ) : (
              <span title={cleanAcademicText(item.publicationTitle || item.journal || item.publisher || '')}>
                {cleanAcademicText(
                  item.publicationTitle ||
                  item.journal ||
                  item.publisher ||
                  ''
                ) || '-'}
              </span>
            )}
          </td>
        )}

        {/* Item Type Label */}
        {columns.itemType && (
          <td className="px-3 h-8 py-0 align-middle truncate text-12 font-mono text-foreground font-normal">
            {item.itemType || '-'}
          </td>
        )}

        {/* DOI */}
        {columns.doi && (
          <td className="px-3 h-8 py-0 align-middle truncate text-foreground font-normal">
            {item.doi ? (
              <ArchivalTag
                value={item.doi}
                type="doi"
                href={`https://doi.org/${item.doi}`}
              />
            ) : (
              '-'
            )}
          </td>
        )}

        {/* Citation Key */}
        {columns.citationKey && (
          <td className="px-3 h-8 py-0 align-middle truncate text-foreground font-normal">
            {item.citationKey || item.key ? (
              <ArchivalTag
                value={item.citationKey || item.key!}
                type="bibtex"
              />
            ) : (
              '-'
            )}
          </td>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <td className="px-2 h-8 py-0 align-middle text-center text-13 font-mono tabular-nums text-foreground font-normal">
            {item.citationCount != null && Number(item.citationCount) > 0 ? item.citationCount : '-'}
          </td>
        )}

        {/* Trash deletedAt & Quick Actions */}
        {isTrash && (
          <td className="px-3 h-8 py-0 align-middle text-12 font-mono tabular-nums text-foreground font-normal">
            <div className="flex items-center justify-between gap-1 w-full">
              <span className="truncate">
                {item.deletedAt
                  ? new Date(item.deletedAt).toLocaleDateString()
                  : '-'}
              </span>
              <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                {onRestore && (
                  <button
                    type="button"
                    title="Restore reference"
                    aria-label="Restore reference"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(item.id);
                    }}
                    className="size-6 rounded flex items-center justify-center hover:bg-muted text-foreground transition-colors cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                )}
                {onPurge && (
                  <button
                    type="button"
                    title="Permanently delete reference"
                    aria-label="Permanently delete reference"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Permanently delete this reference? This action cannot be undone.')) {
                        onPurge(item.id);
                      }
                    }}
                    className="size-6 rounded flex items-center justify-center hover:bg-destructive/15 text-foreground hover:text-destructive transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </td>
        )}
      </tr>
    </ItemContextMenu>
  );
});

export default ItemTableRow;
