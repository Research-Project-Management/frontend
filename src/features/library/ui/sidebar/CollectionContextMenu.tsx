'use client';

import { useState, useMemo } from 'react';
import {
  FolderPlus,
  FolderOutput,
  FolderMinus,
  MoreVertical,
  Pencil,
  Trash2,
  Folder,
  Library,
  Copy,
  FileCode,
  FileJson,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/shared/components/ui/dropdown-menu';
import type { TreeNode } from './sidebar.types';
import type { Collection } from '@/features/library/domain/types/library.types';
import { getValidMoveTargets } from '@/features/library/domain/collection-tree';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { executeExportCollectionFormat } from '@/features/library/core/coordinator/citation-export.coordinator';

interface CollectionContextMenuProps {
  node: TreeNode;
  allCollections?: Collection[];
  validMoveTargets?: Collection[];
  canManageCollections?: boolean;
  onCreateSub: (parentId: string, parentName: string) => void;
  onStartRename: (id: string, name: string) => void;
  onMove: (collectionId: string, newParentId: string | null) => void;
  onCopy: (collectionId: string, targetParentId: string | null) => void;
  onExportBibtex?: (id: string, name: string) => void;
  onExportBundle?: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDeleteWithItems: (id: string) => void;
}

export function CollectionContextMenu({
  node,
  allCollections = [],
  validMoveTargets: propValidMoveTargets,
  canManageCollections = true,
  onCreateSub,
  onStartRename,
  onMove,
  onCopy,
  onExportBibtex,
  onExportBundle,
  onDelete,
  onDeleteWithItems,
}: CollectionContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isProjectScope = activeScope.type === 'project';
  const rootLibraryName = isProjectScope ? (activeScope.name || 'Project') : 'My Library';

  const validMoveTargets = useMemo(() => {
    if (propValidMoveTargets) return propValidMoveTargets;
    if (!isOpen || allCollections.length === 0) return [];
    return getValidMoveTargets(allCollections, node.id);
  }, [isOpen, propValidMoveTargets, allCollections, node.id]);
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground opacity-0 max-md:opacity-100 group-hover/node:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-background data-[state=open]:border-border data-[state=open]:text-foreground focus-visible:opacity-100 border border-transparent hover:border-border/50 hover:bg-background transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-2 md:before:hidden"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Options for ${node.name}`}
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
        className="w-64 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
      >
        {canManageCollections && (
          <>
            <DropdownMenuItem
              onClick={() => onCreateSub(node.id, node.name)}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>New Subcollection</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => onStartRename(node.id, node.name)}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Rename Collection</span>
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                <FolderOutput className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span>Move to</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-13 shadow-raised-200 space-y-0.5 select-none">
                <DropdownMenuItem
                  onClick={() => onMove(node.id, null)}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  {isProjectScope ? (
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  ) : (
                    <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  )}
                  <span>{rootLibraryName}</span>
                </DropdownMenuItem>
                {validMoveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onClick={() => onMove(node.id, target.id)}
                    className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                  >
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{target.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span>Copy to</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-13 shadow-raised-200 space-y-0.5 select-none">
                <DropdownMenuItem
                  onClick={() => onCopy(node.id, null)}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  {isProjectScope ? (
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  ) : (
                    <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  )}
                  <span>{rootLibraryName}</span>
                </DropdownMenuItem>
                {validMoveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onClick={() => onCopy(node.id, target.id)}
                    className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                  >
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{target.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          onClick={() => onExportBibtex?.(node.id, node.name)}
        >
          <FileCode className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Export BibTeX (.bib)</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          onClick={() => onExportBundle?.(node.id, node.name)}
        >
          <FileJson className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Export Bundle (.json)</span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
            <FileCode className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>More Export Formats</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-13 shadow-raised-200 space-y-0.5 select-none">
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  isProjectScope ? activeScope.id : 'user',
                  'ris',
                )
              }
            >
              <span>Export RIS (.ris)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  isProjectScope ? activeScope.id : 'user',
                  'csl_json',
                )
              }
            >
              <span>Export CSL-JSON (.json)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  isProjectScope ? activeScope.id : 'user',
                  'csv',
                )
              }
            >
              <span>Export CSV (.csv)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  isProjectScope ? activeScope.id : 'user',
                  'markdown',
                )
              }
            >
              <span>Export Markdown (.md)</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {canManageCollections && (
          <>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              onClick={() => onDelete(node.id)}
            >
              <FolderMinus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Delete Collection</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              onClick={() => onDeleteWithItems(node.id)}
            >
              <Trash2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Delete Collection and Items</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

