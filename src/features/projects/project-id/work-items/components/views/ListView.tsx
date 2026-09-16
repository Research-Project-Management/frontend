'use client';

import React, { useState, useMemo, useEffect, memo, useRef, useCallback } from 'react';
import {
  Plus,
  User,
  Copy,
  RotateCcw,
  Trash2,
  UserMinus,
  UserPlus,
  MoreHorizontal,
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  Check,
  CornerDownRight,
  Link2,
  Paperclip,
} from 'lucide-react';
import {
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { cn } from "@/shared/lib/utils";
import { ItemHelpers } from '../../utils/work-item.utils';
import { StatusIcon } from '@/shared/components/icons';
import {
  PriorityPopover,
  MemberPopover,
  SingleDatePopover,
  CyclePopover,
  LabelPopover,
  AvatarStack,
} from '../modals/Popovers';
import type {
  Item,
  SubItem,
  Column,
  Priority,
  DisplayOptions,
  Cycle,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
} from '../../types/work-item.types';
import { resolveColumnId } from '../../utils/work-item.utils';
import { CoreService } from '../../services/core.service';

// ── 1. Semantic Color Theme Maps & Date Formatters ────────────────────────────

const PRIORITY_THEME_CLASSES: Record<string, string> = {
  urgent:
    'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20 shadow-none font-normal',
  high:
    'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 shadow-none font-normal',
  medium:
    'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 shadow-none font-normal',
  low:
    'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 shadow-none font-normal',
  none:
    'text-muted-foreground bg-background hover:bg-muted border-border shadow-none font-normal',
};

function formatDueDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ── 2. Group Checkbox Component (Indeterminate & Keyboard Accessible) ──────────

function GroupCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  ariaLabel = 'Select all items in this group',
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.MouseEvent) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  if (disabled) return null;

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={() => {}}
      onClick={(e) => {
        e.stopPropagation();
        onChange(e);
      }}
      aria-label={ariaLabel}
      className={cn(
        'size-3.5 rounded-sm border border-border text-primary focus:ring-1 focus:ring-ring focus:outline-none cursor-pointer shrink-0 accent-primary transition-opacity duration-150',
        checked || indeterminate
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none group-hover/header:opacity-100 group-hover/header:pointer-events-auto group-focus-within/header:opacity-100 group-focus-within/header:pointer-events-auto focus:opacity-100 focus:pointer-events-auto',
      )}
    />
  );
}

// ── 3. Item Row Component (Responsive, Scannable & Hardened) ──────────────────

