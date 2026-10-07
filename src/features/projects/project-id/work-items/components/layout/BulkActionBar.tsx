'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Tag,
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
} from '../../types/work-item.types';
import { PRIORITY_CONFIG } from '../../types/work-item.types';
import { addDays, format, endOfWeek } from 'date-fns';

const PRIORITY_ICONS: Record<Priority, React.ElementType> = {
  urgent: Flame,
  high: ArrowUp,
  medium: Minus,
  low: ArrowDown,
  none: CircleOff,
};

export interface BulkActionBarProps {
  selectedIds?: string[];
  totalCount: number;
  columns: Column[];
  members: ProjectMember[];
  labels?: Array<{ id: string; name: string; color?: string }>;
  onClearSelection: () => void;
  onUpdateState: (columnId: string) => void;
  onUpdatePriority: (priority: Priority) => void;
  onUpdateAssignee: (assigneeId: string | null) => void;
  onUpdateDueDate: (dueDate: string | null) => void;
  onAddLabel?: (labelId: string) => void;
  onRemoveLabel?: (labelId: string) => void;
  onClearLabels?: () => void;
  onDeleteSelected: () => void;
  onArchiveSelected?: () => void;
  onRestoreSelected?: () => void;
  isArchivedView?: boolean;
  isUpdating?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedIds = [],
  columns,
  members,
  labels = [],
  onClearSelection,
  onUpdateState,
  onUpdatePriority,
  onUpdateAssignee,
  onUpdateDueDate,
  onAddLabel,
  onRemoveLabel,
  onClearLabels,
  onDeleteSelected,
  onArchiveSelected,
  onRestoreSelected,
  isArchivedView = false,
  isUpdating = false,
}) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || selectedIds.length === 0 || typeof document === 'undefined') return null;

  const count = selectedIds.length;

  return createPortal(
    <>
      <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background/95 backdrop-blur-md border border-border rounded-md px-4 py-2 h-11 flex items-center gap-2 w-max max-w-[calc(100vw-2rem)] overflow-x-auto no-scrollbar shadow-overlay animate-in fade-in slide-in-from-bottom-3 duration-200 select-none">
        {/* Selection count badge */}
        <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md text-12 font-medium text-foreground shrink-0">
          <span className="font-mono text-11 tabular-nums">{count} selected</span>
          <button
            type="button"
            onClick={onClearSelection}
            className="hover:text-foreground text-foreground/80 hover:bg-muted p-0.5 rounded-md cursor-pointer transition-colors relative before:absolute before:-inset-1 md:before:hidden"
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
              className="h-8 text-12 font-medium text-foreground hover:bg-muted flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
            >
              <CheckCircle2 className="size-3.5 text-foreground shrink-0" />
              <span>State</span>
              <ChevronDown className="size-3 text-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48 p-1 rounded-md border-border bg-popover shadow-overlay">
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
              className="h-8 text-12 font-medium text-foreground hover:bg-muted flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Flame className="size-3.5 text-foreground shrink-0" />
              <span>Priority</span>
              <ChevronDown className="size-3 text-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-40 p-1 rounded-md border-border bg-popover shadow-overlay">
            {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((pKey) => {
              const cfg = PRIORITY_CONFIG[pKey];
              const Icon = PRIORITY_ICONS[pKey] || Minus;
              return (
                <DropdownMenuItem
                  key={pKey}
                  onClick={() => onUpdatePriority(pKey)}
                  className="text-12 cursor-pointer flex items-center gap-2 py-1.5 rounded-md"
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
              className="h-8 text-12 font-medium text-foreground hover:bg-muted flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
            >
              <User className="size-3.5 text-foreground shrink-0" />
              <span>Assignee</span>
              <ChevronDown className="size-3 text-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-52 p-1 rounded-md border-border bg-popover shadow-overlay max-h-56 overflow-y-auto">
            <DropdownMenuItem
              onClick={() => onUpdateAssignee(null)}
              className="text-12 cursor-pointer flex items-center gap-2 py-1.5 rounded-md text-foreground"
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
                  className="text-12 cursor-pointer flex items-center gap-2 py-1.5 rounded-md"
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
              className="h-8 text-12 font-medium text-foreground hover:bg-muted flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
            >
              <Calendar className="size-3.5 text-foreground shrink-0" />
              <span>Due Date</span>
              <ChevronDown className="size-3 text-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-44 p-1 rounded-md border-border bg-popover shadow-overlay">
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(new Date().toISOString())}
              className="text-12 cursor-pointer py-1.5 rounded-md"
            >
              Today ({format(new Date(), 'MMM d')})
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(addDays(new Date(), 1).toISOString())}
              className="text-12 cursor-pointer py-1.5 rounded-md"
            >
              Tomorrow ({format(addDays(new Date(), 1), 'MMM d')})
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(endOfWeek(new Date()).toISOString())}
              className="text-12 cursor-pointer py-1.5 rounded-md"
            >
              End of week
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(addDays(new Date(), 7).toISOString())}
              className="text-12 cursor-pointer py-1.5 rounded-md"
            >
              In 1 week
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onUpdateDueDate(null)}
              className="text-12 cursor-pointer py-1.5 rounded-md text-foreground"
            >
              Clear due date
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Label Selector */}
        {labels && labels.length > 0 && onAddLabel && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isUpdating}
                className="h-8 text-12 font-medium text-foreground hover:bg-muted flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
              >
                <Tag className="size-3.5 text-foreground shrink-0" />
                <span>Label</span>
                <ChevronDown className="size-3 text-foreground shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-52 p-1 rounded-md border-border bg-popover shadow-overlay max-h-56 overflow-y-auto">
              {labels.map((lbl) => (
                <DropdownMenuItem
                  key={lbl.id}
                  onClick={() => onAddLabel(lbl.id)}
                  className="text-12 cursor-pointer flex items-center gap-2 py-1.5 rounded-md"
                >
                  <div
                    className="size-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: lbl.color || '#94a3b8' }}
                  />
                  <span className="truncate">{lbl.name}</span>
                </DropdownMenuItem>
              ))}
              {onClearLabels && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onClearLabels}
                    className="text-12 cursor-pointer py-1.5 rounded-md text-foreground"
                  >
                    Clear all labels
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="h-4 w-px bg-border shrink-0" />

        {/* Bulk Restore Button (when viewing archived) */}
        {isArchivedView && onRestoreSelected && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isUpdating}
            onClick={() => setRestoreDialogOpen(true)}
            className="h-8 text-12 font-medium text-warning hover:bg-muted flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
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
            className="h-8 text-12 font-medium text-foreground hover:bg-muted flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
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
          className="h-8 text-12 font-medium text-destructive hover:bg-destructive/10 flex items-center gap-1.5 px-2.5 rounded-md cursor-pointer shrink-0 relative before:absolute before:-inset-1 md:before:hidden"
          title="Delete selected work items"
        >
          <Trash2 className="size-3.5 shrink-0" />
          <span>Delete</span>
        </Button>
      </div>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="w-full max-w-md p-6 gap-4 rounded-md border border-border bg-background shadow-raised-200">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-16 font-semibold text-foreground">
              Restore {count} Work Items?
            </DialogTitle>
            <DialogDescription className="text-13 text-muted-foreground mt-1.5 leading-normal">
              These {count} work items will be restored to your active board and list views.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRestoreDialogOpen(false)}
              disabled={isUpdating}
              className="relative h-8 px-3 text-12 font-medium rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
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
              className="relative h-8 px-3.5 text-12 font-medium rounded-md bg-background border border-border hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
            >
              {isUpdating ? 'Restoring...' : `Restore ${count} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="w-full max-w-md p-6 gap-4 rounded-md border border-border bg-background shadow-raised-200">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-16 font-semibold text-foreground">
              Archive {count} Work Items?
            </DialogTitle>
            <DialogDescription className="text-13 text-muted-foreground mt-1.5 leading-normal">
              These {count} work items will be safely archived and hidden from active views. You can view or restore them at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={isUpdating}
              className="relative h-8 px-3 text-12 font-medium rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
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
              className="relative h-8 px-3.5 text-12 font-medium rounded-md bg-background border border-border hover:bg-muted text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
            >
              {isUpdating ? 'Archiving...' : `Archive ${count} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-full max-w-md p-6 gap-4 rounded-md border border-border bg-background shadow-raised-200">
          <DialogHeader className="text-left space-y-1.5">
            <DialogTitle className="text-16 font-semibold text-foreground">
              Delete {count} Work Items?
            </DialogTitle>
            <DialogDescription className="text-13 text-muted-foreground mt-1.5 leading-normal">
              Are you sure you want to delete these {count} work items? This action will move them to trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isUpdating}
              className="relative h-8 px-3 text-12 font-medium rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
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
              className="relative h-8 px-3.5 text-12 font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
            >
              {isUpdating ? 'Deleting...' : `Delete ${count} Items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
    document.body
  );
};
