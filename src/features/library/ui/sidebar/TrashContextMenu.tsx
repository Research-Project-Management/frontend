'use client';

import React from 'react';
import { MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenuContent,
  ContextMenuItem,
} from '@/shared/components/ui/context-menu';

export interface TrashContextMenuProps {
  onEmptyTrash: () => void;
  isEmpty?: boolean;
  canEmpty?: boolean;
}

/**
 * Action button (MoreVertical) displayed on hover in the sidebar for Trash.
 */
export function TrashContextMenuAction({
  onEmptyTrash,
  isEmpty = false,
  canEmpty = true,
}: TrashContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground opacity-0 max-md:opacity-100 group-hover/item:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-background data-[state=open]:border-border data-[state=open]:text-foreground focus-visible:opacity-100 border border-transparent hover:border-border/50 hover:bg-background transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label="Trash options"
        >
          <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" sideOffset={4} className="w-44">
        <DropdownMenuItem
          onClick={onEmptyTrash}
          disabled={isEmpty || !canEmpty}
          className="text-destructive focus:text-destructive gap-2 text-12 cursor-pointer"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Empty Trash...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Native Radix ContextMenu triggered on right-clicking the Trash nav item.
 */
export function TrashContextMenuContent({
  onEmptyTrash,
  isEmpty = false,
  canEmpty = true,
}: TrashContextMenuProps) {
  return (
    <ContextMenuContent className="w-44">
      <ContextMenuItem
        onClick={onEmptyTrash}
        disabled={isEmpty || !canEmpty}
        className="text-destructive focus:text-destructive gap-2 text-12 cursor-pointer"
      >
        <Trash2 className="size-3.5 shrink-0" />
        <span>Empty Trash...</span>
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