export interface ItemRowProps {
  item: Item;
  columns: Column[];
  projectStates?: Column[];
  currentColumn?: Column;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEditCard: (item: Item) => void;
  onDuplicateCard: (item: Item) => void;
  onJoinCard: (item: Item) => void;
  onLeaveCard: (item: Item) => void;
  onRemoveFromCycle?: (item: Item) => void;
  onDeleteCard: (item: Item) => void;
  onMoveCard: (itemId: string, targetColumnId: string) => void;
  onUpdateItem?: (id: string, data: any) => void;
  displayOptions?: DisplayOptions;
  members?: any[];
  cycles?: Cycle[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  isDragging?: boolean;
  isReadOnly?: boolean;
  isChildrenExpanded?: boolean;
  onToggleExpandChildren?: (itemId: string) => void;
}

export const ItemRow = ({
  item,
  columns,
  projectStates,
  currentColumn,
  isSelected = false,
  onToggleSelect,
  onEditCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onDeleteCard,
  onMoveCard,
  onUpdateItem,
  displayOptions,
  members = [],
  cycles = [],
  currentUserId,
  isDragging = false,
  isReadOnly = false,
  isChildrenExpanded = false,
  onToggleExpandChildren,
}: ItemRowProps) => {
  // Popover state triggers for inline editing
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  // Property visibility flags from displayOptions
  const propsConfig = displayOptions?.properties;
  const showId = propsConfig?.id !== false;
  const showState = propsConfig?.state !== false;
  const showPriority = propsConfig?.priority !== false;
  const showStartDate = Boolean(propsConfig?.startDate || item.startDate);
  const showDueDate = propsConfig?.dueDate !== false;
  const showAssignee = propsConfig?.assignee !== false;
  const showAttach = propsConfig?.attach !== false;
  const showCycle = Boolean(propsConfig?.cycle);
  const showLabels = propsConfig?.labels !== false;
  const showSubIssues = Boolean(propsConfig?.childWorkItemCount ?? propsConfig?.subItemCount);
  const showLinks = Boolean(propsConfig?.link);

  const linksCount = useMemo(() => {
    if (typeof (item as any).linkCount === 'number') return (item as any).linkCount;
    if (Array.isArray((item as any).links)) return (item as any).links.length;
    const attachObj = item.attachments || (item as any).attach;
    if (attachObj && typeof attachObj === 'object' && Array.isArray((attachObj as any).links)) {
      return (attachObj as any).links.length;
    }
    return 0;
  }, [(item as any).links, item.attachments, (item as any).attach, (item as any).linkCount]);

  const priorityKey = (item.priority || 'none').toLowerCase() as Priority;

  const resolvedAssignees = ItemHelpers.resolveAssignees(item, members);
  const assignee = ItemHelpers.resolveAssignee(item) || resolvedAssignees[0] || null;
  const assigneeId = ItemHelpers.resolveAssigneeId(item) || resolvedAssignees[0]?.id || null;
  const resolvedAssigneeIds = resolvedAssignees.map((a) => a.id).filter(Boolean);
  const isCurrentUserAssignee = Boolean(
    currentUserId && (assigneeId === currentUserId || resolvedAssigneeIds.includes(currentUserId))
  );

  const formattedStart = formatDueDate(item.startDate);
  const formattedDue = formatDueDate(item.dueDate);

  // Overdue and Due Today Calculations for Colorization
  const isOverdue = useMemo(() => {
    if (!item.dueDate || item.completed) return false;
    const due = new Date(item.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }, [item.dueDate, item.completed]);

  const isDueToday = useMemo(() => {
    if (!item.dueDate || item.completed) return false;
    const due = new Date(item.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    return (
      due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate()
    );
  }, [item.dueDate, item.completed]);

  // Attachments / modules count
  const attachItems = useMemo(() => {
    const attachObj = (item as any).attach;
    if (!attachObj) return [];
    const items: Array<{ id: string; title: string }> = [];
    if (Array.isArray(attachObj.pages)) {
      attachObj.pages.forEach((p: any) => items.push({ id: p.id, title: p.title || 'Page' }));
    }
    if (Array.isArray(attachObj.papers)) {
      attachObj.papers.forEach((p: any) => items.push({ id: p.id, title: p.title || 'Paper' }));
    }
    if (Array.isArray(attachObj.files)) {
      attachObj.files.forEach((f: any) => items.push({ id: f.id, title: f.title || f.name || 'File' }));
    }
    if (Array.isArray(attachObj.links)) {
      attachObj.links.forEach((l: any) => items.push({ id: l.id, title: l.title || 'Link' }));
    }
    return items;
  }, [item]);

  const attachLabel = useMemo(() => {
    if (attachItems.length === 0) return null;
    if (attachItems.length === 1) return attachItems[0].title;
    return `${attachItems.length} modules`;
  }, [attachItems]);

  // Cycle resolving
  const cycleName = useMemo(() => {
    if (!item.cycle) return null;
    if (typeof item.cycle === 'object' && item.cycle !== null) {
      return (item.cycle as { name?: string }).name || null;
    }
    if (typeof item.cycle === 'string') return item.cycle;
    return null;
  }, [item.cycle]);

  const itemCycleId = useMemo(() => {
    if (typeof item.cycle === 'object' && item.cycle !== null) {
      return (item.cycle as any).id || null;
    }
    return item.cycleId || null;
  }, [item.cycle, item.cycleId]);

  // Labels resolving
  const labelsList = useMemo(() => {
    if (!Array.isArray(item.labels) || item.labels.length === 0) return [];
    return item.labels.filter(Boolean);
  }, [item.labels]);

  const resolvedState = useMemo(() => {
    if (item.state && typeof item.state === 'object') {
      return {
        id: item.state.id,
        title: item.state.name,
        name: item.state.name,
        group: item.state.group,
        color: item.state.color,
        accentColor: item.state.color,
      };
    }
    const stateList = projectStates && projectStates.length > 0 ? projectStates : columns;
    const found = stateList.find((s) => resolveColumnId(s) === item.columnId);
    if (found) return found;
    if (!displayOptions?.groupBy || displayOptions.groupBy === 'state') {
      return currentColumn;
    }
    return stateList[0];
  }, [item.state, item.columnId, projectStates, columns, currentColumn, displayOptions?.groupBy]);

  const colTitle = resolvedState?.title || resolvedState?.name || 'Backlog';
  const currentColor =
    resolvedState?.color ||
    resolvedState?.accentColor ||
    '#8A9093';
  const stateGroup = resolvedState?.group || (item as any).stateGroup || colTitle;

  return (
    <div
      className={cn(
        'group/row relative h-10 pl-7 sm:pl-8 pr-3 sm:pr-4 flex items-center justify-between border-b border-border bg-background hover:bg-muted select-none text-13 transition-colors duration-150',
        isDragging && 'opacity-50 bg-muted',
        isSelected && 'bg-muted font-medium',
        item.completed && 'opacity-75',
      )}
    >
      {/* Checkbox: Positioned absolutely at left-2 (fades in on hover or when checked) */}
      <div
        className="absolute left-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item.id);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select item ${item.identifier || item.title || 'untitled'}`}
          className={cn(
            'size-3.5 rounded-sm border border-border text-primary focus:ring-1 focus:ring-ring focus:outline-none cursor-pointer shrink-0 accent-primary transition-opacity duration-150',
            isSelected
              ? 'opacity-100 pointer-events-auto'
              : 'max-sm:opacity-100 max-sm:pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover/row:opacity-100 sm:group-hover/row:pointer-events-auto group-focus-within/row:opacity-100 group-focus-within/row:pointer-events-auto focus:opacity-100 focus:pointer-events-auto',
          )}
        />
      </div>

      {/* Left: Identifier & Title */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-3 sm:mr-4">
        {/* Child Items Expand/Collapse Toggle */}
        {(() => {
          const childList = (item.childWorkItems && item.childWorkItems.length > 0)
            ? item.childWorkItems
            : (item.subItems || []);
          if (childList.length === 0) return null;
          const completedCount = childList.filter(
            (s: any) => s.completed || s.stateGroup === 'completed' || s.state?.group === 'completed' || s.columnId === 'done' || s.columnId === 'completed'
          ).length;

          return (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpandChildren?.(item.id);
                }}
                aria-label={isChildrenExpanded ? 'Collapse sub-items' : 'Expand sub-items'}
                className="size-4.5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer -ml-0.5"
              >
                <ChevronRight
                  className={cn(
                    'size-3.5 transition-transform duration-150',
                    isChildrenExpanded && 'rotate-90'
                  )}
                />
              </button>
              {showSubIssues && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpandChildren?.(item.id);
                  }}
                  title={`${completedCount} of ${childList.length} sub-items completed`}
                  className="font-mono text-10 font-medium text-muted-foreground bg-muted px-1.5 py-0.2 rounded-full tabular-nums shrink-0 cursor-pointer hover:bg-muted/80"
                >
                  {completedCount}/{childList.length}
                </span>
              )}
            </div>
          );
        })()}

        {/* Work Item Identifier (e.g. TIEPT-3) */}
        {showId && item.identifier && (
          <span className="font-mono text-12 font-medium text-muted-foreground shrink-0 select-none tracking-tight tabular-nums mr-0.5">
            {item.identifier}
          </span>
        )}

