'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paperclip,
  StickyNote,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { ArchivalTag } from '@/shared/components/ui/archival-tag';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { isItemRetracted } from '@/features/library/domain/retraction';
import { cn } from '@/shared/lib/utils';
import {
  useLibraryUIStore,
  useIsItemSelected,
  useIsActiveItem,
} from '@/features/library/core/store/library-ui.store';
import { ItemContextMenu } from './ItemContextMenu';
import { ItemRowActions } from './ItemRowActions';
import type { Item, Collection } from '@/features/library/domain/types/library.types';
import { cleanAcademicText, formatAcademicAuthors } from '@/features/library/domain/academic-text';
import {
  getItemDisplayTitle,
  getItemDisplayDate,
  getPublicationVenue,
} from '@/features/library/domain/metadata';
import { getItemTypeDefinition } from '@/features/library/domain/types/item-types.types';

export interface ItemTableRowProps {
  item: Item;
  index: number;
  scopeId?: string;
  columns: Record<string, boolean>;
  isTrash?: boolean;
  collections?: Collection[];
  canEdit?: boolean;
  onRowClick: (e: React.MouseEvent, item: Item, index: number) => void;
  onToggleSelect?: (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number) => void;
  onToggleStar?: (item: Item, isStarred: boolean) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
  onPurge?: (id: string) => void;
  onAddToCollection?: (itemId: string, collectionId: string) => void;
  onMoveToCollection?: (itemId: string, collectionId: string) => void;
  onDetachFromCollection?: (id: string) => void;
  onOpenItem?: (id: string) => void;
  isLast?: boolean;
}

const EMPTY_COLLECTIONS: Collection[] = [];

/**
 * ItemTableRow - High Performance Memoized Row Component
 *
 * Rule: Subscribes only to granular boolean selectors (useIsItemSelected, useIsActiveItem).
 * When another item is clicked, this component DOES NOT RE-RENDER.
 */
