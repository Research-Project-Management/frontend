'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ExternalLink, Star, Copy, Quote, FolderPlus, FolderMinus, Trash2, RotateCcw, } from 'lucide-react';
import { toast } from 'sonner';
import { cn, copyToClipboard } from '@/shared/lib/utils';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuShortcut, } from '@/shared/components/ui/context-menu';
import { useCitationStyles } from '@/features/library/sdk/queries/citation.queries';
import { useMoveCollectionItemsMutation } from '@/features/library/sdk/queries/collections.queries';
import {
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
} from '@/features/library/core/coordinator/citation-export.coordinator';
import { getCleanStyleLabel } from '@/features/library/domain/citations';
import type { Item, Collection, CslStyle } from '@/features/library/domain/types/library.types';

export interface ItemContextMenuProps {
  children: React.ReactNode;
  item: Item;
  isTrash?: boolean;
  collections?: Collection[];
  onToggleStar?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPurge?: () => void;
  onMoveToCollection?: (collectionId: string) => void;
  onDetachFromCollection?: () => void;
  onOpenItem?: (id: string) => void;
  /** scopeId needed to call setMyPublication (project id or 'user') */
  scopeId?: string;
}

export function ItemContextMenu({
  children,
  item,
  isTrash = false,
  collections = [],
  onToggleStar,
  onDelete,
  onRestore,
  onPurge,
  onMoveToCollection,
  onDetachFromCollection,
  onOpenItem,
  scopeId,
}: ItemContextMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const moveCollectionItemsMutation = useMoveCollectionItemsMutation(scopeId);
  const { data: serverStyles = [] } = useCitationStyles(scopeId, { enabled: isOpen });
  const availableStyles = serverStyles.length > 0
    ? serverStyles.map((s) => ({ id: s.id, label: s.shortTitle || s.name || getCleanStyleLabel(s.id) }))
    : ['apa', 'ieee', 'mla', 'chicago', 'harvard', 'vancouver'].map((id) => ({ id, label: getCleanStyleLabel(id) }));

  const isStarred =
    Boolean(item.isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  const handleCopyBibliography = async (style: CslStyle = 'apa') => {
    const effectiveScope = scopeId || 'user';
    if (style === 'bibtex') {
      await executeExportAllBibtex([item], effectiveScope, 1);
      return;
    }
    await executeCopyMultiCite([item], effectiveScope, style);
  };

  const handleCopyInTextCitation = async (style: CslStyle = 'apa') => {
    await executeCopyInTextCite([item], scopeId || 'user', style);
  };

  return (
    <ContextMenu onOpenChange={setIsOpen}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      {isOpen && (
        <ContextMenuContent className="w-52 text-12 shadow-raised-200 select-none p-1 rounded-md">
          {!isTrash ? (
            <>
              <ContextMenuItem
                onClick={() => {
                  if (onOpenItem) {
                    onOpenItem(item.id);
                  } else {
                    router.push(`/library/papers/${item.id}`);
                  }
                }}
                className="gap-2 text-12 py-1.5 px-2 cursor-pointer"
              >
                <ExternalLink className="size-3.5 text-foreground" />
                Open in Reader
              </ContextMenuItem>

              {onToggleStar && (
                <ContextMenuItem
                  onClick={onToggleStar}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer"
                >
                  <Star
                    className={cn(
                      'size-3.5 text-foreground',
                      isStarred && 'fill-warning text-warning',
                    )}
                  />
                  {isStarred ? 'Remove from Starred' : 'Add to Starred'}
                </ContextMenuItem>
              )}

              <ContextMenuSeparator className="mx-1.5 my-1" />

              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2 text-12 py-1.5 px-2 cursor-pointer">
                  <Copy className="size-3.5 text-foreground" />
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
                  <ContextMenuItem onClick={() => handleCopyBibliography('bibtex')} className="cursor-pointer text-12 py-1.5 px-2 font-mono text-11">
                    BibTeX
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2 text-12 py-1.5 px-2 cursor-pointer">
                  <Quote className="size-3.5 text-foreground" />
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
                onClick={() => {
                  const effectiveCiteKey = item.citationKey?.trim();
                  if (effectiveCiteKey) {
                    copyToClipboard(effectiveCiteKey);
                    toast.success(`Copied: ${effectiveCiteKey}`, { id: 'library-clipboard' });
                  } else {
                    toast.info('Item does not have a citation key', { id: 'library-clipboard' });
                  }
                }}
                className="gap-2 text-12 py-1.5 px-2 cursor-pointer"
              >
                <Copy className="size-3.5 text-foreground" />
                Copy Citation Key
              </ContextMenuItem>

              {(collections.length > 0 || onDetachFromCollection) && (
                <>
                  <ContextMenuSeparator className="mx-1.5 my-1" />

                  {collections.length > 0 && (
                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="gap-2 text-12 py-1.5 px-2 cursor-pointer">
                        <FolderPlus className="size-3.5 text-foreground" />
                        Add to Collection
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-44 text-12 shadow-raised-200 max-h-56 overflow-y-auto p-1">
                        {collections.map((col: Collection) => (
                          <ContextMenuItem
                            key={col.id}
                            onClick={async () => {
                              if (onMoveToCollection) {
                                onMoveToCollection(col.id);
                              } else {
                                try {
                                  await moveCollectionItemsMutation.mutateAsync({
                                    targetCollectionId: col.id,
                                    itemIds: [item.id],
                                  });
                                  toast.success(`Added to "${col.name}"`);
                                } catch (err) {
                                  toast.error('Failed to add to collection', {
                                    description: err instanceof Error ? err.message : String(err),
                                  });
                                }
                              }
                            }}
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
                      className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-foreground focus:text-foreground"
                    >
                      <FolderMinus className="size-3.5 text-foreground" />
                      <span>Remove from Collection</span>
                      <ContextMenuShortcut className="text-11 ml-auto">Del</ContextMenuShortcut>
                    </ContextMenuItem>
                  )}
                </>
              )}

              {onDelete && (
                <>
                  <ContextMenuSeparator className="mx-1.5 my-1" />
                  <ContextMenuItem
                    onClick={onDelete}
                    className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-destructive focus:text-destructive focus:bg-muted"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
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
              {onRestore && (
                <ContextMenuItem
                  onClick={onRestore}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-foreground focus:text-foreground"
                >
                  <RotateCcw className="size-3.5 text-foreground" />
                  Restore Item
                </ContextMenuItem>
              )}

              {onPurge && (
                <>
                  <ContextMenuSeparator className="mx-1.5 my-1" />
                  <ContextMenuItem
                    onClick={onPurge}
                    className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-destructive focus:text-destructive focus:bg-muted"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                    Delete Permanently
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}

export default ItemContextMenu;


