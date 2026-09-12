'use client';

import React, { useState } from 'react';
import {
  X,
  Trash2,
  Calendar,
  User,
  RotateCcw,
  CheckCircle2,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
  CircleOff,
  UserMinus,
  ChevronDown,
  Archive,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type {
  Column,
  Priority,
  ProjectMember,
  Cycle,
} from '../../types/types';
import { PRIORITY_CONFIG } from '../../types/types';
import { addDays, format, endOfWeek } from 'date-fns';

const PRIORITY_ICONS: Record<Priority, React.ElementType> = {
  urgent: Flame,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
  none: CircleOff,
};

export interface BulkActionBarProps {
  selectedTaskIds: string[];
  totalCount: number;
  columns: Column[];
  members: ProjectMember[];
  cycles: Cycle[];
  onClearSelection: () => void;
  onUpdateState: (columnId: string) => void;
  onUpdatePriority: (priority: Priority) => void;
  onUpdateAssignee: (assigneeId: string | null) => void;
  onUpdateDueDate: (dueDate: string | null) => void;
  onUpdateCycle: (cycleId: string | null) => void;
  onDeleteSelected: () => void;
  onArchiveSelected?: () => void;
  onRestoreSelected?: () => void;
  isArchivedView?: boolean;
  isUpdating?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedTaskIds,
  columns,
  members,
  cycles,
  onClearSelection,
  onUpdateState,
  onUpdatePriority,
  onUpdateAssignee,
  onUpdateDueDate,
  onUpdateCycle,
  onDeleteSelected,
  onArchiveSelected,
  onRestoreSelected,
  isArchivedView = false,
  isUpdating = false,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  if (selectedTaskIds.length === 0) return null;

  const count = selectedTaskIds.length;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-md border border-border rounded-md px-3 py-1.5 flex items-center gap-2 max-w-[calc(100vw-2rem)] overflow-x-auto shadow-lg animate-in fade-in slide-in-from-bottom-3 duration-200">
        {/* Selection count badge */}
        <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md text-xs font-medium text-foreground shrink-0">
          <span>{count} selected</span>
          <button
            type="button"
            onClick={onClearSelection}
            className="hover:text-foreground text-muted-foreground p-0.5 rounded-sm cursor-pointer transition-colors"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="size-3 shrink-0" />
          </button>
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* State Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 rounded-md cursor-pointer shrink-0"
            >
              <CheckCircle2 className="size-3.5 text-muted-foreground shrink-0" />
              <span>State</span>
              <ChevronDown className="size-3 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48 p-1 rounded-md border-border bg-popover">
            {columns.map((col) => (
              <DropdownMenuItem
                key={col.id}
                onClick={() => onUpdateState(col.id)}
                className="text-xs cursor-pointer flex items-center gap-2 py-1.5 rounded-md"
              >
                <div
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: col.accentColor || 'currentColor' }}
                />
                <span className="truncate">{col.title || col.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 rounded-md cursor-pointer"
            >
              <Flame className="size-3.5 text-muted-foreground shrink-0" />
              <span>Priority</span>
              <ChevronDown className="size-3 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40 p-1 rounded-md border-border bg-popover">
            {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((pKey) => {
              const cfg = PRIORITY_CONFIG[pKey];
              const Icon = PRIORITY_ICONS[pKey] || Minus;
              return (
                <DropdownMenuItem
                  key={pKey}
                  onClick={() => onUpdatePriority(pKey)}
                  className="text-xs cursor-pointer flex items-center gap-2 py-1.5 rounded-md"
                >
                  <Icon className={cn('size-3.5 shrink-0', cfg.color)} />
                  <span>{cfg.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Assignee Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 rounded-md cursor-pointer"
            >
              <User className="size-3.5 text-muted-foreground shrink-0" />
              <span>Assignee</span>
              <ChevronDown className="size-3 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52 p-1 rounded-md border-border bg-popover max-h-56 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => onUpdateAssignee(null)}
              className="text-xs cursor-pointer flex items-center gap-2 py-1.5 rounded-md text-muted-foreground"
            >
              <UserMinus className="size-3.5 shrink-0" />
              <span>Unassign</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {members.map((m: any) => {
              const u = m.user || m;
              const memberId = m.id || m.userId || u.id;
              const name = u.name || 'Member';
              return (
                <DropdownMenuItem
                  key={memberId}
                  onClick={() => onUpdateAssignee(memberId || null)}
                  className="text-xs cursor-pointer flex items-center gap-2 py-1.5 rounded-md"
                >
                  <Avatar className="size-4.5 rounded-full shrink-0">
                    <AvatarImage src={u.avatar || ''} />
                    <AvatarFallback className="text-9">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{name}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Due Date Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 rounded-md cursor-pointer"
            >
              <Calendar className="size-3.5 text-muted-foreground shrink-0" />
              <span>Due Date</span>
              <ChevronDown className="size-3 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-44 p-1 rounded-md border-border bg-popover">
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(new Date().toISOString())}
              className="text-xs cursor-pointer py-1.5"
            >
              Today ({format(new Date(), 'MMM d')})
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(addDays(new Date(), 1).toISOString())}
              className="text-xs cursor-pointer py-1.5"
            >
              Tomorrow ({format(addDays(new Date(), 1), 'MMM d')})
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(endOfWeek(new Date()).toISOString())}
              className="text-xs cursor-pointer py-1.5"
            >
              End of week
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(addDays(new Date(), 7).toISOString())}
              className="text-xs cursor-pointer py-1.5"
            >
              In 1 week
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(null)}
              className="text-xs cursor-pointer py-1.5 text-muted-foreground"
            >
              Clear due date
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Cycle Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isUpdating}
              className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-2 rounded-md cursor-pointer"
            >
              <RotateCcw className="size-3.5 text-muted-foreground shrink-0" />
              <span>Cycle</span>
              <ChevronDown className="size-3 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52 p-1 rounded-md border-border bg-popover max-h-56 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => onUpdateCycle(null)}
              className="text-xs cursor-pointer py-1.5 text-muted-foreground"
            >
              Remove from cycle
            </DropdownMenuItem>
            {cycles.length > 0 && <DropdownMenuSeparator />}
            {cycles.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => onUpdateCycle(c.id)}
                className="text-xs cursor-pointer flex items-center justify-between py-1.5"
              >
                <span className="truncate">{c.name}</span>
                {c.status === 'active' && (
                  <span className="text-10 font-semibold text-emerald-500 bg-emerald-500/10 px-1 rounded-sm">
                    Active
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border" />

        {/* Bulk Restore Button (when viewing archived) */}
        {isArchivedView && onRestoreSelected && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isUpdating}
            onClick={() => setRestoreDialogOpen(true)}
            className="h-7 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-muted flex items-center gap-1 px-2 rounded-md cursor-pointer"
            title="Restore selected work items"
          >
            <RotateCcw className="size-3.5 shrink-0" />
            <span>Restore</span>
          </Button>
        )}

        {/* Bulk Archive Button (when viewing active items) */}
        {!isArchivedView && onArchiveSelected && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isUpdating}
            onClick={() => setArchiveDialogOpen(true)}
            className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1 px-2 rounded-md cursor-pointer"
            title="Archive selected work items"
          >
            <Archive className="size-3.5 shrink-0" />
            <span>Archive</span>
          </Button>
        )}

        {/* Bulk Delete Button */}
        <Button
          variant="ghost"
          size="sm"
          disabled={isUpdating}
          onClick={() => setDeleteDialogOpen(true)}
          className="h-7 text-xs font-medium text-destructive hover:bg-muted flex items-center gap-1 px-2 rounded-md cursor-pointer"
          title="Delete selected work items"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Delete</span>
        </Button>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="w-full max-w-md p-6 gap-4 rounded-lg border border-border bg-background">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-base font-semibold text-foreground">
              Restore {count} Work Items?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              These {count} work items will be restored to your active board and list views.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={isUpdating}
              className="rounded-md"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRestoreDialogOpen(false);
                onRestoreSelected?.();
              }}
              disabled={isUpdating}
              className="rounded-md"
            >
              {isUpdating ? 'Restoring...' : `Restore ${count} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="w-full max-w-md p-6 gap-4 rounded-lg border border-border bg-background">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-base font-semibold text-foreground">
              Archive {count} Work Items?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              These {count} work items will be safely archived and hidden from active views. You can view or restore them at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={isUpdating}
              className="rounded-md"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setArchiveDialogOpen(false);
                onArchiveSelected?.();
              }}
              disabled={isUpdating}
              className="rounded-md"
            >
              {isUpdating ? 'Archiving...' : `Archive ${count} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-full max-w-md p-6 gap-4 rounded-lg border border-border bg-background">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-base font-semibold text-foreground">
              Delete {count} Work Items?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to delete these {count} work items? This action will move them to trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isUpdating}
              className="rounded-md"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteDialogOpen(false);
                onDeleteSelected();
              }}
              disabled={isUpdating}
              className="rounded-md"
            >
              {isUpdating ? 'Deleting...' : `Delete ${count} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
