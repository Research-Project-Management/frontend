'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ExternalLink,
  Star,
  Copy,
  Quote,
  FolderPlus,
  FolderMinus,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, copyToClipboard } from '@/shared/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/shared/components/ui/context-menu';
import { CitationService } from '../../data';
import { useLibraryUIStore } from '../../store';
import type { Item, Collection } from '../../types';

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
  scopeId,
}: ItemContextMenuProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get('q');
  const currentProjectId = searchParams.get('projectId');
  const queryParts = [
    currentProjectId ? `projectId=${encodeURIComponent(currentProjectId)}` : '',
    currentQuery ? `q=${encodeURIComponent(currentQuery)}` : '',
  ].filter(Boolean);
  const qParam = queryParts.length ? `?${queryParts.join('&')}` : '';
  const openModal = useLibraryUIStore((s) => s.openModal);

  const isStarred =
    Boolean(item.isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  const handleCopyBibliography = async () => {
    try {
      const res = await CitationService.formatCitation(undefined, item.id, 'apa');
      const text = res.bibliography || res.inText || '';
      if (text) {
        await copyToClipboard(text);
        toast.success('Copied bibliography (APA) to clipboard');
      } else {
        toast.error('Unable to generate bibliography');
      }
    } catch (err: any) {
      toast.error('Citation copy failed', { description: err?.message });
    }
  };

  const handleCopyInTextCitation = async () => {
    try {
      const res = await CitationService.formatCitation(undefined, item.id, 'apa');
      const text = res.inText || res.citation || '';
      if (text) {
        await copyToClipboard(text);
        toast.success('Copied in-text citation to clipboard');
      } else {
        toast.error('Unable to generate in-text citation');
      }
    } catch (err: any) {
      toast.error('Citation copy failed', { description: err?.message });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-48 text-12 shadow-raised-200 select-none p-1 rounded-md">
        {!isTrash ? (
          <>
            <ContextMenuItem
              onClick={() => router.push(`/library/papers/${item.id}${qParam}`)}
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
                    isStarred && 'fill-amber-400 text-amber-400',
                  )}
                />
                {isStarred ? 'Remove from Starred' : 'Add to Starred'}
              </ContextMenuItem>
            )}

            <ContextMenuSeparator className="mx-1.5 my-1" />

            <ContextMenuItem
              onClick={handleCopyBibliography}
              className="gap-2 text-12 py-1.5 px-2 cursor-pointer"
            >
              <Copy className="size-3.5 text-foreground" />
              Copy Citation
            </ContextMenuItem>

            <ContextMenuItem
              onClick={handleCopyInTextCitation}
              className="gap-2 text-12 py-1.5 px-2 cursor-pointer"
            >
              <Quote className="size-3.5 text-foreground" />
              Copy In-text Citation
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => {
                if (item.citationKey) {
                  copyToClipboard(item.citationKey);
                  toast.success(`Copied: ${item.citationKey}`, { id: 'library-clipboard' });
                } else {
                  toast.info('Item does not have a citation key', { id: 'library-clipboard' });
                }
              }}
              className="gap-2 text-12 py-1.5 px-2 cursor-pointer"
            >
              <Copy className="size-3.5 text-muted-foreground" />
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
                      {collections.map((col: any) => (
                        <ContextMenuItem
                          key={col.id}
                          onClick={() => {
                            if (onMoveToCollection) {
                              onMoveToCollection(col.id);
                            } else {
                              openModal('CREATE_COLLECTION', { parentId: col.id });
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
                    Remove from Collection
                  </ContextMenuItem>
                )}
              </>
            )}

            {onDelete && (
              <>
                <ContextMenuSeparator className="mx-1.5 my-1" />
                <ContextMenuItem
                  onClick={onDelete}
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                  Move to Trash
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
                  className="gap-2 text-12 py-1.5 px-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="size-3.5 text-destructive" />
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