        {/* Work Item Title (Accessible Keyboard Trigger + Drawer Open) */}
        <span
          role="button"
          tabIndex={0}
          onClick={() => onEditCard(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onEditCard(item);
            }
          }}
          className={cn(
            'font-normal truncate cursor-pointer text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline',
            item.completed && 'text-muted-foreground line-through',
            !item.title?.trim() && 'italic text-muted-foreground',
          )}
          title={item.title || 'Untitled work item'}
        >
          {item.title?.trim() || '(Untitled work item)'}
        </span>
      </div>

      {/* Right: Responsively Sized & Colorized Property Pills */}
      <div
        className="flex items-center gap-2 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. State Pill (Always visible) */}
        {showState && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isReadOnly}>
              <button
                type="button"
                className="h-6 px-2.5 text-11 font-normal rounded-full border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <StatusIcon
                  id={item.columnId}
                  title={colTitle}
                  group={stateGroup}
                  color={currentColor}
                  className="size-3 shrink-0"
                />
                <span className="truncate max-w-[70px] sm:max-w-[95px]">{colTitle}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 text-xs z-100">
              {(projectStates && projectStates.length > 0 ? projectStates : columns).map((col) => {
                const cId = resolveColumnId(col);
                const isCurr = cId === item.columnId;
                const cTitle = col.title || col.name || 'Column';
                const cColor = col.color || col.accentColor || '#8A9093';
                return (
                  <DropdownMenuItem
                    key={cId}
                    onClick={() => {
                      if (onUpdateItem) {
                        onUpdateItem(item.id, { columnId: cId });
                      } else {
                        onMoveCard(item.id, cId);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-sm',
                      isCurr && 'bg-muted font-medium',
                    )}
                  >
                    <StatusIcon
                      id={cId}
                      title={cTitle}
                      group={col.group || col.slug || cTitle}
                      color={cColor}
                      className="size-3.5 shrink-0"
                    />
                    <span className="truncate">{cTitle}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 2. Priority Pill (Interactive Popover with Semantic Color) */}
        {showPriority && (
          <div className="shrink-0 hidden xs:flex">
            <PriorityPopover
              open={priorityOpen}
              onOpenChange={setPriorityOpen}
              priority={priorityKey as Priority}
              setPriority={(p) => onUpdateItem?.(item.id, { priority: p })}
              isReadOnly={isReadOnly}
              actionBtnClass={cn(
                'h-6 px-2.5 text-11 font-normal rounded-full border transition-colors shadow-none',
                PRIORITY_THEME_CLASSES[priorityKey] || PRIORITY_THEME_CLASSES.none,
              )}
            />
          </div>
        )}

        {/* 3. Start Date Pill */}
        {showStartDate && (
          <div className="shrink-0 hidden md:flex">
            <SingleDatePopover
              open={startDateOpen}
              onOpenChange={setStartDateOpen}
              label={formattedStart || 'Start date'}
              date={item.startDate || ''}
              onSelectDate={(d) => onUpdateItem?.(item.id, { startDate: d || null })}
              actionBtnClass={cn(
                item.startDate
                  ? 'h-6 px-2.5 text-11 font-normal rounded-full border border-border bg-background hover:bg-muted text-foreground'
                  : 'size-6 p-0 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 [&>span]:hidden',
              )}
            />
          </div>
        )}

        {/* 4. Due Date Pill (Overdue / Today / Future Semantic States) */}
        {showDueDate && (
          <div className="shrink-0 hidden sm:flex">
            <SingleDatePopover
              open={dateOpen}
              onOpenChange={setDateOpen}
              label={formattedDue || 'Due date'}
              date={item.dueDate || ''}
              onSelectDate={(d) => onUpdateItem?.(item.id, { dueDate: d || null })}
              actionBtnClass={cn(
                item.dueDate
                  ? cn(
                      'h-6 px-2.5 text-11 font-normal rounded-full border transition-colors shadow-none',
                      isOverdue
                        ? 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium'
                        : isDueToday
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-medium'
                          : 'border-border bg-background hover:bg-muted text-foreground',
                    )
                  : 'size-6 p-0 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 [&>span]:hidden',
              )}
            />
          </div>
        )}

        {/* 5. Assignee Pill (Interactive Member Popover) */}
        {showAssignee && (
          <div className="relative shrink-0">
            {resolvedAssignees.length > 1 ? (
              <button
                type="button"
                onClick={() => setAssigneeOpen(true)}
                disabled={isReadOnly}
                className="cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all rounded-full shrink-0"
                title={`${resolvedAssignees.length} assignees`}
              >
                <AvatarStack users={resolvedAssignees} size="xs" max={3} />
              </button>
            ) : resolvedAssignees.length === 1 ? (
              <button
                type="button"
                onClick={() => setAssigneeOpen(true)}
                disabled={isReadOnly}
                className="size-6 rounded-full border border-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all"
                title={resolvedAssignees[0].name || 'Assignee'}
              >
                <Avatar className="size-full shrink-0">
                  <AvatarImage src={resolvedAssignees[0].avatar || undefined} alt={resolvedAssignees[0].name || 'Assignee'} />
                  <AvatarFallback className="text-10 font-medium bg-muted text-foreground">
                    {(resolvedAssignees[0].name || 'U').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : assignee ? (
              <button
                type="button"
                onClick={() => setAssigneeOpen(true)}
                disabled={isReadOnly}
                className="size-6 rounded-full border border-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all"
                title={assignee.name || 'Assignee'}
              >
                <Avatar className="size-full shrink-0">
                  <AvatarImage src={assignee.avatar || undefined} alt={assignee.name || 'Assignee'} />
                  <AvatarFallback className="text-10 font-medium bg-muted text-foreground">
                    {(assignee.name || 'U').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAssigneeOpen(true)}
                disabled={isReadOnly}
                className="size-6 rounded-full border border-dashed border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                aria-label="Assign member"
                title="Assign member"
              >
                <User className="size-3 shrink-0" />
              </button>
            )}

            <MemberPopover
              open={assigneeOpen}
              onOpenChange={setAssigneeOpen}
              assigneeId={assigneeId ?? null}
              setAssigneeId={(id) => onUpdateItem?.(item.id, { assigneeId: id })}
              assigneeIds={resolvedAssigneeIds}
              setAssigneeIds={(ids) =>
                onUpdateItem?.(item.id, {
                  assigneeIds: ids,
                  assigneeId: ids[0] ?? null,
                })
              }
              isMulti={true}
              members={members}
              actionBtnClass="hidden"
            />
          </div>
        )}

        {/* 6. Attachments / Modules Pill (Hidden on smaller screens to prevent title squashing) */}
        {showAttach && attachLabel && (
          <button
            type="button"
            onClick={() => onEditCard(item)}
            className="h-6 px-2.5 text-11 font-normal rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground hidden xl:flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title="Attached modules/pages/files"
          >
            <LayoutGrid className="size-3 shrink-0" />
            <span className="truncate max-w-[100px]">{attachLabel}</span>
          </button>
        )}

        {/* 6b. Links Pill */}
        {showLinks && linksCount > 0 && (
          <button
            type="button"
            onClick={() => onEditCard(item)}
            className="h-6 px-2 text-11 font-normal rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground hidden xl:flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            title={`${linksCount} links`}
          >
            <Link2 className="size-3 shrink-0" />
            <span className="tabular-nums font-mono">{linksCount}</span>
          </button>
        )}

        {/* 7. Cycle Pill (Visible on large viewports) */}
        {showCycle && (
          <div className="shrink-0 hidden lg:flex">
            <CyclePopover
              open={cycleOpen}
              onOpenChange={setCycleOpen}
              cycleId={itemCycleId}
              setCycleId={(id) => onUpdateItem?.(item.id, { cycleId: id })}
              cycles={cycles}
              isReadOnly={isReadOnly}
              actionBtnClass={cn(
                cycleName
                  ? 'h-6 px-2.5 text-11 font-normal rounded-full border border-border bg-background hover:bg-muted text-foreground shadow-none max-w-[130px] truncate'
                  : 'size-6 p-0 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 [&>span]:hidden',
              )}
            />
          </div>
        )}

        {/* 8. Labels Pill (Visible on medium+ viewports) */}
        {showLabels && (
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {labelsList.slice(0, 2).map((l: any, i: number) => {
              const labelName = typeof l === 'string' ? l : l.name || l.title || 'label';
              const labelColor = typeof l === 'object' && l.color ? l.color : '#8b5cf6';
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setLabelOpen(true)}
                  aria-label={`Edit label: ${labelName}`}
                  className="h-6 px-2.5 text-11 font-normal rounded-full border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                  title={labelName}
                >
                  <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: labelColor }} />
                  <span className="truncate max-w-[70px]">{labelName}</span>
                </button>
              );
            })}

            <LabelPopover
              open={labelOpen}
              onOpenChange={setLabelOpen}
              labels={Array.isArray(item.labels) ? item.labels.map((l: any) => (typeof l === 'string' ? l : l.id)) : []}
              setLabels={(updater) => {
                const currentIds = Array.isArray(item.labels)
                  ? item.labels.map((l: any) => (typeof l === 'string' ? l : l.id))
                  : [];
                const nextIds = typeof updater === 'function' ? updater(currentIds) : updater;
                onUpdateItem?.(item.id, { labels: nextIds });
              }}
              actionBtnClass="size-6 p-0 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center shrink-0 [&>span]:hidden shadow-none"
            />
          </div>
        )}

        {/* 9. More Actions Dropdown (Touch & Hover Friendly) */}
        {!isReadOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shrink-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring flex items-center justify-center"
                aria-label="More options"
              >
                <MoreHorizontal className="size-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 text-xs z-100">
              <DropdownMenuItem
                onClick={() => onDuplicateCard(item)}
                className="cursor-pointer gap-2 py-1.5"
              >
                <Copy className="size-3.5 text-muted-foreground shrink-0" />
                <span>Duplicate</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onToggleExpandChildren?.(item.id)}
                className="cursor-pointer gap-2 py-1.5"
              >
                <CornerDownRight className="size-3.5 text-muted-foreground shrink-0" />
                <span>Add sub-item</span>
              </DropdownMenuItem>

              {currentUserId && (
                <DropdownMenuItem
                  onClick={() => (isCurrentUserAssignee ? onLeaveCard(item) : onJoinCard(item))}
                  className="cursor-pointer gap-2 py-1.5"
                >
                  {isCurrentUserAssignee ? (
                    <>
                      <UserMinus className="size-3.5 text-muted-foreground shrink-0" />
                      <span>Leave</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5 text-muted-foreground shrink-0" />
                      <span>Join</span>
                    </>
                  )}
                </DropdownMenuItem>
              )}

              {onRemoveFromCycle && item.cycle && (
                <DropdownMenuItem
                  onClick={() => onRemoveFromCycle(item)}
                  className="cursor-pointer gap-2 py-1.5"
                >
                  <RotateCcw className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Remove from cycle</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onDeleteCard(item)}
                className="cursor-pointer gap-2 py-1.5 text-destructive focus:text-destructive-foreground focus:bg-destructive"
              >
                <Trash2 className="size-3.5 shrink-0" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

// ── 4. Child Item Components (Hierarchical Nested Tree) ─────────────────────────

interface ChildItemRowProps {
  childItem: SubItem;
  parentItem: Item;
  index: number;
  columns: Column[];
  projectStates?: Column[];
  isReadOnly?: boolean;
  onEditCard: (item: Item) => void;
  onUpdateChildItem?: (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => void;
  onDeleteChildItem?: (parentItem: Item, childItemId: string, subIndex: number) => void;
}

const ChildItemRow = ({
  childItem,
  parentItem,
  index,
  columns,
  projectStates,
  isReadOnly = false,
  onEditCard,
  onUpdateChildItem,
  onDeleteChildItem,
}: ChildItemRowProps) => {
  const isDone = Boolean(childItem.completed || (childItem as any).stateGroup === 'completed' || (childItem as any).state?.group === 'completed' || childItem.columnId === 'done' || childItem.columnId === 'completed');
  const stateList = projectStates && projectStates.length > 0 ? projectStates : columns;
  const currentCol = stateList.find((c) => resolveColumnId(c) === childItem.columnId);
  const colTitle = currentCol?.title || currentCol?.name || childItem.columnId || 'Todo';
  const colColor = currentCol?.accentColor || currentCol?.color || (isDone ? '#10B981' : '#8A9093');

  const defaultUnstartedId = useMemo(() => {
    if (!Array.isArray(stateList) || stateList.length === 0) return 'todo';
    const col =
      stateList.find((c) => c.group === 'unstarted' && c.isDefault) ||
      stateList.find((c) => c.group === 'unstarted') ||
      stateList.find((c) => c.isDefault) ||
      stateList[0];
    return col ? resolveColumnId(col) : 'todo';
  }, [stateList]);

  const defaultCompletedId = useMemo(() => {
    if (!Array.isArray(stateList) || stateList.length === 0) return 'done';
    const col =
      stateList.find((c) => c.group === 'completed') ||
      stateList[stateList.length - 1];
    return col ? resolveColumnId(col) : 'done';
  }, [stateList]);

  return (
    <div className="group/sub relative h-9 pl-12 sm:pl-14 pr-3 sm:pr-4 flex items-center justify-between hover:bg-muted/60 select-none text-12 transition-colors duration-150 border-b border-border/40">
      {/* Left Tree Branch & Checkbox & Title */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
        <CornerDownRight className="size-3 text-muted-foreground/60 shrink-0 -ml-5" />

        <button
          type="button"
          disabled={isReadOnly}
          onClick={(e) => {
            e.stopPropagation();
            onUpdateChildItem?.(parentItem, childItem, index, {
              completed: !isDone,
              columnId: !isDone ? defaultCompletedId : defaultUnstartedId,
            });
          }}
          aria-label={`Mark sub-item as ${isDone ? 'incomplete' : 'complete'}`}
          className={cn(
            'size-3.5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer shrink-0',
            isDone
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-border hover:border-primary'
          )}
        >
          {isDone && <Check className="size-2.5 shrink-0 stroke-[3]" />}
        </button>

        {childItem.identifier && (
          <span className="font-mono text-11 font-medium text-muted-foreground shrink-0 tabular-nums">
            {childItem.identifier}
          </span>
        )}

        <span
          role="button"
          tabIndex={0}
          onClick={() => {
            onEditCard({
              ...parentItem,
              id: childItem.id,
              title: childItem.title,
              columnId: childItem.columnId || defaultUnstartedId,
              completed: isDone,
              parentId: parentItem.id,
            } as Item);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onEditCard({
                ...parentItem,
                id: childItem.id,
                title: childItem.title,
                columnId: childItem.columnId || defaultUnstartedId,
                completed: isDone,
                parentId: parentItem.id,
              } as Item);
            }
          }}
          className={cn(
            'truncate cursor-pointer hover:text-primary transition-colors text-12 font-normal',
            isDone ? 'line-through text-muted-foreground' : 'text-foreground'
          )}
          title={childItem.title}
        >
          {childItem.title}
        </span>
      </div>

      {/* Right Properties: Status dropdown + Delete action */}
      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={isReadOnly}>
            <button
              type="button"
              className="h-5 px-2 text-10 font-normal rounded-full border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1 shrink-0 transition-colors cursor-pointer outline-none"
            >
              <StatusIcon
                title={colTitle}
                group={currentCol?.group || currentCol?.slug || colTitle}
                color={colColor}
                className="size-2.5 shrink-0"
              />
              <span className="truncate max-w-[65px]">{colTitle}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 p-1 text-xs z-100">
            {stateList.map((col) => {
              const cId = resolveColumnId(col);
              const cTitle = col.title || col.name || 'Column';
              const cColor = col.color || col.accentColor || '#8A9093';
              const isCurr = cId === childItem.columnId;
              return (
                <DropdownMenuItem
                  key={cId}
                  onClick={() => {
                    const completed = col.group === 'completed' || cId === 'done' || cId === 'completed';
                    onUpdateChildItem?.(parentItem, childItem, index, { columnId: cId, completed });
                  }}
                  className={cn('gap-2 py-1 cursor-pointer text-11', isCurr && 'font-medium bg-muted')}
                >
                  <StatusIcon
                    id={cId}
                    title={cTitle}
                    group={col.group || col.slug || cTitle}
                    color={cColor}
                    className="size-3 shrink-0"
                  />
                  <span>{cTitle}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {!isReadOnly && onDeleteChildItem && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteChildItem(parentItem, childItem.id, index);
            }}
            aria-label="Delete sub-item"
            className="opacity-0 group-hover/sub:opacity-100 size-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
          >
            <Trash2 className="size-3 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};

const ChildItemQuickAdd = ({
  parentItem,
  onAddChildItem,
}: {
  parentItem: Item;
  onAddChildItem: (parentItemId: string, title: string) => void;
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleSubmit = () => {
    if (title.trim()) {
      onAddChildItem(parentItem.id, title.trim());
      setTitle('');
    }
  };

  return (
    <div className="pl-12 sm:pl-14 pr-3 sm:pr-4 h-8 flex items-center border-b border-border/40 bg-background/50">
      {isAdding ? (
        <div className="flex items-center gap-2 w-full">
          <CornerDownRight className="size-3 text-muted-foreground/60 shrink-0 -ml-5" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              } else if (e.key === 'Escape') {
                setIsAdding(false);
                setTitle('');
              }
            }}
            onBlur={() => {
              if (!title.trim()) setIsAdding(false);
            }}
            placeholder="Sub-item title... (Enter to save, Esc to cancel)"
            className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none font-normal"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-11 text-muted-foreground hover:text-foreground transition-colors cursor-pointer -ml-5"
        >
          <Plus className="size-3" />
          <span>Add sub-item</span>
        </button>
      )}
    </div>
  );
};

// ── 5. Sortable Item Row Wrapper (DnD & Nested Child Items) ───────────────────

export interface SortableItemRowProps extends ItemRowProps {
  onUpdateChildItem?: (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => void;
  onDeleteChildItem?: (parentItem: Item, childItemId: string, subIndex: number) => void;
  onAddChildItem?: (parentItemId: string, title: string) => void;
}

export const SortableItemRow = memo(function SortableItemRow({
  onUpdateChildItem,
  onDeleteChildItem,
  onAddChildItem,
  ...props
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    data: { item: props.item },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const childList: SubItem[] = useMemo(() => {
    if (props.item.childWorkItems && props.item.childWorkItems.length > 0) {
      return props.item.childWorkItems;
    }
    if (props.item.subItems && props.item.subItems.length > 0) {
      return props.item.subItems;
    }
    return [];
  }, [props.item.subItems, props.item.childWorkItems]);

  return (
    <div ref={setNodeRef} style={style}>
      <div {...attributes} {...listeners}>
        <ItemRow {...props} isDragging={isDragging} />
      </div>
      {props.isChildrenExpanded && (
        <div
          className="bg-muted/20 border-b border-border divide-y divide-border/40"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {childList.map((sub: SubItem, idx: number) => (
            <ChildItemRow
              key={sub.id || `sub_${idx}`}
              childItem={sub}
              parentItem={props.item}
              index={idx}
              columns={props.columns}
              projectStates={props.projectStates}
              isReadOnly={props.isReadOnly}
              onEditCard={props.onEditCard}
              onUpdateChildItem={onUpdateChildItem}
              onDeleteChildItem={onDeleteChildItem}
            />
          ))}
          {!props.isReadOnly && onAddChildItem && (
            <ChildItemQuickAdd
              parentItem={props.item}
              onAddChildItem={onAddChildItem}
            />
          )}
        </div>
      )}
    </div>
  );
});

// ── 5. Group Section Component (Collapsible, Polished & Keyboard Navigable) ──

interface ListViewGroupProps {
  group: {
    key: string;
    label: string;
    color?: string;
    column: Column;
    items: Item[];
  };
  columns: Column[];
  projectStates?: Column[];
  isExpanded: boolean;
  onToggleExpand: (key: string) => void;
  quickAddKey: string | null;
  setQuickAddKey: (key: string | null) => void;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (item: Item) => void;
  onDuplicateCard: (item: Item) => void;
  onJoinCard: (item: Item) => void;
  onLeaveCard: (item: Item) => void;
  onRemoveFromCycle?: (item: Item) => void;
  onDeleteCard: (item: Item) => void;
  onMoveCard: (itemId: string, targetColumnId: string) => void;
  onUpdateItem?: (itemId: string, data: any) => void;
  displayOptions?: DisplayOptions;
  members?: any[];
  cycles?: Cycle[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  isReadOnly?: boolean;
  projectPrefix?: string;
  expandedChildParentIds?: Set<string>;
  onToggleExpandChildren?: (itemId: string) => void;
  onUpdateChildItem?: (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => void;
  onDeleteChildItem?: (parentItem: Item, childItemId: string, subIndex: number) => void;
  onAddChildItem?: (parentItemId: string, title: string) => void;
}

const ListViewGroup = ({
  group,
  columns,
  projectStates,
  isExpanded,
  onToggleExpand,
  quickAddKey,
  setQuickAddKey,
  onAddCard,
  onEditCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onDeleteCard,
  onMoveCard,
  onUpdateItem,
  displayOptions,
  members = [],
  cycles = [],
  currentUserId,
  currentUserAvatar,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  isReadOnly = false,
  projectPrefix,
  expandedChildParentIds,
  onToggleExpandChildren,
  onUpdateChildItem,
  onDeleteChildItem,
  onAddChildItem,
}: ListViewGroupProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: group.key });
  const [quickTitle, setQuickTitle] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isAdding = quickAddKey === group.key;

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleQuickAdd = () => {
    const trimmed = quickTitle.trim();
    if (!trimmed) {
      setQuickAddKey(null);
      return;
    }
    setQuickTitle('');
    onAddCard(group.key, trimmed);
    // Keep focus for rapid sequential creation
  };

  const itemIds = useMemo(() => group.items.map((t) => t.id), [group.items]);

  // Group Selection Checkbox Calculation
  const selectedInGroup = useMemo(() => {
    return group.items.filter((t) => selectedIds.includes(t.id));
  }, [group.items, selectedIds]);

  const isAllGroupSelected = group.items.length > 0 && selectedInGroup.length === group.items.length;
  const isGroupIndeterminate = selectedInGroup.length > 0 && !isAllGroupSelected;

  const handleToggleGroupSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectAll) return;

    if (isAllGroupSelected) {
      // Deselect all in this group
      const remainingIds = selectedIds.filter((id: string) => !group.items.some((t) => t.id === id));
      onSelectAll(remainingIds);
    } else {
      // Select all in this group
      const allIds = Array.from(new Set([...selectedIds, ...group.items.map((t) => t.id)]));
      onSelectAll(allIds);
    }
  };

  return (
    <div ref={setNodeRef} className={cn('w-full', isOver && 'bg-muted')}>
      {/* Sticky Group Header Row (Keyboard Navigable & Accordion Affordance) */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Group ${group.label}, ${group.items.length} work items`}
        onClick={() => onToggleExpand(group.key)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand(group.key);
          }
        }}
        className="group/header relative h-10 pl-7 sm:pl-8 pr-3 sm:pr-4 flex items-center justify-between border-b border-border bg-secondary hover:bg-muted select-none cursor-pointer transition-colors focus-visible:outline-none"
      >
        {/* Group Multi-select Checkbox (Absolute at left-2, zero layout shift) */}
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="absolute left-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center z-10"
        >
          <GroupCheckbox
            checked={isAllGroupSelected}
            indeterminate={isGroupIndeterminate}
            onChange={handleToggleGroupSelection}
            disabled={group.items.length === 0}
            ariaLabel={`Select all items in ${group.label}`}
          />
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {/* State Status Icon */}
          <StatusIcon
            title={group.label}
            group={group.column?.group || group.column?.slug || group.label}
            color={group.color}
            className="size-3.5 shrink-0"
          />

          {/* Group Name */}
          <span className="text-13 font-medium text-foreground tracking-tight truncate">
            {group.label}
          </span>

          {/* Item Count (Tabular Numbers, no parentheses) */}
          <span className="text-13 text-muted-foreground font-medium tabular-nums ml-1 shrink-0">
            {group.items.length}
          </span>
        </div>

        {/* Quick Add Button on Header (+) */}
        {!isReadOnly && (
          <div
            className="flex items-center"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                if (!isExpanded) onToggleExpand(group.key);
                setQuickAddKey(group.key);
              }}
              className="size-5 rounded-xs flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label={`Add work item to ${group.label}`}
            >
              <Plus className="size-3.5 shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Group Items */}
      {isExpanded && (
        <div className="w-full">
          {group.items.length > 0 && (
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {group.items.map((item) => (
                <SortableItemRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  projectStates={projectStates}
                  currentColumn={group.column}
                  isSelected={selectedIds.includes(item.id)}
                  onToggleSelect={onToggleSelect}
                  onEditCard={onEditCard}
                  onDuplicateCard={onDuplicateCard}
                  onJoinCard={onJoinCard}
                  onLeaveCard={onLeaveCard}
                  onRemoveFromCycle={onRemoveFromCycle}
                  onDeleteCard={onDeleteCard}
                  onMoveCard={onMoveCard}
                  onUpdateItem={onUpdateItem}
                  displayOptions={displayOptions}
                  members={members}
                  cycles={cycles}
                  currentUserId={currentUserId}
                  currentUserAvatar={currentUserAvatar}
                  isReadOnly={isReadOnly}
                  isChildrenExpanded={expandedChildParentIds?.has(item.id)}
                  onToggleExpandChildren={onToggleExpandChildren}
                  onUpdateChildItem={onUpdateChildItem}
                  onDeleteChildItem={onDeleteChildItem}
                  onAddChildItem={onAddChildItem}
                />
              ))}
            </SortableContext>
          )}

          {/* Quick Add Form or Trigger Row */}
          {!isReadOnly && (
            <div>
              {isAdding ? (
                <div className="border-b border-border bg-background pl-7 sm:pl-8 pr-3 sm:pr-4 py-2">
                  <div className="h-8 flex items-center gap-2">
                    <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                    {projectPrefix && (
                      <span className="font-mono text-12 font-medium text-muted-foreground shrink-0 select-none tracking-tight tabular-nums">
                        {projectPrefix}
                      </span>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleQuickAdd();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setQuickAddKey(null);
                          setQuickTitle('');
                        }
                      }}
                      onBlur={() => {
                        if (!quickTitle.trim()) {
                          setQuickAddKey(null);
                        }
                      }}
                      placeholder="New work item"
                      aria-label="New work item title"
                      className="w-full bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none font-normal"
                    />
                  </div>
                  <div className="pl-5.5 text-11 text-muted-foreground select-none">
                    Press <kbd className="font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground text-10">Enter</kbd> to add another, <kbd className="font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground text-10">Esc</kbd> to cancel
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuickAddKey(group.key)}
                  className="h-9 pl-7 sm:pl-8 pr-3 sm:pr-4 w-full flex items-center gap-2 text-13 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer border-b border-border text-left font-normal transition-colors focus-visible:outline-none"
                >
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>New work item</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── 6. Main ListView Export ──────────────────────────────────────────────────

export interface ListViewProps extends BaseWorkItemViewProps, WorkItemCardHandlers {
  columns: Column[];
  projectStates?: Column[];
  itemsByColumnId?: Map<string, Item[]> | Record<string, Item[]>;
  onAddCard: (columnId: string, title?: string) => void;
  onUpdateItem?: (id: string, data: any) => void;
  isAddingCard?: boolean;
  projectId: string;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: ((ids?: string[]) => void) | (() => void);
  members?: any[];
  cycles?: Cycle[];
}

export function ListView({
  itemsByColumnId: propItemsByColumnId,
  columns,
  projectStates,
  currentUserId,
  currentUserAvatar,
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onJoinCard,
  onLeaveCard,
  onRemoveFromCycle,
  onMoveCard,
  onUpdateItem,
  isReadOnly = false,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  displayOptions,
  members = [],
  cycles = [],
}: ListViewProps) {
  // Groups with items are expanded by default (matching Plane.so behavior)
  const itemsByColumnId = propItemsByColumnId || new Map();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    columns.forEach((col) => {
      const colId = resolveColumnId(col);
      const items =
        itemsByColumnId instanceof Map
          ? itemsByColumnId.get(colId) ?? []
          : (itemsByColumnId as Record<string, Item[]>)?.[colId] ?? [];
      if (items.length > 0) {
        initial.add(colId);
      }
    });
    // If all groups are empty, expand the first group
    if (initial.size === 0 && columns.length > 0) {
      initial.add(resolveColumnId(columns[0]));
    }
    return initial;
  });

  const [quickAddKey, setQuickAddKey] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [expandedChildParentIds, setExpandedChildParentIds] = useState<Set<string>>(new Set());

  const defaultUnstartedColumnId = useMemo(() => {
    if (!Array.isArray(columns) || columns.length === 0) return 'todo';
    const col =
      columns.find((c) => c.group === 'unstarted' && c.isDefault) ||
      columns.find((c) => c.group === 'unstarted') ||
      columns.find((c) => c.isDefault) ||
      columns[0];
    return col ? resolveColumnId(col) : 'todo';
  }, [columns]);

  const handleToggleExpandChildren = useCallback((itemId: string) => {
    setExpandedChildParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update expanded keys when columns or items change (auto-expand newly populated columns)
  useEffect(() => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      columns.forEach((col) => {
        const id = resolveColumnId(col);
        const items =
          itemsByColumnId instanceof Map
            ? itemsByColumnId.get(id) ?? []
            : (itemsByColumnId as Record<string, Item[]>)?.[id] ?? [];
        if (items.length > 0 && !prev.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [columns, itemsByColumnId]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const groups = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    const rawGroups = columns.map((col) => {
      const colId = resolveColumnId(col);
      const colColor = col.color || col.accentColor || '#8A9093';

      return {
        key: colId,
        label: col.title || col.name || 'Backlog',
        color: colColor,
        column: {
          ...col,
          accentColor: colColor,
          color: colColor,
        },
        items:
          itemsByColumnId instanceof Map
            ? itemsByColumnId.get(colId) ?? []
            : (itemsByColumnId as Record<string, Item[]>)?.[colId] ?? [],
      };
    });

    if (displayOptions?.showEmptyGroups === false && displayOptions?.groupBy !== 'none') {
      const filtered = rawGroups.filter((g) => g.items.length > 0);
      return filtered.length > 0 ? filtered : rawGroups;
    }
    return rawGroups;
  }, [columns, itemsByColumnId, displayOptions?.showEmptyGroups, displayOptions?.groupBy]);

  const projectPrefix = useMemo(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (item.identifier && item.identifier.includes('-')) {
          return item.identifier.split('-')[0];
        }
      }
    }
    return '';
  }, [groups]);

  const handleUpdateChildItem = useCallback(
    async (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => {
      const childList: SubItem[] = (parentItem.subItems && parentItem.subItems.length > 0)
        ? [...parentItem.subItems]
        : [];

      const updated = childList.map((s, idx) => {
        if ((s.id && s.id === childItem.id) || idx === subIndex) {
          return { ...s, ...data };
        }
        return s;
      });

      onUpdateItem?.(parentItem.id, {
        subItems: updated,
      });

      if (childItem.id && !childItem.id.startsWith('sub_')) {
        try {
          await CoreService.update({
            id: childItem.id,
            ...(data.title !== undefined && { title: data.title }),
            ...(data.columnId !== undefined && { columnId: data.columnId }),
            ...(data.completed !== undefined && { completed: data.completed }),
          });
        } catch {
          // Handled
        }
      }
    },
    [onUpdateItem]
  );

  const handleDeleteChildItem = useCallback(
    async (parentItem: Item, childItemId: string, subIndex: number) => {
      const childList: SubItem[] = (parentItem.subItems && parentItem.subItems.length > 0)
        ? [...parentItem.subItems]
        : [];

      const updated = childList.filter((s, idx) => (s.id ? s.id !== childItemId : idx !== subIndex));

      onUpdateItem?.(parentItem.id, {
        subItems: updated,
      });

      if (childItemId && !childItemId.startsWith('sub_')) {
        try {
          await CoreService.delete(childItemId);
        } catch {
          // Handled
        }
      }
    },
    [onUpdateItem]
  );

  const handleAddChildItem = useCallback(
    async (parentItemId: string, title: string) => {
      if (!title.trim()) return;
      try {
        await CoreService.createSubItem(parentItemId, {
          title: title.trim(),
          columnId: defaultUnstartedColumnId,
        });
        setExpandedChildParentIds((prev) => new Set(prev).add(parentItemId));
      } catch {
        for (const group of groups) {
          const parent = group.items.find((t: Item) => t.id === parentItemId);
          if (parent) {
            const currentSubs = parent.subItems || [];
            const newSub: SubItem = {
              id: `sub_${Date.now()}`,
              title: title.trim(),
              columnId: defaultUnstartedColumnId,
              completed: false,
              rank: currentSubs.length,
            };
            onUpdateItem?.(parentItemId, {
              subItems: [...currentSubs, newSub],
            });
            break;
          }
        }
      }
    },
    [groups, onUpdateItem, defaultUnstartedColumnId]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const item = event.active.data.current?.item as Item | undefined;
    if (item) setActiveItem(item);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // If dropped directly onto a column droppable
    const isOverGroup = columns.some((c) => resolveColumnId(c) === overId);
    if (isOverGroup) {
      const item = active.data.current?.item as Item | undefined;
      if (item && item.columnId !== overId) {
        onMoveCard(activeId, overId);
      }
      return;
    }

    // If dropped onto another item, find target item's column
    for (const group of groups) {
      if (group.items.some((t: Item) => t.id === overId)) {
        const item = active.data.current?.item as Item | undefined;
        if (item && item.columnId !== group.key) {
          onMoveCard(activeId, group.key);
        }
        break;
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full flex-1 overflow-y-auto bg-background pb-16">
        {groups.length === 0 ? (
          <div className="w-full py-16 flex flex-col items-center justify-center text-center px-4">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <LayoutGrid className="size-5 shrink-0" />
            </div>
            <h3 className="text-14 font-medium text-foreground mb-1">No columns configured</h3>
            <p className="text-12 text-muted-foreground max-w-xs">
              This project does not have any status columns set up yet.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <ListViewGroup
              key={group.key}
              group={group}
              columns={columns}
              projectStates={projectStates}
              isExpanded={expandedKeys.has(group.key)}
              onToggleExpand={toggleExpand}
              quickAddKey={quickAddKey}
              setQuickAddKey={setQuickAddKey}
              onAddCard={onAddCard}
              onEditCard={onEditCard}
              onDuplicateCard={onDuplicateCard}
              onJoinCard={onJoinCard}
              onLeaveCard={onLeaveCard}
              onRemoveFromCycle={onRemoveFromCycle}
              onDeleteCard={onDeleteCard}
              onMoveCard={onMoveCard}
              onUpdateItem={onUpdateItem}
              displayOptions={displayOptions}
              members={members}
              cycles={cycles}
              currentUserId={currentUserId}
              currentUserAvatar={currentUserAvatar}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onSelectAll={onSelectAll as (ids: string[]) => void}
              isReadOnly={isReadOnly}
              projectPrefix={projectPrefix}
              expandedChildParentIds={expandedChildParentIds}
              onToggleExpandChildren={handleToggleExpandChildren}
              onUpdateChildItem={handleUpdateChildItem}
              onDeleteChildItem={handleDeleteChildItem}
              onAddChildItem={handleAddChildItem}
            />
          ))
        )}
      </div>

      {isMounted &&
        activeItem &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className="w-[calc(100vw-32px)] max-w-3xl bg-background text-foreground border border-border rounded-md overflow-hidden opacity-95 ring-1 ring-ring">
              <ItemRow
                item={activeItem}
                columns={columns}
                projectStates={projectStates}
                currentColumn={columns.find((c) => resolveColumnId(c) === activeItem.columnId)}
                onEditCard={() => {}}
                onDuplicateCard={() => {}}
                onJoinCard={() => {}}
                onLeaveCard={() => {}}
                onDeleteCard={() => {}}
                onMoveCard={() => {}}
                displayOptions={displayOptions}
                members={members}
                cycles={cycles}
                isDragging={true}
              />
            </div>
          </DragOverlay>,
          document.body,
        )}
    </DndContext>
  );
}

export default ListView;
