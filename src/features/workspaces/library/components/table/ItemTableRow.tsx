'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Trash2,
  BookOpen,
  Folder,
  FolderInput,
  Library,
  MoreVertical,
  Quote,
  RotateCcw,
} from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/shared/components/ui/context-menu';
import { cn } from '@/shared/lib/utils';
import { normalizeAuthors } from '../../utils/library.util';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import type { CatalogItem, Collection } from '../../types/library.types';

interface PaperTableRowProps {
  item?: CatalogItem;
  paper?: CatalogItem;
  collection?: Collection | null;
  collections?: Collection[];
  isSelected: boolean;
  isActive: boolean;
  showCollection?: boolean;
  showLastRead?: boolean;
  isTrash?: boolean;
  onSelect: (item: CatalogItem) => void;
  onToggleCheck: (paperId: string, e: React.MouseEvent) => void;
  onDelete: (paperId: string) => void;
  onRestore?: (paperId: string) => void;
  onPurge?: (paperId: string) => void;
  onMove?: (targetCollectionId: string | null) => void;
}

function formatLastReadDate(dateString?: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export default function ItemTableRow({
  item,
  paper: paperProp,
  collection,
  collections = [],
  isSelected,
  isActive,
  showCollection = true,
  showLastRead = false,
  isTrash = false,
  onSelect,
  onToggleCheck,
  onDelete,
  onRestore,
  onPurge,
  onMove,
}: PaperTableRowProps) {
  const paper = item || paperProp || ({} as CatalogItem);
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams();
  const pId = paper.id || '';

  const handleDoubleClick = () => {
    if (pId) {
      router.push(`/${workspaceUrl}/library/papers/${pId}`);
    } else {
      onSelect(paper);
    }
  };

  const hasFile = Boolean(paper.fileUrl || (paper as any)?.primaryFile?.url);
  const isRawArxiv = /^\d{4}\.\d{4,5}(v\d+)?$/i.test(paper.title || '');
  const authors = normalizeAuthors(
    paper.authors,
    (paper as any).creators,
    (paper as any).contributors,
  );
  const authorDisplay =
    authors.length > 0
      ? authors.length === 1
        ? authors[0]
        : authors.length === 2
        ? `${authors[0]} & ${authors[1]}`
        : `${authors[0]} et al.`
      : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr
          role="row"
          tabIndex={0}
          aria-selected={isSelected || isActive}
          onClick={() => onSelect(paper)}
          onDoubleClick={handleDoubleClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSelect(paper);
            } else if (e.key === ' ') {
              e.preventDefault();
              onToggleCheck(pId, e as any);
            }
          }}
          className={cn(
            'group border-b border-border/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring cursor-pointer select-none font-sans text-[13px] tracking-[-0.005em] h-9',
            isActive && 'bg-muted/60',
            isSelected && !isActive && 'bg-muted/30'
          )}
        >
          {/* Checkbox column */}
          <td className="w-10 px-2.5 py-1.5 text-center align-middle" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center">
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => onToggleCheck(pId, e)}
                      aria-label={`Select ${paper.title}`}
                      className="size-3.5 rounded-md border-border cursor-pointer data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6} className="text-[11px] font-normal px-2 py-0.5 rounded-md shadow-sm border border-border/80 bg-popover text-foreground">
                  {isSelected ? 'Deselect item' : 'Select item'}
                </TooltipContent>
              </Tooltip>
            </div>
          </td>

          {/* Title Column (with collection tag) */}
          <td className="px-3 py-1.5 align-middle min-w-[240px] flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  'truncate font-normal text-foreground text-[13px] tracking-[-0.005em]',
                  isRawArxiv && 'font-mono text-xs'
                )}
                title={paper.title}
              >
                {paper.title || 'Untitled Item'}
              </span>
              {showCollection && collection && (
                <span
                  className="hidden sm:inline-flex items-center gap-1 text-[11px] font-normal px-1.5 py-0.5 text-muted-foreground bg-muted/40 rounded-sm shrink-0 border border-border/40 truncate max-w-[120px]"
                  title={`In collection: ${collection.name}`}
                >
                  <Folder className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{collection.name}</span>
                </span>
              )}
              {Boolean(paper.citationCount && Number(paper.citationCount) > 0) && (
                <span
                  className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono tabular-nums px-1.5 py-0.5 text-muted-foreground bg-muted/40 rounded-sm shrink-0 border border-border/40 select-none"
                  title={`${new Intl.NumberFormat('en-US').format(Number(paper.citationCount))} citations (via OpenAlex)`}
                >
                  <Quote className="size-2.5 text-muted-foreground" />
                  <span>
                    {Number(paper.citationCount) >= 1000
                      ? `${(Number(paper.citationCount) / 1000).toFixed(1)}k`
                      : paper.citationCount}
                  </span>
                </span>
              )}
            </div>
          </td>

          {/* Authors / Creator Column */}
          <td className="px-3 py-1.5 align-middle w-[240px] max-w-[320px]">
            <span
              className="truncate block text-foreground font-normal text-[13px] tracking-[-0.005em]"
              title={paper.authors?.join(', ')}
            >
              {authorDisplay ? (
                authorDisplay
              ) : (
                <span className="text-muted-foreground font-sans">&mdash;</span>
              )}
            </span>
          </td>

          {/* Last Read Column */}
          {showLastRead && (
            <td className="px-3 py-1.5 align-middle w-[200px] max-w-[240px]">
              <span
                className="truncate block text-muted-foreground font-normal text-[13px] font-mono tabular-nums"
                title={paper.lastReadAt || paper.accessedAt || paper.updatedAt || paper.createdAt || ''}
              >
                {formatLastReadDate(paper.lastReadAt || paper.accessedAt || paper.updatedAt || paper.createdAt)}
              </span>
            </td>
          )}

          <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
              <DropdownMenu>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer outline-none touch-manipulation"
                        aria-label="More actions"
                      >
                        <MoreVertical className="size-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="text-[11px] font-normal px-2 py-0.5 rounded-md shadow-sm border border-border/80 bg-popover text-foreground">
                    More actions
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" sideOffset={4} className="w-52 p-1.5 rounded-md border border-border/60 bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                  <DropdownMenuItem
                    onClick={handleDoubleClick}
                    className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                  >
                    <BookOpen className="size-4 text-foreground shrink-0" />
                    <span>Open in reader</span>
                  </DropdownMenuItem>

                  {isTrash ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => onRestore?.(pId)}
                        className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                      >
                        <RotateCcw className="size-4 text-foreground shrink-0" />
                        <span>Restore item</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => onPurge?.(pId)}
                        className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                      >
                        <Trash2 className="size-4 text-foreground shrink-0" />
                        <span>Delete permanently</span>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      {onMove && collections && collections.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none">
                            <FolderInput className="size-4 text-foreground shrink-0" />
                            <span>Move to collection</span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-48 p-1.5 rounded-md border border-border/60 bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                            <DropdownMenuItem
                              onClick={() => onMove(null)}
                              className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                            >
                              <Library className="size-4 text-foreground shrink-0" />
                              <span>My Library</span>
                            </DropdownMenuItem>
                            {collections.map((col) => (
                              <DropdownMenuItem
                                key={col.id}
                                onClick={() => onMove(col.id)}
                                className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                              >
                                <Folder className="size-4 text-foreground shrink-0" />
                                <span className="truncate">{col.name}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      <DropdownMenuItem
                        onClick={() => onDelete(pId)}
                        className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-accent focus:bg-accent outline-none"
                      >
                        <Trash2 className="size-4 text-foreground shrink-0" />
                        <span>Move to trash</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </td>
        </tr>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48 p-1 rounded-md border border-border/60 bg-popover text-popover-foreground z-50 text-xs shadow-none space-y-0.5">
        <ContextMenuItem onClick={handleDoubleClick} className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted outline-none">
          <BookOpen className="size-4 text-foreground shrink-0" />
          <span>Open in reader</span>
        </ContextMenuItem>

        {isTrash ? (
          <>
            <ContextMenuItem
              onClick={() => onRestore?.(pId)}
              className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted outline-none"
            >
              <RotateCcw className="size-4 text-foreground shrink-0" />
              <span>Restore item</span>
            </ContextMenuItem>

            <ContextMenuItem
              onClick={() => onPurge?.(pId)}
              className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted outline-none"
            >
              <Trash2 className="size-4 text-foreground shrink-0" />
              <span>Delete permanently</span>
            </ContextMenuItem>
          </>
        ) : (
          <>
            {onMove && collections && collections.length > 0 && (
              <ContextMenuSub>
                <ContextMenuSubTrigger className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted outline-none">
                  <FolderInput className="size-4 text-foreground shrink-0" />
                  <span>Move to collection</span>
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48 p-1.5 rounded-md border border-border/60 bg-popover text-popover-foreground z-50 shadow-none space-y-0.5">
                  <ContextMenuItem
                    onClick={() => onMove(null)}
                    className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted outline-none"
                  >
                    <Library className="size-4 text-foreground shrink-0" />
                    <span>My Library</span>
                  </ContextMenuItem>
                  {collections.map((col) => (
                    <ContextMenuItem
                      key={col.id}
                      onClick={() => onMove(col.id)}
                      className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted outline-none"
                    >
                      <Folder className="size-4 text-foreground shrink-0" />
                      <span className="truncate">{col.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            )}

            <ContextMenuItem
              onClick={() => onDelete(pId)}
              className="h-8.5 gap-2.5 px-2.5 text-xs font-normal whitespace-nowrap cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted outline-none"
            >
              <Trash2 className="size-4 text-foreground shrink-0" />
              <span>Move to trash</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}