export const ItemTableRow = React.memo(function ItemTableRow({
  item,
  index,
  scopeId,
  isLast = false,
  columns,
  isTrash = false,
  collections = EMPTY_COLLECTIONS,
  canEdit = true,
  onRowClick,
  onToggleSelect,
  onToggleStar,
  onDelete,
  onRestore,
  onPurge,
  onAddToCollection,
  onMoveToCollection,
  onDetachFromCollection,
  onOpenItem,
}: ItemTableRowProps) {
  const router = useRouter();

  // Granular Selectors - 60 FPS Re-render Barrier (True O(1))
  const isSelected = useIsItemSelected(item.id);
  const isRowActive = useIsActiveItem(item.id);
  const toggleSelect = useLibraryUIStore((s) => s.toggleSelect);
  const openModal = useLibraryUIStore((s) => s.openModal);

  const { cleanTitle, formattedAuthors, authorTooltip, displayYear, venueText } = React.useMemo(() => {
    const title = cleanAcademicText(getItemDisplayTitle(item) || item.title) || 'Untitled';

    const rawAuthors =
      item.authors && item.authors.length > 0
        ? item.authors
        : item.creators;
    let shortAuthors = '—';
    let fullAuthors = '';
    if (rawAuthors) {
      const full = formatAcademicAuthors(rawAuthors, 999);
      shortAuthors = formatAcademicAuthors(rawAuthors);
      fullAuthors = full !== '—' ? full : '';
    }

    const rawDate = getItemDisplayDate(item);
    let year = '-';
    if (typeof rawDate === 'number') {
      year = String(rawDate);
    } else if (typeof rawDate === 'string') {
      year = rawDate.match(/\b(1[7-9]\d{2}|20\d{2})\b/)?.[1] || rawDate || '-';
    }

    const venue = cleanAcademicText(
      getPublicationVenue(item) ||
        item.publicationTitle ||
        item.publisher ||
        '',
    );

    return {
      cleanTitle: title,
      formattedAuthors: shortAuthors,
      authorTooltip: fullAuthors,
      displayYear: year,
      venueText: venue,
    };
  }, [item]);

  const itemTypeLabel = React.useMemo(() => {
    if (!item.itemType) return '-';
    const def = getItemTypeDefinition(item.itemType);
    return def?.label || item.itemType;
  }, [item.itemType]);

  const isStarred = Boolean(item.isStarred);

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

  const handleAddToCollection = useCallback((colId: string) => { onAddToCollection?.(item.id, colId); }, [onAddToCollection, item.id]);
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
      scopeId={scopeId}
      isTrash={isTrash}
      collections={collections}
      canEdit={canEdit}
      onAddToCollection={!isProcessing && onAddToCollection ? handleAddToCollection : undefined}
      onToggleStar={!isProcessing && onToggleStar ? handleToggleStarContextMenu : undefined}
      onDelete={!isProcessing && onDelete ? handleDeleteContextMenu : undefined}
      onRestore={!isProcessing && onRestore ? handleRestoreContextMenu : undefined}
      onPurge={!isProcessing && onPurge ? handlePurgeContextMenu : undefined}
      onMoveToCollection={!isProcessing && onMoveToCollection ? handleMoveToCollection : undefined}
      onDetachFromCollection={!isProcessing && onDetachFromCollection ? () => onDetachFromCollection(item.id) : undefined}
      onOpenItem={onOpenItem}
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
            if (onOpenItem) {
              onOpenItem(item.id);
            } else {
              router.push(`/library/papers/${item.id}`);
            }
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
          'cursor-pointer group text-13 h-8',
          !isLast && 'border-b border-border',
          isSelected
            ? 'bg-primary/10 ring-1 ring-inset ring-primary/30 font-medium'
            : isRowActive
              ? 'bg-muted'
            : isProcessing
              ? 'bg-primary/5 hover:bg-muted'
              : 'hover:bg-muted',
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
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'truncate text-13 font-normal text-foreground',
                    isProcessing && 'font-medium',
                  )}
                >
                  {cleanTitle}
                </span>
              </TooltipTrigger>
              <TooltipContent>{cleanTitle}</TooltipContent>
            </Tooltip>

            {/* Trailing Status Indicators (Aligned after title so all titles start on a strict vertical axis) */}
            {(hasAttachment || hasNotes || isRetracted || (isProcessing && processingStatus === 'FAILED')) && (
              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                {isProcessing && processingStatus === 'FAILED' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center shrink-0">
                        <AlertCircle className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{processingError || 'Extraction failed'}</TooltipContent>
                  </Tooltip>
                )}
                {isRetracted && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center shrink-0">
                        <ShieldAlert className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Retracted item</TooltipContent>
                  </Tooltip>
                )}
                {hasAttachment && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isTrash) return;
                          if (onOpenItem) {
                            onOpenItem(item.id);
                          } else {
                            router.push(`/library/papers/${item.id}`);
                          }
                        }}
                        className="inline-flex items-center justify-center size-5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors cursor-pointer shrink-0 outline-none"
                        aria-label="Open attachment"
                      >
                        <Paperclip className="size-3.5 shrink-0" strokeWidth={1.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {attachmentCount > 1 ? `Open attachment (${attachmentCount})` : 'Open attachment'}
                    </TooltipContent>
                  </Tooltip>
                )}
                {hasNotes && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center justify-center size-5 text-muted-foreground shrink-0">
                        <StickyNote className="size-3.5 shrink-0" strokeWidth={1.5} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{noteCount > 1 ? `${noteCount} notes` : '1 note'}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
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
            ) : authorTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block truncate">{formattedAuthors}</span>
                </TooltipTrigger>
                <TooltipContent>{authorTooltip}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="block truncate">{formattedAuthors}</span>
            )}
          </td>
        )}

        {/* Year */}
        {columns.year !== false && (
          <td className="px-2 h-8 py-0 align-middle text-center text-13 font-mono tabular-nums text-foreground font-normal">
            {displayYear}
          </td>
        )}

        {/* Publication Venue */}
        {columns.publication !== false && (
          <td className="px-3 h-8 py-0 align-middle truncate text-13 text-foreground font-normal">
            {isProcessing && !item.publicationTitle ? (
              <span className="text-foreground text-12 italic">Recognizing venue...</span>
            ) : venueText ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block truncate">{venueText}</span>
                </TooltipTrigger>
                <TooltipContent>{venueText}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-foreground">-</span>
            )}
          </td>
        )}

        {/* Item Type Label */}
        {columns.itemType && (
          <td className="px-3 h-8 py-0 align-middle truncate text-13 text-foreground font-normal">
            {itemTypeLabel && itemTypeLabel !== '-' ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block truncate">{itemTypeLabel}</span>
                </TooltipTrigger>
                <TooltipContent>{itemTypeLabel}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-foreground">-</span>
            )}
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
                className="max-w-full truncate"
              />
            ) : (
              <span className="text-foreground">-</span>
            )}
          </td>
        )}

        {/* Citation Key */}
        {columns.citationKey && (
          <td className="px-3 h-8 py-0 align-middle truncate text-foreground font-normal">
            {item.citationKey ? (
              <ArchivalTag
                value={item.citationKey}
                type="bibtex"
                className="max-w-full truncate"
              />
            ) : (
              <span className="text-foreground">-</span>
            )}
          </td>
        )}

        {/* Citations Count */}
        {columns.citations && (
          <td className="px-2 h-8 py-0 align-middle text-center text-13 font-mono tabular-nums text-foreground font-normal">
            {item.citationCount != null && Number(item.citationCount) > 0 ? (
              item.citationCount
            ) : (
              <span className="text-foreground">-</span>
            )}
          </td>
        )}

        {/* Trash deletedAt column */}
        {isTrash && (
          <td className="px-3 h-8 py-0 align-middle text-12 font-mono tabular-nums text-foreground font-normal">
            <span className="truncate">
              {item.deletedAt
                ? new Date(item.deletedAt).toLocaleDateString()
                : '-'}
            </span>
          </td>
        )}

        {/* Dedicated Actions Menu Column (Always present on every row) */}
        <td
          className="w-11 px-1.5 h-8 py-0 align-middle text-right shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ItemRowActions
            item={item}
            scopeId={scopeId}
            isTrash={isTrash}
            collections={collections}
      canEdit={canEdit}
      onAddToCollection={!isProcessing && onAddToCollection ? handleAddToCollection : undefined}
            onToggleStar={!isProcessing && onToggleStar ? handleToggleStarContextMenu : undefined}
            onDelete={!isProcessing && onDelete ? handleDeleteContextMenu : undefined}
            onRestore={!isProcessing && onRestore ? handleRestoreContextMenu : undefined}
            onPurge={!isProcessing && onPurge ? handlePurgeContextMenu : undefined}
            onMoveToCollection={!isProcessing && onMoveToCollection ? handleMoveToCollection : undefined}
            onDetachFromCollection={!isProcessing && onDetachFromCollection ? () => onDetachFromCollection(item.id) : undefined}
            onOpenItem={onOpenItem}
          />
        </td>
      </tr>
    </ItemContextMenu>
  );
});

export default ItemTableRow;

