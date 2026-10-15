'use client';

/**
 * FileTreePrimitives.tsx
 *
 * Micro-components and primitives for tree row rendering in File Explorer:
 * - IndentGuides: Visual guides showing hierarchy depth
 * - InlineInput: Input for creating a new file or folder inline in the tree
 * - RenameInput: Input for inline renaming with keyboard shortcuts
 * - RowActions: Dropdown menu trigger for row-level actions
 */

import React from 'react';
import { Loader2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export function IndentGuides({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="shrink-0 w-3.5 flex justify-center self-stretch">
          <span className="w-px h-full bg-border/60" />
        </span>
      ))}
    </>
  );
}

export function InlineInput({
  icon: Icon,
  iconColor,
  value,
  onChange,
  placeholder,
  onCommit,
  onCancel,
  isPending,
}: {
  icon: React.ElementType;
  iconColor?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onCommit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  return (
    <div
      className="flex h-8 items-center gap-1.5 w-full rounded-md pl-2 pr-1 bg-muted/40 transition-colors select-none"
    >
      <span className="size-3.5 shrink-0" aria-hidden="true" />
      <Icon
        className={cn(
          'size-4 shrink-0',
          iconColor ?? 'text-foreground',
        )}
        strokeWidth={1.5}
      />
      <input
        autoFocus
        type="text"
        name="newItemName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim()) onCommit();
          else onCancel();
        }}
        placeholder={placeholder}
        aria-label={placeholder || 'Item name'}
        disabled={isPending}
        className="h-6.5 flex-1 min-w-0 bg-background text-12 font-sans text-foreground border border-border focus:border-foreground/50 rounded-sm px-2 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-foreground placeholder:text-muted-foreground"
      />
      {isPending && (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-foreground shrink-0 ml-1.5" />
      )}
    </div>
  );
}

export function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  isPending,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 flex items-center">
      <input
        autoFocus
        type="text"
        name="renameItemName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim()) onCommit();
          else onCancel();
        }}
        aria-label="Rename file"
        disabled={isPending}
        className="h-6.5 w-full bg-background text-12 font-normal text-foreground border border-foreground/40 rounded-sm px-2 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-foreground"
      />
      {isPending && (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-foreground shrink-0 ml-1.5" />
      )}
    </div>
  );
}

export function RowActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Options"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md text-foreground opacity-60 sm:opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity hover:transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground relative after:absolute after:-inset-1.5 after:content-[\'\']',
                className,
              )}
            >
              <MoreVertical className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-11">
          Options
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none text-13"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
