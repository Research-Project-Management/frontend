'use client';

import React, { useState, useCallback } from 'react';
import {
  MoreVertical,
  ExternalLink,
  BookOpen,
  Star,
  Copy,
  Quote,
  FolderPlus,
  FolderMinus,
  Trash2,
  RotateCcw,
  RefreshCw,
  Award,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useItemActionHandlers } from '@/features/library/core/coordinator/item-action.coordinator';
import type { Item, Collection, CslStyle } from '@/features/library/domain/types/core.types';

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
        <th
          scope="col"
          className="pl-1.5 pr-3 h-8 py-0 align-middle font-medium select-none text-left bg-background border-b border-border"
        >
          <div className="flex items-center gap-1.5 w-full">
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                {isAllSelected ? 'Deselect all' : 'Select all'}
              </TooltipContent>
            </Tooltip>
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

        {columns.itemType && (
          <th scope="col" className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            Type
          </th>
        )}

        {columns.doi && (
          <th scope="col" className="px-3 h-8 py-0 align-middle font-medium text-foreground text-left bg-background border-b border-border">
            DOI
          </th>
        )}

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

        {isTrash && (
          <th
            scope="col"
            aria-sort={getAriaSort('deletedAt')}
            onClick={() => onSort('deletedAt')}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onSort('deletedAt');
              }
            }}
            tabIndex={0}
            className="px-3 h-8 py-0 align-middle font-medium cursor-pointer text-foreground select-none text-left bg-background border-b border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <div className="flex items-center gap-1.5">
              <span>Date Deleted</span>
              {renderSortIndicator('deletedAt')}
            </div>
          </th>
        )}

        <th
          scope="col"
          aria-label="Actions"
          className="w-11 px-1 h-8 py-0 align-middle bg-background border-b border-border"
        />
      </tr>
    </thead>
  );
}

export interface ItemRowActionsProps {
  item: Item;
  scopeId?: string;
  isTrash?: boolean;
  collections?: Collection[];
  canEdit?: boolean;
  onToggleStar?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPurge?: () => void;
  onAddToCollection?: (collectionId: string) => void;
  onMoveToCollection?: (collectionId: string) => void;
  onDetachFromCollection?: () => void;
  onOpenItem?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
}

