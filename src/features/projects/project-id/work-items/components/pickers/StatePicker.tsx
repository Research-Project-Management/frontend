'use client';

import React, { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { resolveColumnId } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import type { Column } from '@/features/projects/project-id/work-items/types/work-item.types';
import {
  StatusIcon,
  BacklogStatusIcon as BacklogStateIcon,
  TodoStatusIcon as TodoStateIcon,
  InProgressStatusIcon as InProgressStateIcon,
  DoneStatusIcon as DoneStateIcon,
  CancelledStatusIcon as CancelledStateIcon,
} from '@/shared/components/icons';

export {
  StatusIcon,
  BacklogStateIcon,
  TodoStateIcon,
  InProgressStateIcon,
  DoneStateIcon,
  CancelledStateIcon,
};

export function StateItemIcon({ col, className }: { col?: Partial<Column> | null; className?: string }) {
  if (!col) return null;
  return (
    <StatusIcon
      id={col.id}
      title={col.title || col.name}
      group={col.group}
      color={col.color || col.accentColor}
      className={cn('size-3.5 shrink-0', className)}
    />
  );
}

import type { StatePopoverProps } from '@/features/projects/project-id/work-items/types/picker.types';

export type { StatePopoverProps };

export const StatePopover: React.FC<StatePopoverProps> = ({
  open,
  onOpenChange,
  columnId: propColumnId,
  setColumnId: propSetColumnId,
  currentStateId,
  onSelectState,
  columns = [],
  actionBtnClass,
  isReadOnly = false,
}) => {
  const columnId = (propColumnId !== undefined ? propColumnId : currentStateId) || '';
  const setColumnId = propSetColumnId || onSelectState || (() => {});
  const [searchQuery, setSearchQuery] = useState('');
  const activeCol = columns.find(
    (c) =>
      resolveColumnId(c) === columnId ||
      c.id === columnId ||
      c.group === columnId ||
      (c.name && c.name.toLowerCase() === columnId?.toLowerCase()) ||
      (c.title && c.title.toLowerCase() === columnId?.toLowerCase())
  );

  const filteredColumns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((c) => (c.title || c.name || '').toLowerCase().includes(q));
  }, [columns, searchQuery]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
            actionBtnClass
          )}
        >
          <StateItemIcon col={activeCol} />
          <span>{activeCol?.title || activeCol?.name || columnId || 'Backlog'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-48 p-1.5 rounded-md border border-border bg-popover shadow-overlay z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search states..."
            aria-label="Search states"
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {filteredColumns.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No states found
            </div>
          ) : (
            filteredColumns.map((col) => {
              const cId = resolveColumnId(col);
              const isCurrent = columnId === cId;
              return (
                <button
                  key={cId}
                  type="button"
                  onClick={() => {
                    setColumnId(cId);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isCurrent && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <StateItemIcon col={col} />
                    <span className="truncate">{col.title || col.name}</span>
                  </div>
                  {isCurrent && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const StatePicker = StatePopover;
