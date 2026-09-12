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
import { TaskHelpers } from '../../utils/util';
import { StatusIcon } from '../StatusIcon';
import {
  PriorityPopover,
  MemberPopover,
  SingleDatePopover,
  CyclePopover,
  LabelPopover,
} from '../modals/Popovers';
import type {
  Task,
  Column,
  TaskPriority,
  DisplayOptions,
  Cycle,
} from '../../types/types';
import { resolveTaskColumnId, resolveTaskColumnColor } from '../../types/types';

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
  ariaLabel = 'Select all tasks in this group',
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

// ── 3. Task Row Component (Responsive, Scannable & Hardened) ──────────────────

interface TaskRowProps {
  task: Task;
  columns: Column[];
  currentColumn?: Column;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEditCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onJoinCard: (task: Task) => void;
  onLeaveCard: (task: Task) => void;
  onRemoveFromCycle?: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onMoveCard: (taskId: string, targetColumnId: string) => void;
  onUpdateTask?: (taskId: string, data: any) => void;
  displayOptions?: DisplayOptions;
  members?: any[];
  cycles?: Cycle[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  isDragging?: boolean;
  isReadOnly?: boolean;
}

const TaskRow = ({
  task,
  columns,
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
  onUpdateTask,
  displayOptions,
  members = [],
  cycles = [],
  currentUserId,
  isDragging = false,
  isReadOnly = false,
}: TaskRowProps) => {
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
  const showStartDate = Boolean(propsConfig?.startDate || task.startDate);
  const showDueDate = propsConfig?.dueDate !== false;
  const showAssignee = propsConfig?.assignee !== false;
  const showAttach = propsConfig?.attach !== false;
  const showCycle = propsConfig?.cycle !== false;
  const showLabels = propsConfig?.labels !== false;

  const priorityKey = (task.priority || 'none').toLowerCase() as TaskPriority;

  const assignee = TaskHelpers.resolveAssignee(task);
  const assigneeId = TaskHelpers.resolveAssigneeId(task);
  const isCurrentUserAssignee = Boolean(currentUserId && assigneeId === currentUserId);

  const formattedStart = formatDueDate(task.startDate);
  const formattedDue = formatDueDate(task.dueDate);

  // Overdue and Due Today Calculations for Colorization
  const isOverdue = useMemo(() => {
    if (!task.dueDate || task.completed) return false;
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  }, [task.dueDate, task.completed]);

  const isDueToday = useMemo(() => {
    if (!task.dueDate || task.completed) return false;
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    return (
      due.getFullYear() === today.getFullYear() &&
      due.getMonth() === today.getMonth() &&
      due.getDate() === today.getDate()
    );
  }, [task.dueDate, task.completed]);

  // Attachments / modules count
  const attachItems = useMemo(() => {
    const attachObj = (task as any).attach;
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
  }, [task]);

  const attachLabel = useMemo(() => {
    if (attachItems.length === 0) return null;
    if (attachItems.length === 1) return attachItems[0].title;
    return `${attachItems.length} modules`;
  }, [attachItems]);

  // Cycle resolving
  const cycleName = useMemo(() => {
    if (!task.cycle) return null;
    if (typeof task.cycle === 'object' && task.cycle !== null) {
      return (task.cycle as { name?: string }).name || null;
    }
    if (typeof task.cycle === 'string') return task.cycle;
    return null;
  }, [task.cycle]);

  const taskCycleId = useMemo(() => {
    if (typeof task.cycle === 'object' && task.cycle !== null) {
      return (task.cycle as any).id || null;
    }
    return task.cycleId || null;
  }, [task.cycle, task.cycleId]);

  // Labels resolving
  const labelsList = useMemo(() => {
    if (!Array.isArray(task.labels) || task.labels.length === 0) return [];
    return task.labels.filter(Boolean);
  }, [task.labels]);

  const colTitle = currentColumn?.title || currentColumn?.name || 'Backlog';
  const currentColor =
    currentColumn?.accentColor ||
    currentColumn?.color ||
    resolveTaskColumnColor(task.columnId, currentColumn?.accentColor);

  return (
    <div
      className={cn(
        'group/row relative h-10 pl-7 sm:pl-8 pr-3 sm:pr-4 flex items-center justify-between border-b border-border bg-background hover:bg-muted select-none text-13 transition-colors duration-150',
        isDragging && 'opacity-50 bg-muted',
        isSelected && 'bg-muted font-medium',
        task.completed && 'opacity-75',
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
            onToggleSelect?.(task.id);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select task ${task.identifier || task.title || 'untitled'}`}
          className={cn(
            'size-3.5 rounded-sm border border-border text-primary focus:ring-1 focus:ring-ring focus:outline-none cursor-pointer shrink-0 accent-primary transition-opacity duration-150',
            isSelected
              ? 'opacity-100 pointer-events-auto'
              : 'max-sm:opacity-100 max-sm:pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover/row:opacity-100 sm:group-hover/row:pointer-events-auto group-focus-within/row:opacity-100 group-focus-within/row:pointer-events-auto focus:opacity-100 focus:pointer-events-auto',
          )}
        />
      </div>

      {/* Left: Identifier & Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3 sm:mr-4">
        {/* Work Item Identifier (e.g. TIEPT-3) */}
        {showId && task.identifier && (
          <span className="font-mono text-12 font-medium text-muted-foreground uppercase shrink-0 select-none tracking-tight tabular-nums mr-1">
            {task.identifier}
          </span>
        )}

        {/* Work Item Title (Accessible Keyboard Trigger + Drawer Open) */}
        <span
          role="button"
          tabIndex={0}
          onClick={() => onEditCard(task)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onEditCard(task);
            }
          }}
          className={cn(
            'font-normal truncate cursor-pointer text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:underline',
            task.completed && 'text-muted-foreground line-through',
            !task.title?.trim() && 'italic text-muted-foreground',
          )}
          title={task.title || 'Untitled work item'}
        >
          {task.title?.trim() || '(Untitled work item)'}
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
                  title={colTitle}
                  group={currentColumn?.group || currentColumn?.slug || colTitle}
                  color={currentColor}
                  className="size-3 shrink-0"
                />
                <span className="truncate max-w-[70px] sm:max-w-[95px]">{colTitle}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 text-xs z-100">
              {columns.map((col) => {
                const cId = resolveTaskColumnId(col);
                const isCurr = cId === task.columnId;
                const cTitle = col.title || col.name || 'Column';
                const cColor = col.accentColor || col.color || resolveTaskColumnColor(cId, col.accentColor);
                return (
                  <DropdownMenuItem
                    key={cId}
                    onClick={() => onMoveCard(task.id, cId)}
                    className={cn(
                      'flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-sm',
                      isCurr && 'bg-muted font-medium',
                    )}
                  >
                    <StatusIcon
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
              priority={priorityKey as TaskPriority}
              setPriority={(p) => onUpdateTask?.(task.id, { priority: p })}
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
              date={task.startDate || ''}
              onSelectDate={(d) => onUpdateTask?.(task.id, { startDate: d || null })}
              actionBtnClass={cn(
                task.startDate
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
              date={task.dueDate || ''}
              onSelectDate={(d) => onUpdateTask?.(task.id, { dueDate: d || null })}
              actionBtnClass={cn(
                task.dueDate
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
            {assignee ? (
              <button
                type="button"
                onClick={() => setAssigneeOpen(true)}
                disabled={isReadOnly}
                className="size-6 rounded-full border border-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all"
                title={assignee.name || 'Assignee'}
              >
                <Avatar className="size-full">
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
              setAssigneeId={(id) => onUpdateTask?.(task.id, { assigneeId: id })}
              members={members}
              actionBtnClass="hidden"
            />
          </div>
        )}

        {/* 6. Attachments / Modules Pill (Hidden on smaller screens to prevent title squashing) */}
        {showAttach && attachLabel && (
          <button
            type="button"
            onClick={() => onEditCard(task)}
            className="h-6 px-2.5 text-11 font-normal rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground hidden xl:flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title="Attached modules/pages/files"
          >
            <LayoutGrid className="size-3 shrink-0" />
            <span className="truncate max-w-[100px]">{attachLabel}</span>
          </button>
        )}

        {/* 7. Cycle Pill (Visible on large viewports) */}
        {showCycle && (
          <div className="shrink-0 hidden lg:flex">
            <CyclePopover
              open={cycleOpen}
              onOpenChange={setCycleOpen}
              cycleId={taskCycleId}
              setCycleId={(id) => onUpdateTask?.(task.id, { cycleId: id })}
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
              labels={Array.isArray(task.labels) ? task.labels.map((l: any) => (typeof l === 'string' ? l : l.id)) : []}
              setLabels={(updater) => {
                const currentIds = Array.isArray(task.labels)
                  ? task.labels.map((l: any) => (typeof l === 'string' ? l : l.id))
                  : [];
                const nextIds = typeof updater === 'function' ? updater(currentIds) : updater;
                onUpdateTask?.(task.id, { labels: nextIds });
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
                onClick={() => onDuplicateCard(task)}
                className="cursor-pointer gap-2 py-1.5"
              >
                <Copy className="size-3.5 text-muted-foreground shrink-0" />
                <span>Duplicate</span>
              </DropdownMenuItem>

              {currentUserId && (
                <DropdownMenuItem
                  onClick={() => (isCurrentUserAssignee ? onLeaveCard(task) : onJoinCard(task))}
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

              {onRemoveFromCycle && task.cycle && (
                <DropdownMenuItem
                  onClick={() => onRemoveFromCycle(task)}
                  className="cursor-pointer gap-2 py-1.5"
                >
                  <RotateCcw className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Remove from cycle</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onDeleteCard(task)}
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

// ── 4. Sortable Task Row Wrapper (DnD) ───────────────────────────────────────

const SortableTaskRow = memo(function SortableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    data: { task: props.task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskRow {...props} isDragging={isDragging} />
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
    items: Task[];
  };
  columns: Column[];
  isExpanded: boolean;
  onToggleExpand: (key: string) => void;
  quickAddKey: string | null;
  setQuickAddKey: (key: string | null) => void;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onJoinCard: (task: Task) => void;
  onLeaveCard: (task: Task) => void;
  onRemoveFromCycle?: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onMoveCard: (taskId: string, targetColumnId: string) => void;
  onUpdateTask?: (taskId: string, data: any) => void;
  displayOptions?: DisplayOptions;
  members?: any[];
  cycles?: Cycle[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (id: string) => void;
  onSelectAllTasks?: (taskIds: string[]) => void;
  isReadOnly?: boolean;
  projectPrefix?: string;
}

const ListViewGroup = ({
  group,
  columns,
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
  onUpdateTask,
  displayOptions,
  members = [],
  cycles = [],
  currentUserId,
  currentUserAvatar,
  selectedTaskIds = [],
  onToggleSelectTask,
  onSelectAllTasks,
  isReadOnly = false,
  projectPrefix,
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
    return group.items.filter((t) => selectedTaskIds.includes(t.id));
  }, [group.items, selectedTaskIds]);

  const isAllGroupSelected = group.items.length > 0 && selectedInGroup.length === group.items.length;
  const isGroupIndeterminate = selectedInGroup.length > 0 && !isAllGroupSelected;

  const handleToggleGroupSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectAllTasks) return;

    if (isAllGroupSelected) {
      // Deselect all in this group
      const remainingIds = selectedTaskIds.filter((id) => !group.items.some((t) => t.id === id));
      onSelectAllTasks(remainingIds);
    } else {
      // Select all in this group
      const allIds = Array.from(new Set([...selectedTaskIds, ...group.items.map((t) => t.id)]));
      onSelectAllTasks(allIds);
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
            ariaLabel={`Select all tasks in ${group.label}`}
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
              {group.items.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  columns={columns}
                  currentColumn={group.column}
                  isSelected={selectedTaskIds.includes(task.id)}
                  onToggleSelect={onToggleSelectTask}
                  onEditCard={onEditCard}
                  onDuplicateCard={onDuplicateCard}
                  onJoinCard={onJoinCard}
                  onLeaveCard={onLeaveCard}
                  onRemoveFromCycle={onRemoveFromCycle}
                  onDeleteCard={onDeleteCard}
                  onMoveCard={onMoveCard}
                  onUpdateTask={onUpdateTask}
                  displayOptions={displayOptions}
                  members={members}
                  cycles={cycles}
                  currentUserId={currentUserId}
                  currentUserAvatar={currentUserAvatar}
                  isReadOnly={isReadOnly}
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
                      <span className="font-mono text-12 font-medium text-muted-foreground uppercase shrink-0 select-none tracking-tight tabular-nums">
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

export interface ListViewProps {
  tasksByColumnId: Map<string, Task[]> | Record<string, Task[]>;
  columns: Column[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onJoinCard: (task: Task) => void;
  onLeaveCard: (task: Task) => void;
  onRemoveFromCycle?: (task: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  onUpdateTask?: (taskId: string, data: any) => void;
  onAddColumn?: () => void;
  onEditColumn?: (column: Column) => void;
  onDeleteColumn?: (column: Column) => void;
  isAddingCard?: boolean;
  projectId: string;
  isReadOnly?: boolean;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (taskId: string) => void;
  onSelectAllTasks?: (taskIds: string[]) => void;
  displayOptions?: DisplayOptions;
  members?: any[];
  cycles?: Cycle[];
}

export function ListView({
  tasksByColumnId,
  columns,
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
  onUpdateTask,
  isReadOnly = false,
  selectedTaskIds = [],
  onToggleSelectTask,
  onSelectAllTasks,
  displayOptions,
  members = [],
  cycles = [],
}: ListViewProps) {
  // Groups with items are expanded by default (matching Plane.so behavior)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    columns.forEach((col) => {
      const colId = resolveTaskColumnId(col);
      const items =
        tasksByColumnId instanceof Map
          ? tasksByColumnId.get(colId) ?? []
          : (tasksByColumnId as Record<string, Task[]>)?.[colId] ?? [];
      if (items.length > 0) {
        initial.add(colId);
      }
    });
    // If all groups are empty, expand the first group
    if (initial.size === 0 && columns.length > 0) {
      initial.add(resolveTaskColumnId(columns[0]));
    }
    return initial;
  });

  const [quickAddKey, setQuickAddKey] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Update expanded keys when columns or tasks change (auto-expand newly populated columns)
  useEffect(() => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      columns.forEach((col) => {
        const id = resolveTaskColumnId(col);
        const items =
          tasksByColumnId instanceof Map
            ? tasksByColumnId.get(id) ?? []
            : (tasksByColumnId as Record<string, Task[]>)?.[id] ?? [];
        if (items.length > 0 && !prev.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [columns, tasksByColumnId]);

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
    return columns.map((col) => {
      const colId = resolveTaskColumnId(col);
      const groupKey = (col.group || '').toLowerCase();
      const titleLower = (col.title || col.name || '').toLowerCase();
      const fallbackColor =
        groupKey === 'backlog' || titleLower.includes('backlog') ? '#8A9093' :
        groupKey === 'unstarted' || titleLower.includes('todo') || titleLower.includes('to do') ? '#525866' :
        groupKey === 'started' || titleLower.includes('progress') || titleLower.includes('doing') ? '#F59E0B' :
        groupKey === 'completed' || titleLower.includes('done') || titleLower.includes('completed') ? '#10B981' :
        groupKey === 'cancelled' || titleLower.includes('cancel') ? '#EF4444' :
        '#8A9093';

      const resolved = col.accentColor || col.color || resolveTaskColumnColor(colId, col.accentColor) || fallbackColor;
      const colColor = (resolved === '#6B7280' || resolved === '#6366F1' || resolved === '#0EA5E9') ? fallbackColor : resolved;

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
          tasksByColumnId instanceof Map
            ? tasksByColumnId.get(colId) ?? []
            : (tasksByColumnId as Record<string, Task[]>)?.[colId] ?? [],
      };
    });
  }, [columns, tasksByColumnId]);

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

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // If dropped directly onto a column droppable
    const isOverGroup = columns.some((c) => resolveTaskColumnId(c) === overId);
    if (isOverGroup) {
      const task = active.data.current?.task as Task | undefined;
      if (task && task.columnId !== overId) {
        onMoveCard(activeId, overId);
      }
      return;
    }

    // If dropped onto another task, find target task's column
    for (const group of groups) {
      if (group.items.some((t) => t.id === overId)) {
        const task = active.data.current?.task as Task | undefined;
        if (task && task.columnId !== group.key) {
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
              onUpdateTask={onUpdateTask}
              displayOptions={displayOptions}
              members={members}
              cycles={cycles}
              currentUserId={currentUserId}
              currentUserAvatar={currentUserAvatar}
              selectedTaskIds={selectedTaskIds}
              onToggleSelectTask={onToggleSelectTask}
              onSelectAllTasks={onSelectAllTasks}
              isReadOnly={isReadOnly}
              projectPrefix={projectPrefix}
            />
          ))
        )}
      </div>

      {isMounted &&
        activeTask &&
        createPortal(
          <DragOverlay dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div className="w-[calc(100vw-32px)] max-w-3xl bg-background text-foreground border border-border rounded-md overflow-hidden opacity-95 ring-1 ring-ring">
              <TaskRow
                task={activeTask}
                columns={columns}
                currentColumn={columns.find((c) => resolveTaskColumnId(c) === activeTask.columnId)}
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