export const ItemRowActions = React.memo(function ItemRowActions({
  item,
  scopeId,
  isTrash = false,
  collections = [],
  canEdit = true,
  onToggleStar,
  onDelete,
  onRestore,
  onPurge,
  onAddToCollection,
  onMoveToCollection,
  onDetachFromCollection,
  onOpenItem,
  onOpenInNewTab,
}: ItemRowActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const {
    availableStyles,
    isStarred,
    handleOpen,
    handleOpenInNewTab,
    handleCopyBibliography,
    handleCopyInTextCitation,
    handleCopyCitationKey,
    handleRefreshMetadata,
    handleToggleMyPublications,
    handleToggleRetraction,
    handleSelectCollection,
  } = useItemActionHandlers(item, {
    scopeId,
    isMenuOpen: isOpen,
    onOpenItem,
    onOpenInNewTab,
    onAddToCollection,
    onMoveToCollection,
    onAfterAction: closeMenu,
  });

  if (isTrash && !canEdit) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-end transition-opacity duration-150',
        isOpen
          ? 'opacity-100'
          : 'opacity-0 max-md:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
      )}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              'size-6 rounded-md flex items-center justify-center transition-all duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isOpen
                ? 'bg-background text-foreground border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-background border border-transparent hover:border-border',
            )}
          >
            <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="bottom"
          align="end"
          sideOffset={4}
          collisionPadding={12}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="min-w-[14.5rem] w-max max-w-xs p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
          onClick={(e) => e.stopPropagation()}
        >
            {isTrash ? (
              <>
                {canEdit && onRestore && (
                  <DropdownMenuItem
                    onClick={() => {
                      setIsOpen(false);
                      onRestore();
                    }}
                    className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                  >
                    <RotateCcw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                    <span>Restore reference</span>
                  </DropdownMenuItem>
                )}

                {canEdit && onPurge && onRestore && <DropdownMenuSeparator className="my-1" />}

                {canEdit && onPurge && (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      setIsOpen(false);
                      onPurge();
                    }}
                    className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
                  >
                    <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
                    <span>Delete permanently</span>
                  </DropdownMenuItem>
                )}
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={handleOpen}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <BookOpen className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>Open in Reader</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleOpenInNewTab}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <ExternalLink className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>Open in New Tab</span>
                </DropdownMenuItem>

                {canEdit && onToggleStar && (
                  <DropdownMenuItem
                    onClick={() => {
                      setIsOpen(false);
                      onToggleStar();
                    }}
                    className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                  >
                    <Star
                      className={cn(
                        'size-3.5 shrink-0',
                        isStarred ? 'fill-warning text-warning' : 'text-foreground',
                      )}
                      strokeWidth={1.5}
                    />
                    <span>{isStarred ? 'Remove from Starred' : 'Add to Starred'}</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="my-1" />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                    <Copy className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                    <span>Copy Citation</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 p-1 text-12 shadow-raised-200 select-none max-h-64 overflow-y-auto">
                    {availableStyles.map((style) => (
                      <DropdownMenuItem
                        key={style.id}
                        onClick={() => handleCopyBibliography(style.id as CslStyle)}
                        className="cursor-pointer text-12 py-1.5 px-2 truncate"
                      >
                        {style.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem onClick={() => handleCopyBibliography('bibtex')} className="cursor-pointer text-12 py-1.5 px-2 font-mono text-11">
                      BibTeX
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                    <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                    <span>Copy In-text Citation</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 p-1 text-12 shadow-raised-200 select-none max-h-64 overflow-y-auto">
                    {availableStyles.map((style) => (
                      <DropdownMenuItem
                        key={style.id}
                        onClick={() => handleCopyInTextCitation(style.id as CslStyle)}
                        className="cursor-pointer text-12 py-1.5 px-2 truncate"
                      >
                        {style.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuItem
                  onClick={() => handleCopyCitationKey('Copied citation key')}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>Copy Citation Key</span>
                </DropdownMenuItem>

                {canEdit && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      onClick={handleRefreshMetadata}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                    >
                      <RefreshCw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      <span>Update Metadata & PDF</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={handleToggleMyPublications}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                    >
                      <Award className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      <span>
                        {item.isMyPublication
                          ? 'Remove from My Publications'
                          : 'Add to My Publications'}
                      </span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={handleToggleRetraction}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                    >
                      <ShieldAlert className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      <span>
                        {item.isRetracted
                          ? 'Clear Retraction Flag'
                          : 'Flag as Retracted'}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}

                {canEdit && (collections.length > 0 || onDetachFromCollection) && (
                  <>
                    <DropdownMenuSeparator className="my-1" />

                    {collections.length > 0 && (
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                          <FolderPlus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          <span>Add to Collection</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-48 text-12 shadow-raised-200 max-h-56 overflow-y-auto p-1">
                          {collections.map((col: Collection) => (
                            <DropdownMenuItem
                              key={col.id}
                              onClick={() => void handleSelectCollection(col)}
                              className="cursor-pointer truncate text-12 py-1.5 px-2"
                            >
                              {col.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )}

                    {onDetachFromCollection && (
                      <DropdownMenuItem
                        onClick={() => {
                          setIsOpen(false);
                          onDetachFromCollection();
                        }}
                        className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                      >
                        <FolderMinus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                        <span>Remove from Collection</span>
                      </DropdownMenuItem>
                    )}
                  </>
                )}

                {canEdit && onDelete && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setIsOpen(false);
                        onDelete();
                      }}
                      className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
                    >
                      <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
                      <span>Move to Trash</span>
                    </DropdownMenuItem>
                  </>
                )}
              </>
            )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

export default ItemRowActions;
