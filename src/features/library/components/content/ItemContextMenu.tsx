'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ExternalLink,
  PanelRight,
  Star,
  Copy,
  FolderPlus,
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
} from '@/shared/components/ui';
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
}: ItemContextMenuProps) {
  const router = useRouter();
  const setActiveItem = useLibraryUIStore((s) => s.setActiveItem);
  const openModal = useLibraryUIStore((s) => s.openModal);

  const isStarred =
    Boolean((item as any).isStarred) ||
    Boolean(typeof item.rating === 'number' && item.rating > 0);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-56 text-xs select-none">
        {!isTrash ? (
          <>
            <ContextMenuItem
              onClick={() => router.push(`/reader?itemId=${item.id}`)}
              className="gap-2 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              Open in Reader
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => setActiveItem(item.id)}
              className="gap-2 cursor-pointer"
            >
              <PanelRight className="h-3.5 w-3.5 text-muted-foreground" />
              View Details (Inspector)
            </ContextMenuItem>

            <ContextMenuSeparator />

            {onToggleStar && (
              <ContextMenuItem
                onClick={onToggleStar}
                className="gap-2 cursor-pointer"
              >
                <Star
                  className={cn(
                    'h-3.5 w-3.5',
                    isStarred
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-muted-foreground',
                  )}
                />
                {isStarred ? 'Remove from Starred' : 'Add to Starred'}
              </ContextMenuItem>
            )}

            <ContextMenuItem
              onClick={() => {
                if (item.citationKey) {
                  copyToClipboard(item.citationKey);
                  toast.success(`Copied: ${item.citationKey}`);
                } else {
                  toast.info('Item does not have a citation key');
                }
              }}
              className="gap-2 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              Copy Citation Key
            </ContextMenuItem>

            <ContextMenuSeparator />

            {collections.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger className="gap-2 cursor-pointer">
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  Add to Collection
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48 text-xs max-h-56 overflow-y-auto">
                  {collections.map((col: any) => (
                    <ContextMenuItem
                      key={col.id}
                      onClick={() => {
                        openModal('CREATE_COLLECTION', { parentId: col.id });
                      }}
                      className="cursor-pointer truncate"
                    >
                      {col.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            <ContextMenuSeparator />

            {onDelete && (
              <ContextMenuItem
                onClick={onDelete}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Move to Trash
              </ContextMenuItem>
            )}
          </>
        ) : (
          <>
            {onRestore && (
              <ContextMenuItem
                onClick={onRestore}
                className="gap-2 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                Restore Item
              </ContextMenuItem>
            )}

            <ContextMenuSeparator />

            {onPurge && (
              <ContextMenuItem
                onClick={onPurge}
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
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
