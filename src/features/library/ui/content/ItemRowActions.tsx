'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreVertical,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useCitationStyles } from '@/features/library/sdk/queries/citation.queries';
import { useMoveCollectionItemsMutation } from '@/features/library/sdk/queries/collections.queries';
import {
  executeCopyMultiCite,
  executeCopyInTextCite,
  executeExportAllBibtex,
} from '@/features/library/core/coordinator/citation-export.coordinator';
import { getCleanStyleLabel } from '@/features/library/domain/citations';
import type { Item, Collection, CslStyle } from '@/features/library/domain/types/library.types';

export interface ItemRowActionsProps {
  item: Item;
  scopeId?: string;
  isTrash?: boolean;
  collections?: Collection[];
  onToggleStar?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onPurge?: () => void;
  onMoveToCollection?: (collectionId: string) => void;
  onDetachFromCollection?: () => void;
  onOpenItem?: (id: string) => void;
}

export const ItemRowActions = React.memo(function ItemRowActions({
  item,
  scopeId,
  isTrash = false,
  collections = [],
  onToggleStar,
  onDelete,
  onRestore,
  onPurge,
  onMoveToCollection,
  onDetachFromCollection,
  onOpenItem,
}: ItemRowActionsProps) {
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

  const handleOpen = () => {
    setIsOpen(false);
    if (onOpenItem) {
      onOpenItem(item.id);
    } else {
      router.push(`/library/papers/${item.id}`);
    }
  };

  const handleCopyBibliography = async (style: CslStyle = 'apa') => {
    setIsOpen(false);
    const effectiveScope = scopeId || 'user';
    if (style === 'bibtex') {
      await executeExportAllBibtex([item], effectiveScope, 1);
      return;
    }
    await executeCopyMultiCite([item], effectiveScope, style);
  };

  const handleCopyInTextCitation = async (style: CslStyle = 'apa') => {
    setIsOpen(false);
    await executeCopyInTextCite([item], scopeId || 'user', style);
  };

  const handleCopyCitationKey = () => {
    setIsOpen(false);
    const effectiveCiteKey = item.citationKey?.trim();
    if (effectiveCiteKey) {
      copyToClipboard(effectiveCiteKey);
      toast.success(`Copied citation key: ${effectiveCiteKey}`, { id: 'library-clipboard' });
    } else {
      toast.info('Item does not have a citation key', { id: 'library-clipboard' });
    }
  };

  return (
    <div
      className={cn(
        'flex items-center justify-end transition-opacity duration-150',
        isOpen
          ? 'opacity-100'
          : 'opacity-0 max-md:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100',
      )}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
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

        {isOpen && (
          <DropdownMenuContent
            side="bottom"
            align="end"
            sideOffset={4}
            collisionPadding={12}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="w-52 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {isTrash ? (
              <>
                {onRestore && (
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

                {onPurge && onRestore && <DropdownMenuSeparator className="my-1" />}

                {onPurge && (
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
                  <ExternalLink className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>Open in Reader</span>
                </DropdownMenuItem>

                {onToggleStar && (
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

                <DropdownMenuSeparator className="mx-1 my-1" />

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
                  onClick={handleCopyCitationKey}
                  className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>Copy Citation Key</span>
                </DropdownMenuItem>

                {(collections.length > 0 || onDetachFromCollection) && (
                  <>
                    <DropdownMenuSeparator className="mx-1 my-1" />

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
                              onClick={async () => {
                                setIsOpen(false);
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

                {onDelete && (
                  <>
                    <DropdownMenuSeparator className="mx-1 my-1" />
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
        )}
      </DropdownMenu>
    </div>
  );
});

export default ItemRowActions;
