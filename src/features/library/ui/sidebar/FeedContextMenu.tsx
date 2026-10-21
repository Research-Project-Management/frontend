'use client';

import React from 'react';
import { CheckCheck, MoreVertical, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { SavedFeedSubscription } from '@/features/library/domain/types/feeds.types';

export interface FeedContextMenuProps {
  feed: SavedFeedSubscription;
  onRefresh?: (feed: SavedFeedSubscription) => void;
  onMarkAllAsRead?: (feed: SavedFeedSubscription) => void;
  onEdit: (feed: SavedFeedSubscription) => void;
  onDelete: (feed: SavedFeedSubscription) => void;
}

export function FeedContextMenu({
  feed,
  onRefresh,
  onMarkAllAsRead,
  onEdit,
  onDelete,
}: FeedContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-muted data-[state=open]:text-foreground focus-visible:opacity-100 hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Options for ${feed.name}`}
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
        className="w-48 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
      >
        {onRefresh && (
          <DropdownMenuItem
            onClick={() => onRefresh(feed)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <RefreshCw className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Refresh Feed</span>
          </DropdownMenuItem>
        )}

        {onMarkAllAsRead && (
          <DropdownMenuItem
            onClick={() => onMarkAllAsRead(feed)}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <CheckCheck className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Mark Feed as Read</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => onEdit(feed)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Pencil className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Edit Feed...</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="mx-1 my-1" />

        <DropdownMenuItem
          onClick={() => onDelete(feed)}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
        >
          <Trash2 className="size-3.5 text-destructive shrink-0" strokeWidth={1.5} />
          <span>Unsubscribe</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FeedContextMenu;
