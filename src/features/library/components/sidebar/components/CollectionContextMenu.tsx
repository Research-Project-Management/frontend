'use client';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/shared/components/ui";
import type { TreeNode } from '../types';
import type { Collection } from '@/features/library/types/library.types';

interface CollectionContextMenuProps {
  node: TreeNode;
  validMoveTargets: Collection[];
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
  validMoveTargets,
  onCreateSub,
  onStartRename,
  onMove,
  onCopy,
  onExportBibtex,
  onExportBundle,
  onDelete,
  onDeleteWithItems,
}: CollectionContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-foreground opacity-0 group-hover/node:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-sidebar-accent transition-opacity hover:transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Options for ${node.name}`}
        >
          <MoreVertical className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
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
        <DropdownMenuItem
          onClick={() => onCreateSub(node.id, node.name)}
          className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>New Subcollection</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onStartRename(node.id, node.name)}
          className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Rename Collection</span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary">
            <FolderOutput className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Move to</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-xs shadow-raised-200 space-y-0.5 select-none">
            <DropdownMenuItem
              onClick={() => onMove(node.id, null)}
              className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>My Library</span>
            </DropdownMenuItem>
            {validMoveTargets.map((target) => (
              <DropdownMenuItem
                key={target.id}
                onClick={() => onMove(node.id, target.id)}
                className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span className="truncate">{target.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary">
            <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Copy to</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-xs shadow-raised-200 space-y-0.5 select-none">
            <DropdownMenuItem
              onClick={() => onCopy(node.id, null)}
              className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>My Library</span>
            </DropdownMenuItem>
            {validMoveTargets.map((target) => (
              <DropdownMenuItem
                key={target.id}
                onClick={() => onCopy(node.id, target.id)}
                className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span className="truncate">{target.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={() => onExportBibtex?.(node.id, node.name)}
        >
          <FileCode className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Export BibTeX (.bib)</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={() => onExportBundle?.(node.id, node.name)}
        >
          <FileJson className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Export Bundle (.json)</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={() => onDelete(node.id)}
        >
          <FolderMinus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Delete Collection</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-12 font-normal whitespace-nowrap cursor-pointer text-destructive rounded-md hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive outline-none focus-visible:ring-1 focus-visible:ring-destructive"
          onClick={() => onDeleteWithItems(node.id)}
        >
          <Trash2 className="size-4 text-destructive shrink-0" strokeWidth={1.5} />
          <span>Delete Collection and Items</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
