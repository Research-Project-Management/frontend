'use client';

import React, { useState, useCallback } from 'react';
import { MoreVertical, ExternalLink, BookOpen, Star, Copy, Quote, FolderPlus, FolderMinus, Trash2, RotateCcw, RefreshCw, Award, ShieldAlert } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/shared/components/ui/dropdown-menu';
import { useItemActionHandlers } from '@/features/library/core/coordinator/item-action.coordinator';
import type { Item, Collection, CslStyle } from '@/features/library/domain/types/core.types';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuShortcut } from '@/shared/components/ui/context-menu';

export {
  ItemTableHeader,
  type ItemTableHeaderProps,
} from './ItemTableHeader';

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

export interface ItemContextMenuProps {
  children: React.ReactNode;
  item: Item;
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
  /** scopeId needed to call setMyPublication (project id or 'user') */
  scopeId?: string;
}

export function ItemContextMenu({
  children,
  item,
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
  scopeId,
}: ItemContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

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
  });

  if (isTrash && !canEdit) {
    return <>{children}</>;
  }

  return (
    <ContextMenu onOpenChange={setIsOpen}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent
        onClick={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="min-w-[14.5rem] w-max max-w-xs text-12 shadow-raised-200 select-none p-1 rounded-md"
      >
        {!isTrash ? (
          <>
            <ContextMenuItem
              onClick={handleOpen}
              className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              Open in Reader
            </ContextMenuItem>

            <ContextMenuItem
              onClick={handleOpenInNewTab}
              className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap"
            >
              <ExternalLink className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              Open in New Tab
            </ContextMenuItem>

            {canEdit && onToggleStar && (
              <ContextMenuItem
                onClick={onToggleStar}
                className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap"
              >
                <Star
                  className={cn(
                    'size-3.5 text-foreground shrink-0',
                    isStarred && 'fill-warning text-warning',
                  )}
                />
                {isStarred ? 'Remove from Starred' : 'Add to Starred'}
              </ContextMenuItem>
            )}

            <ContextMenuSeparator className="my-1" />

            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap">
                <Copy className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                Copy Citation
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48 text-12 shadow-raised-200 p-1 max-h-64 overflow-y-auto">
                {availableStyles.map((style) => (
                  <ContextMenuItem
                    key={style.id}
                    onClick={() => handleCopyBibliography(style.id as CslStyle)}
                    className="cursor-pointer text-12 py-1.5 px-2 truncate"
                  >
                    {style.label}
                  </ContextMenuItem>
                ))}
                <ContextMenuSeparator className="my-1" />
                <ContextMenuItem
                  onClick={() => handleCopyBibliography('bibtex')}
                  className="cursor-pointer text-12 py-1.5 px-2 font-mono text-11"
                >
                  BibTeX
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap">
                <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                Copy In-text Citation
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48 text-12 shadow-raised-200 p-1 max-h-64 overflow-y-auto">
                {availableStyles.map((style) => (
                  <ContextMenuItem
                    key={style.id}
                    onClick={() => handleCopyInTextCitation(style.id as CslStyle)}
                    className="cursor-pointer text-12 py-1.5 px-2 truncate"
                  >
                    {style.label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>

            <ContextMenuItem
              onClick={() => handleCopyCitationKey('Copied')}
              className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap"
            >
              <Copy className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              Copy Citation Key
            </ContextMenuItem>

            {canEdit && (
              <>
                <ContextMenuSeparator className="my-1" />
                <ContextMenuItem
                  onClick={handleRefreshMetadata}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  Update Metadata & PDF
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={handleToggleMyPublications}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap"
                >
                  <Award className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  {item.isMyPublication
                    ? 'Remove from My Publications'
                    : 'Add to My Publications'}
                </ContextMenuItem>

                <ContextMenuItem
                  onClick={handleToggleRetraction}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap"
                >
                  <ShieldAlert className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  {item.isRetracted
                    ? 'Clear Retraction Flag'
                    : 'Flag as Retracted'}
                </ContextMenuItem>
              </>
            )}

            {canEdit && (collections.length > 0 || onDetachFromCollection) && (
              <>
                <ContextMenuSeparator className="my-1" />

                {collections.length > 0 && (
                  <ContextMenuSub>
                    <ContextMenuSubTrigger className="gap-2 text-12 py-1.5 px-2 cursor-pointer whitespace-nowrap">
                      <FolderPlus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                      Add to Collection
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent className="w-44 text-12 shadow-raised-200 max-h-56 overflow-y-auto p-1">
                      {collections.map((col: Collection) => (
                        <ContextMenuItem
                          key={col.id}
                          onClick={() => void handleSelectCollection(col)}
                          className="cursor-pointer truncate text-12 py-1.5 px-2"
                        >
                          {col.name}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )}

                {onDetachFromCollection && (
                  <ContextMenuItem
                    onClick={onDetachFromCollection}
                    className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-foreground focus:text-foreground whitespace-nowrap"
                  >
                    <FolderMinus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                    <span>Remove from Collection</span>
                    <ContextMenuShortcut className="text-11 ml-auto">Del</ContextMenuShortcut>
                  </ContextMenuItem>
                )}
              </>
            )}

            {canEdit && onDelete && (
              <>
                <ContextMenuSeparator className="my-1" />
                <ContextMenuItem
                  onClick={onDelete}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-destructive focus:text-destructive focus:bg-muted whitespace-nowrap"
                >
                  <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
                  <span>Move to Trash</span>
                  <ContextMenuShortcut className="text-11 ml-auto">
                    {onDetachFromCollection ? 'Shift+Del' : 'Del'}
                  </ContextMenuShortcut>
                </ContextMenuItem>
              </>
            )}
          </>
        ) : (
          <>
            {canEdit && onRestore && (
              <ContextMenuItem
                onClick={onRestore}
                className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-foreground focus:text-foreground whitespace-nowrap"
              >
                <RotateCcw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                Restore Item
              </ContextMenuItem>
            )}

            {canEdit && onPurge && (
              <>
                {canEdit && onRestore && <ContextMenuSeparator className="my-1" />}
                <ContextMenuItem
                  onClick={onPurge}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-destructive focus:text-destructive focus:bg-muted whitespace-nowrap"
                >
                  <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
                  Delete Permanently
                </ContextMenuItem>
              </>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
