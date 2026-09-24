'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ExternalLink,
  PanelRight,
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
  ContextMenuShortcut,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/shared/components/ui';
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
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const openModal = useLibraryUIStore((s) => s.openModal);

  const isStarred =
    Boolean((item as any).isStarred) ||
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
      const text = res.inText || (res as any).citation || '';
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

      <ContextMenuContent className="w-60 text-13 shadow-raised-200 select-none">
        {!isTrash ? (
          <>
            <ContextMenuItem
              onClick={() => router.push(`/library/papers/${item.id}${qParam}`)}
              className="gap-2 text-13 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5 text-foreground" />
              Open in Reader
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => setActiveItem(item.id)}
              className="gap-2 text-13 cursor-pointer"
            >
              <PanelRight className="h-3.5 w-3.5 text-foreground" />
              View Details (Inspector)
            </ContextMenuItem>

            <ContextMenuSeparator />

            {onToggleStar && (
              <ContextMenuItem
                onClick={onToggleStar}
                className="gap-2 text-13 cursor-pointer"
              >
                <Star
                  className={cn(
                    'h-3.5 w-3.5 text-foreground',
                    isStarred && 'fill-current',
                  )}
                />
                {isStarred ? 'Remove from Starred' : 'Add to Starred'}
              </ContextMenuItem>
            )}

            <ContextMenuItem
              onClick={handleCopyBibliography}
              className="gap-2 text-13 cursor-pointer justify-between"
            >
              <div className="flex items-center gap-2">
                <Copy className="h-3.5 w-3.5 text-foreground" />
                <span>Copy Bibliography</span>
              </div>
              <ContextMenuShortcut>{isMac ? '⌘⇧C' : 'Ctrl+Shift+C'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={handleCopyInTextCitation}
              className="gap-2 text-13 cursor-pointer justify-between"
            >
              <div className="flex items-center gap-2">
                <Quote className="h-3.5 w-3.5 text-foreground" />
                <span>Copy In-text Citation</span>
              </div>
              <ContextMenuShortcut>{isMac ? '⌘⇧A' : 'Ctrl+Shift+A'}</ContextMenuShortcut>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => {
                if (item.citationKey) {
                  copyToClipboard(item.citationKey);
                  toast.success(`Copied: ${item.citationKey}`);
                } else {
                  toast.info('Item does not have a citation key');
                }
              }}
              className="gap-2 text-13 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Copy Citation Key
            </ContextMenuItem>

            <ContextMenuSeparator />

            {collections.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2 text-13 cursor-pointer">
                  <FolderPlus className="h-3.5 w-3.5 text-foreground" />
                  Add to Collection
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48 text-13 shadow-raised-200 max-h-56 overflow-y-auto">
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
                      className="cursor-pointer truncate text-13"
                    >
                      {col.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            <ContextMenuSeparator />

            {onDetachFromCollection && (
              <ContextMenuItem
                onClick={onDetachFromCollection}
                className="gap-2 text-13 cursor-pointer text-foreground focus:text-foreground justify-between"
              >
                <div className="flex items-center gap-2">
                  <FolderMinus className="h-3.5 w-3.5 text-foreground" />
                  <span>Remove from Collection</span>
                </div>
                <ContextMenuShortcut>{isMac ? '⌫' : 'Del'}</ContextMenuShortcut>
              </ContextMenuItem>
            )}

            {onDelete && (
              <ContextMenuItem
                onClick={onDelete}
                className="gap-2 text-13 cursor-pointer text-foreground focus:text-foreground justify-between"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="h-3.5 w-3.5 text-foreground" />
                  <span>Move to Trash</span>
                </div>
                {onDetachFromCollection && (
                  <ContextMenuShortcut>{isMac ? '⇧⌫' : 'Shift+Del'}</ContextMenuShortcut>
                )}
              </ContextMenuItem>
            )}
          </>
        ) : (
          <>
            {onRestore && (
              <ContextMenuItem
                onClick={onRestore}
                className="gap-2 text-13 cursor-pointer text-foreground focus:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5 text-foreground" />
                Restore Item
              </ContextMenuItem>
            )}

            <ContextMenuSeparator />

            {onPurge && (
              <ContextMenuItem
                onClick={onPurge}
                className="gap-2 text-13 cursor-pointer text-foreground focus:text-foreground"
              >
                <Trash2 className="h-3.5 w-3.5 text-foreground" />
                Delete Permanently
              </ContextMenuItem>
            )}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default ItemContextMenu;
