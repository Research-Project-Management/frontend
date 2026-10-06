'use client';

import React from 'react';
import {
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import type { SavedSearch } from '../../types/saved-searches.types';

export interface SavedSearchContextMenuProps {
  savedSearch: SavedSearch;
  onEdit: (savedSearch: SavedSearch) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (savedSearch: SavedSearch) => void;
  onDelete: (id: string) => void;
}

/**
 * SavedSearchContextMenu (Zotero-Standard Enterprise Smart Search Menu)
 * Provides complete lifecycle management: Edit Criteria, Rename, Duplicate, Delete.
 */
export function SavedSearchContextMenu({
  savedSearch,
  onEdit,
  onRename,
  onDuplicate,
  onDelete,
}: SavedSearchContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-foreground opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-foreground/10 focus-visible:opacity-100 hover:bg-foreground/10 active:bg-foreground/20 transition-all duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label={`Options for ${savedSearch.name}`}
        >
          <MoreVertical className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
      >
        <DropdownMenuItem
          onClick={() => onEdit(savedSearch)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <SlidersHorizontal className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Edit Saved Search...</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onRename(savedSearch.id, savedSearch.name)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Rename Saved Search</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onDuplicate(savedSearch)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Duplicate Saved Search</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="mx-1 my-1" />

        <DropdownMenuItem
          onClick={() => onDelete(savedSearch.id)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Trash2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Delete Saved Search</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
