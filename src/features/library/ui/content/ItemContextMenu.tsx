'use client';

import React, { useState } from 'react';
import {
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
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
} from '@/shared/components/ui/context-menu';
import { useItemActionHandlers } from '@/features/library/core/coordinator/item-action.coordinator';
import type { Item, Collection, CslStyle } from '@/features/library/domain/types/library.types';

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

export default ItemContextMenu;
