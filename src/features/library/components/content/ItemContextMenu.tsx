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
  ContextMenuShortcut,
} from '@/shared/components/ui/context-menu';
import { libraryServices } from '../../data';
import { useLibraryUIStore } from '../../store';
import type { Item, Collection, CslStyle } from '../../types';

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

  const handleCopyBibliography = async (style: CslStyle = 'apa') => {
    const toastId = toast.loading(`Đang tạo trích dẫn (${style.toUpperCase()})...`);
    try {
      const res = await libraryServices.citations.formatCitation(scopeId, item.id, style);
      const text = res.bibliography || res.inText || '';
      if (text) {
        await copyToClipboard(text);
        toast.success(`Đã sao chép trích dẫn (${style.toUpperCase()})`, { id: toastId });
      } else {
        toast.error('Không thể tạo trích dẫn', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Sao chép trích dẫn thất bại', { description: err?.message, id: toastId });
    }
  };

  const handleCopyInTextCitation = async (style: CslStyle = 'apa') => {
    const toastId = toast.loading(`Đang tạo trích dẫn trong bài (${style.toUpperCase()})...`);
    try {
      const res = await libraryServices.citations.formatCitation(scopeId, item.id, style);
      const text = res.inText || (res as any).citation || '';
      if (text) {
        await copyToClipboard(text);
        toast.success(`Đã sao chép trích dẫn trong bài (${style.toUpperCase()})`, { id: toastId });
      } else {
        toast.error('Không thể tạo trích dẫn trong bài', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Sao chép trích dẫn thất bại', { description: err?.message, id: toastId });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-52 text-12 shadow-raised-200 select-none p-1 rounded-md">
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
              <ContextMenuSubContent className="w-48 text-12 shadow-raised-200 p-1">
                <ContextMenuItem onClick={() => handleCopyBibliography('apa')} className="cursor-pointer text-12 py-1.5 px-2">
                  APA (7th Edition)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyBibliography('ieee')} className="cursor-pointer text-12 py-1.5 px-2">
                  IEEE
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyBibliography('mla')} className="cursor-pointer text-12 py-1.5 px-2">
                  MLA (9th Edition)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyBibliography('chicago')} className="cursor-pointer text-12 py-1.5 px-2">
                  Chicago (Author-Date)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyBibliography('harvard')} className="cursor-pointer text-12 py-1.5 px-2">
                  Harvard
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyBibliography('vancouver')} className="cursor-pointer text-12 py-1.5 px-2">
                  Vancouver
                </ContextMenuItem>
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
              <ContextMenuSubContent className="w-48 text-12 shadow-raised-200 p-1">
                <ContextMenuItem onClick={() => handleCopyInTextCitation('apa')} className="cursor-pointer text-12 py-1.5 px-2">
                  APA (e.g. Nguyễn, 2023)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyInTextCitation('ieee')} className="cursor-pointer text-12 py-1.5 px-2">
                  IEEE (e.g. [1])
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyInTextCitation('mla')} className="cursor-pointer text-12 py-1.5 px-2">
                  MLA (e.g. Nguyễn 12)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyInTextCitation('chicago')} className="cursor-pointer text-12 py-1.5 px-2">
                  Chicago (Author-Date)
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyInTextCitation('harvard')} className="cursor-pointer text-12 py-1.5 px-2">
                  Harvard
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>

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
    </ContextMenu>
  );
}

export default ItemContextMenu;
