'use client';

import React, { useState, useMemo, memo } from 'react';
import {
  ChevronRight,
  CornerDownRight,
  Copy,
  UserMinus,
  UserPlus,
  Trash2,
  MoreHorizontal,
  User,
  Paperclip,
  Link2,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { StatusIcon } from '@/shared/components/icons';
import { cn } from '@/shared/lib/utils';
import { ItemHelpers, resolveColumnId } from '../../../utils/work-item.utils';
import { PriorityPopover } from '../../pickers/PriorityPicker';
import { MemberPopover, AvatarStack } from '../../pickers/MemberPicker';
import { SingleDatePopover } from '../../pickers/DatePicker';
import { LabelPopover } from '../../pickers/LabelPicker';
import type { Item, Priority, SubItem } from '../../../types/work-item.types';
import type { ItemRowProps } from '../../../types/list-view.types';
import {
  PRIORITY_THEME_CLASSES,
  formatDueDate,
  EMPTY_ARRAY,
} from '../../../utils/list.utils';

export const ItemRow = memo(function ItemRow({
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
  onDeleteCard,
  onMoveCard,
  onUpdateItem,
  displayOptions,
  members = EMPTY_ARRAY,
  currentUserId,
  isDragging = false,
  isReadOnly = false,
  isChildrenExpanded = false,
  onToggleExpandChildren,
}: ItemRowProps) {
  // Popover state triggers for inline editing
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  // Property visibility flags from displayOptions
  const propsConfig = displayOptions?.properties;
  const showId = propsConfig?.id !== false;
  const showState = propsConfig?.state !== false;
  const showPriority = propsConfig?.priority !== false;
  const showStartDate = Boolean(propsConfig?.startDate) || (Boolean(item.startDate) && Boolean(item.dueDate));
  const showDueDate = propsConfig?.dueDate !== false;
  const showAssignee = propsConfig?.assignee !== false;
  const showAttach = propsConfig?.attach !== false;
  const showLabels = propsConfig?.labels !== false;
  const showSubIssues = Boolean(propsConfig?.childWorkItemCount ?? propsConfig?.subItemCount);
  const showLinks = Boolean(propsConfig?.link);

  const rawItem = item as Item & {
    linkCount?: number;
    links?: unknown[];
    attach?: {
      links?: unknown[];
      pages?: Array<{ id: string; title?: string }>;
      papers?: Array<{ id: string; title?: string }>;
      files?: Array<{ id: string; name?: string; title?: string }>;
    };
  };

  const linksCount = useMemo(() => {
    if (typeof rawItem.linkCount === 'number') return rawItem.linkCount;
    if (Array.isArray(rawItem.links)) return rawItem.links.length;
    const attachObj = item.attachments || rawItem.attach;
    if (attachObj && typeof attachObj === 'object' && 'links' in attachObj && Array.isArray(attachObj.links)) {
      return attachObj.links.length;
    }
    return 0;
  }, [rawItem.links, item.attachments, rawItem.attach, rawItem.linkCount]);

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

  // Attachments count
  const attachItems = useMemo(() => {
    const attachObj = rawItem.attach;
    if (!attachObj) return [];
    const itemsList: Array<{ id: string; title: string }> = [];
    if (Array.isArray(attachObj.pages)) {
      attachObj.pages.forEach((p) => itemsList.push({ id: p.id, title: p.title || 'Page' }));
    }
    if (Array.isArray(attachObj.papers)) {
      attachObj.papers.forEach((p) => itemsList.push({ id: p.id, title: p.title || 'Paper' }));
    }
    if (Array.isArray(attachObj.files)) {
      attachObj.files.forEach((f) => itemsList.push({ id: f.id, title: f.name || f.title || 'File' }));
    }
    if (Array.isArray(attachObj.links)) {
      const linksArr = attachObj.links as Array<{ id?: string; title?: string }>;
      linksArr.forEach((l) => itemsList.push({ id: l.id || '', title: l.title || 'Link' }));
    }
    return itemsList;
  }, [rawItem.attach]);

  const attachLabel = useMemo(() => {
    if (attachItems.length === 0) return null;
    if (attachItems.length === 1) return attachItems[0].title;
    return `${attachItems.length} attachments`;
  }, [attachItems]);

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
    '#6B7280';
  const stateGroup = resolvedState?.group || item.stateGroup || item.state?.group || colTitle;
  const isCancelled = stateGroup === 'cancelled' || item.columnId === 'cancelled' || item.columnId === 'cancel';

  return (
    <div
      className={cn(
        'group/row relative h-9 pl-9 pr-2 sm:pr-2.5 flex items-center justify-between border-b border-border bg-background hover:bg-muted/40 select-none text-13 transition-colors duration-0',
        isDragging && 'opacity-50 bg-muted',
        isSelected && 'font-medium',
        item.completed && 'opacity-75',
      )}
    >
      {/* Gutter: Selection Checkbox + Drag Grip handle */}
      <div
        className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="size-4 flex items-center justify-center cursor-pointer before:absolute before:-inset-2.5 md:before:hidden">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect?.(item.id)}
            aria-label={`Select item ${item.identifier || item.title || 'untitled'}`}
            className={cn(
              'size-3.5 rounded-sm transition-opacity duration-150',
              isSelected
                ? 'opacity-100 pointer-events-auto'
                : 'max-sm:opacity-100 max-sm:pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover/row:opacity-100 sm:group-hover/row:pointer-events-auto group-focus-within/row:opacity-100 group-focus-within/row:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto',
            )}
          />
        </div>
        {!isReadOnly && (
          <div
            className="size-3.5 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground opacity-0 group-hover/row:opacity-100 transition-opacity"
            title="Drag to reorder"
          >
            <GripVertical className="size-3 shrink-0" />
          </div>
        )}
      </div>

      {/* Left: Identifier & Title */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-3 sm:mr-4">
        {/* Child Items Expand/Collapse Toggle */}
        {(() => {
          const childList = (item.childWorkItems && item.childWorkItems.length > 0)
            ? item.childWorkItems
            : (item.subItems || []);
          if (childList.length === 0) return null;
          const completedCount = childList.filter(
            (s: Item | SubItem) => s.completed || s.columnId === 'done' || s.columnId === 'completed'
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
                className="size-4.5 rounded-md flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer -ml-0.5"
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
                  className="font-mono text-11 font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md tabular-nums shrink-0 cursor-pointer hover:bg-muted/80"
                >
                  {completedCount}/{childList.length}
                </span>
              )}
            </div>
          );
        })()}

        {/* Work Item Identifier (e.g. TIEPT-3) */}
        {showId && item.identifier && (
          <span className="font-mono text-12 font-medium text-muted-foreground shrink-0 select-none tracking-tight tabular-nums mr-1.5">
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
            'font-normal truncate cursor-pointer text-foreground transition-colors focus-visible:outline-none',
            isCancelled && 'text-muted-foreground line-through',
            item.completed && !isCancelled && 'text-muted-foreground',
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
        {/* 1. State Pill (Icon button without redundant column name label) */}
        {showState && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={isReadOnly}>
              <button
                type="button"
                className="relative size-6 text-11 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center shrink-0 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
                title={`State: ${colTitle}`}
                aria-label={`State: ${colTitle}`}
              >
                <StatusIcon
                  id={item.columnId}
                  title={colTitle}
                  group={stateGroup}
                  color={currentColor}
                  className="size-3.5 shrink-0"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 text-xs z-100 shadow-overlay">
              {(projectStates && projectStates.length > 0 ? projectStates : columns).map((col) => {
                const cId = resolveColumnId(col);
                const isCurr = cId === item.columnId;
                const cTitle = col.title || col.name || 'Column';
                const cColor = col.color || col.accentColor || '#6B7280';
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
                      'flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-md',
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
                'h-6 px-2.5 text-11 font-normal rounded-md border transition-colors shadow-none',
                PRIORITY_THEME_CLASSES[priorityKey] || PRIORITY_THEME_CLASSES.none,
              )}
            />
          </div>
        )}

        {/* 3. Assignee Pill (Interactive Member Popover) */}
        {showAssignee && (
          <div className="relative shrink-0">
            {resolvedAssignees.length > 1 ? (
              <button
                type="button"
                onClick={() => setAssigneeOpen(true)}
                disabled={isReadOnly}
                className="relative cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all rounded-full shrink-0 before:absolute before:-inset-1 md:before:hidden"
                title={`${resolvedAssignees.length} assignees`}
              >
                <AvatarStack users={resolvedAssignees} size="xs" max={3} />
              </button>
            ) : resolvedAssignees.length === 1 ? (
              <button
                type="button"
                onClick={() => setAssigneeOpen(true)}
                disabled={isReadOnly}
                className="relative size-6 rounded-full border border-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all before:absolute before:-inset-1 md:before:hidden"
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
                className="relative size-6 rounded-full border border-border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer hover:ring-1 hover:ring-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none transition-all before:absolute before:-inset-1 md:before:hidden"
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
                className="relative size-6 rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none before:absolute before:-inset-1 md:before:hidden"
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

        {/* 4. Start Date Pill */}
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
                  ? 'h-6 px-2.5 text-11 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground'
                  : 'size-6 p-0 rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center shrink-0 [&>span]:hidden',
              )}
            />
          </div>
        )}

        {/* 5. Due Date Pill (Overdue / Today / Future Semantic States) */}
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
                      'h-6 px-2.5 text-11 font-normal rounded-md border transition-colors shadow-none',
                      isOverdue
                        ? 'border-border bg-muted/60 text-foreground hover:bg-muted font-medium'
                        : isDueToday
                          ? 'border-border bg-muted/40 text-foreground hover:bg-muted font-medium'
                          : 'border-border bg-background hover:bg-muted text-foreground',
                    )
                  : 'size-6 p-0 rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center shrink-0 [&>span]:hidden',
              )}
            />
          </div>
        )}

        {/* 6. Labels Pill (Visible on medium+ viewports) */}
        {showLabels && (
          <div className="hidden md:flex items-center gap-1 shrink-0">
            {labelsList.slice(0, 2).map((l: string | { id?: string; name?: string; color?: string; title?: string }, i: number) => {
              const labelName = typeof l === 'string' ? l : l.name || l.title || 'label';
              const labelColor = typeof l === 'object' && l.color ? l.color : '#8250DF';
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setLabelOpen(true)}
                  aria-label={`Edit label: ${labelName}`}
                  className="h-6 px-2.5 text-11 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
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
              labels={Array.isArray(item.labels) ? item.labels.map((l) => (typeof l === 'string' ? l : l.id || '')).filter(Boolean) : []}
              setLabels={(updater) => {
                const currentIds = Array.isArray(item.labels)
                  ? item.labels.map((l) => (typeof l === 'string' ? l : l.id || '')).filter(Boolean)
                  : [];
                const nextIds = typeof updater === 'function' ? updater(currentIds) : updater;
                onUpdateItem?.(item.id, { labels: nextIds });
              }}
              actionBtnClass="size-6 p-0 rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center justify-center shrink-0 [&>span]:hidden shadow-none"
            />
          </div>
        )}

        {/* 7. Attachments Pill (Hidden on smaller screens to prevent title squashing) */}
        {showAttach && attachLabel && (
          <button
            type="button"
            onClick={() => onEditCard(item)}
            className="h-6 px-2.5 text-11 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground hidden xl:flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title="Attachments"
          >
            <Paperclip className="size-3 shrink-0" />
            <span className="truncate max-w-[100px]">{attachLabel}</span>
          </button>
        )}

        {/* 8. Links Pill */}
        {showLinks && linksCount > 0 && (
          <button
            type="button"
            onClick={() => onEditCard(item)}
            className="h-6 px-2 text-11 font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground hidden xl:flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            title={`${linksCount} links`}
          >
            <Link2 className="size-3 shrink-0" />
            <span className="tabular-nums font-mono">{linksCount}</span>
          </button>
        )}

        {/* 9. More Actions Dropdown (Touch & Hover Friendly) */}
        {!isReadOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative size-6 text-foreground hover:bg-muted rounded-md cursor-pointer transition-colors shrink-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring flex items-center justify-center before:absolute before:-inset-2 md:before:hidden"
                aria-label="More options"
              >
                <MoreHorizontal className="size-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 p-1 text-xs z-100 rounded-md shadow-overlay">
              <DropdownMenuItem
                onClick={() => onDuplicateCard(item)}
                className="cursor-pointer gap-2 py-1.5 rounded-md"
              >
                <Copy className="size-3.5 text-foreground shrink-0" />
                <span>Duplicate</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => onToggleExpandChildren?.(item.id)}
                className="cursor-pointer gap-2 py-1.5 rounded-md"
              >
                <CornerDownRight className="size-3.5 text-foreground shrink-0" />
                <span>Add sub-item</span>
              </DropdownMenuItem>

              {currentUserId && (
                <DropdownMenuItem
                  onClick={() => (isCurrentUserAssignee ? onLeaveCard(item) : onJoinCard(item))}
                  className="cursor-pointer gap-2 py-1.5 rounded-md"
                >
                  {isCurrentUserAssignee ? (
                    <>
                      <UserMinus className="size-3.5 text-foreground shrink-0" />
                      <span>Leave</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5 text-foreground shrink-0" />
                      <span>Join</span>
                    </>
                  )}
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => onDeleteCard(item)}
                className="cursor-pointer gap-2 py-1.5 rounded-md text-foreground focus:bg-muted"
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
});
