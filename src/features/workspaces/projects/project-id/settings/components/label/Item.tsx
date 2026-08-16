'use client';

import React from 'react';
import { GripVertical, Tag, MoreHorizontal, X, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui';

interface ItemProps {
  item: {
    id: string;
    name: string;
    color: string;
  };
  onEdit: () => void;
  onDelete: () => void;
}

export function Item({ item, onEdit, onDelete }: ItemProps) {
  return (
    <div className="group flex h-11 items-center justify-between gap-3 px-3 rounded-lg border border-border/70 bg-background shadow-2xs hover:border-border transition-all">
      {/* Left side: Drag handle + Tag icon + Name */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex items-center justify-center size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-opacity opacity-0 group-hover:opacity-100 cursor-grab">
          <GripVertical className="size-3.5" />
        </div>

        <Tag
          className="size-4 shrink-0 transition-transform group-hover:scale-105"
          style={{ color: item.color, fill: item.color }}
        />

        <span className="text-sm font-medium text-foreground truncate">
          {item.name}
        </span>
      </div>

      {/* Right side: 3-dots Menu + X Delete Button */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* 3-dots Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More options"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer outline-none data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32 p-1 rounded-lg">
            <DropdownMenuItem
              onClick={onEdit}
              className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium cursor-pointer rounded-md"
            >
              <Pencil className="size-3.5 text-muted-foreground" />
              <span>Edit</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* X Delete Button */}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete label"
          title="Delete label"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
