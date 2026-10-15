'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Layers,
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Paperclip,
  Link2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { StatusIcon } from '@/shared/components/icons';
import { useCopyItemText } from '@/features/projects/project-id/work-items/hooks/use-work-item';
import { ItemHelpers, resolveColumnId } from '@/features/projects/project-id/work-items/utils/work-item.utils';
import { MemberPopover, AvatarStack } from '@/features/projects/project-id/work-items/components/pickers/MemberPicker';
import { SingleDatePopover } from '@/features/projects/project-id/work-items/components/pickers/DatePicker';
import { PriorityPopover } from '@/features/projects/project-id/work-items/components/pickers/PriorityPicker';
import { LabelPopover } from '@/features/projects/project-id/work-items/components/pickers/LabelPicker';
import type {
  Item,
  Column,
  ProjectMember,
  Priority,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import {
  type TablePropertyKey,
  TABLE_PROPERTIES,
  DEFAULT_COLUMN_WIDTHS,
} from '@/features/projects/project-id/work-items/types/table-view.types';
import {
  formatTableDate,
  isDateOverdue,
} from '@/features/projects/project-id/work-items/utils/table.utils';

export interface TableRowItemProps {
  item: Item;
  columns: Column[];
  projectStates?: Column[];
  visibleProperties: Record<TablePropertyKey, boolean>;
  columnWidths?: Record<string, number>;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEditCard: (item: Item) => void;
  onDeleteCard?: (item: Item) => void;
  onDuplicateCard?: (item: Item) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  members?: ProjectMember[];
  projectId?: string;
  isReadOnly?: boolean;
  isSubItem?: boolean;
  hasChildren?: boolean;
  isChildrenExpanded?: boolean;
  onToggleExpandChildren?: (id: string) => void;
}

export const TableRowItem = React.memo(function TableRowItem({
  item,
  columns,
  projectStates,
  visibleProperties,
  columnWidths,
  isSelected,
  onToggleSelect,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onUpdateCard,
  members = [],
  projectId = '',
  isReadOnly = false,
  isSubItem = false,
  hasChildren = false,
  isChildrenExpanded = true,
  onToggleExpandChildren,
}: TableRowItemProps) {
  const copyItemText = useCopyItemText();
  const stateList = projectStates && projectStates.length > 0 ? projectStates : columns;

  // Title inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleValue(item.title);
  }, [item.title]);

  useEffect(() => {
    if (isEditingTitle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== item.title) {
      onUpdateCard?.({ id: item.id, title: trimmed });
    } else {
      setTitleValue(item.title);
    }
  };

  const handleKeyDownTitle = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTitleValue(item.title);
    }
  };

  // State & metadata resolution
  const itemMeta = useMemo(
    () => ItemHelpers.resolveItemMeta(item, columns, projectStates),
    [item, columns, projectStates]
  );
  const currentColumn = itemMeta.resolvedState;

  // Assignee resolution
  const resolvedAssignees = ItemHelpers.resolveAssignees(item, members);
  const resolvedAssignee = ItemHelpers.resolveAssignee(item);
  const assigneeId = ItemHelpers.resolveAssigneeId(item);
  const memberMatch = members.find((m) => m.userId === assigneeId || m.id === assigneeId);
  const assigneeName =
    resolvedAssignee?.name || memberMatch?.name || resolvedAssignees[0]?.name || null;
  const assigneeAvatar =
    resolvedAssignee?.avatar || memberMatch?.avatar || resolvedAssignees[0]?.avatar || undefined;

  // Popover state toggles
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  // Active properties list
  const activeProperties = useMemo(
    () => TABLE_PROPERTIES.filter((p) => visibleProperties[p.key]),
    [visibleProperties]
  );

  const titleWidth = columnWidths?.title || DEFAULT_COLUMN_WIDTHS.title;

  // Sub-items count
  const childCount =
    item.childWorkItemCount ?? item.childWorkItems?.length ?? 0;
  const { attachmentsCount, isCancelled } = itemMeta;

  const isOverdue = isDateOverdue(item.dueDate, item.completed);
  const formattedDue = formatTableDate(item.dueDate);
  const formattedStart = formatTableDate(item.startDate);
  const formattedCreated = formatTableDate(item.createdAt);
  const formattedUpdated = formatTableDate(item.updatedAt);

  // Copy identifier helper
  const handleCopyIdentifier = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.identifier) {
      copyItemText(item.identifier, 'Item ID copied to clipboard');
    }
  };

  // Copy item link helper
  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/projects/${projectId}/work-items?itemId=${item.identifier || item.id}`
        : '';
    if (url) {
      copyItemText(url, 'Link copied to clipboard');
    }
  };

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.stopPropagation();
          onToggleSelect(item.id);
        } else {
          onEditCard(item);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditingTitle) {
          e.preventDefault();
          onEditCard(item);
        }
      }}
      aria-label={`Work item: ${item.title}`}
      className={cn(
        'group/row flex items-center h-9 border-b border-border hover:bg-muted/40 transition-colors duration-0 cursor-pointer text-13 select-none w-full relative outline-none focus-visible:ring-1 focus-visible:ring-ring',
        isSelected && 'bg-muted ring-1 ring-inset ring-border font-medium'
      )}
    >
      {/* 1. Identifier + Title Column (Frozen / Sticky Left) */}
      <div
        role="cell"
        style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px`, left: 0 }}
        className={cn(
          'sticky left-0 z-10 flex items-center px-2.5 h-full shrink-0 border-r border-border transition-colors bg-background group-hover/row:bg-muted/40',
          isSelected && 'bg-muted group-hover/row:bg-muted',
          isSubItem && 'pl-5'
        )}
        onClick={(e) => {
          // If double click title cell, allow inline edit
          if (e.detail === 2 && !isReadOnly) {
            e.stopPropagation();
            setIsEditingTitle(true);
          }
        }}
      >
        {/* Subitem connector indicator */}
        {isSubItem && (
          <CornerDownRight className="size-3 text-muted-foreground/60 shrink-0 mr-1.5" />
        )}

        {/* Parent item expand/collapse children toggle */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpandChildren?.(item.id);
            }}
            className="p-0.5 -ml-1 mr-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm"
            aria-label={isChildrenExpanded ? 'Collapse sub-items' : 'Expand sub-items'}
          >
            {isChildrenExpanded ? (
              <ChevronDown className="size-3 shrink-0" />
            ) : (
              <ChevronRight className="size-3 shrink-0" />
            )}
          </button>
        )}

        {/* Identifier Badge */}
        {item.identifier && (
          <button
            type="button"
            onClick={handleCopyIdentifier}
            className="text-11 font-mono text-muted-foreground hover:text-foreground font-medium px-1 py-0.5 rounded-sm mr-2 shrink-0 transition-colors tabular-nums cursor-pointer min-w-[58px] text-left relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
          >
            {item.identifier}
          </button>
        )}

        {/* Sub-item Count Badge (only shown when not expanded into inline tree rows) */}
        {!hasChildren && childCount > 0 && (
          <div
            className="flex items-center gap-1 text-11 font-mono text-foreground mr-1.5 shrink-0 tabular-nums"
            title={`${childCount} sub-items`}
          >
            <Layers className="size-3 text-foreground" />
            <span>{childCount}</span>
          </div>
        )}

        {/* Title Content */}
        {isEditingTitle ? (
          <div className="flex-1 mr-2" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleKeyDownTitle}
              aria-label="Edit title"
              className="w-full bg-background border border-ring px-1.5 py-0.5 rounded-md text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
            <span
              className={cn(
                'truncate font-normal text-xs',
                isCancelled ? 'line-through text-muted-foreground' : item.completed ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {item.title}
            </span>
            {!isReadOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                className="opacity-0 group-hover/row:opacity-100 p-0.5 text-foreground hover:text-foreground transition-opacity shrink-0 cursor-pointer relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                title="Edit title"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Dynamic Property Cells ────────────────────────────────────────── */}
      <div className="flex items-center h-full">
        {activeProperties.map((p) => {
          const propWidth = columnWidths?.[p.key] || DEFAULT_COLUMN_WIDTHS[p.key] || p.minWidth || 144;

          return (
            <div
              key={p.key}
              role="cell"
              style={{ width: `${propWidth}px`, minWidth: `${propWidth}px` }}
              className="flex items-center h-full px-2 overflow-hidden shrink-0 border-r border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* STATE CELL */}
              {p.key === 'state' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isReadOnly}>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-muted/80 text-foreground transition-colors w-full text-left truncate cursor-pointer focus-visible:ring-1 focus-visible:ring-ring outline-none"
                    >
                      <StatusIcon
                        id={item.columnId}
                        title={currentColumn?.title || currentColumn?.name || 'Backlog'}
                        group={currentColumn?.group || currentColumn?.slug || 'backlog'}
                        color={currentColumn?.color || currentColumn?.accentColor || '#6B7280'}
                        className="size-3.5 shrink-0"
                      />
                      <span className="truncate">
                        {currentColumn?.title || currentColumn?.name || 'Backlog'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44 p-1 text-xs z-100 rounded-md shadow-overlay">
                    {stateList.map((col) => {
                      const cId = resolveColumnId(col);
                      const isCurrent = cId === item.columnId;
                      const cTitle = col.title || col.name || 'Column';
                      const cColor = col.color || col.accentColor || '#6B7280';
                      const cGroup = col.group || col.slug || cTitle;

                      return (
                        <DropdownMenuItem
                          key={cId}
                          onClick={() => onUpdateCard?.({ id: item.id, columnId: cId })}
                          className={cn(
                            'flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-md',
                            isCurrent && 'bg-muted font-medium'
                          )}
                        >
                          <StatusIcon
                            id={cId}
                            title={cTitle}
                            group={cGroup}
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

              {/* PRIORITY CELL */}
              {p.key === 'priority' && (
                <div className="w-full">
                  <PriorityPopover
                    open={priorityOpen}
                    onOpenChange={setPriorityOpen}
                    priority={(item.priority || 'none') as Priority}
                    setPriority={(newPriority) =>
                      onUpdateCard?.({ id: item.id, priority: newPriority })
                    }
                    isReadOnly={isReadOnly}
                    actionBtnClass="w-full justify-start h-7 px-2 border-0 bg-transparent hover:bg-muted/80 shadow-none font-normal text-xs text-foreground cursor-pointer focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {/* ASSIGNEES CELL */}
              {p.key === 'assignees' && (
                <div className="relative w-full">
                  {resolvedAssignees.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => !isReadOnly && setAssigneeOpen(true)}
                      disabled={isReadOnly}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-muted/80 transition-colors w-full text-left truncate cursor-pointer focus-visible:ring-1 focus-visible:ring-ring outline-none"
                    >
                      <AvatarStack users={resolvedAssignees} size="xs" max={3} />
                      <span className="text-11 font-mono text-foreground">
                        +{resolvedAssignees.length}
                      </span>
                    </button>
                  ) : assigneeName ? (
                    <button
                      type="button"
                      onClick={() => !isReadOnly && setAssigneeOpen(true)}
                      disabled={isReadOnly}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-muted/80 transition-colors w-full text-left truncate cursor-pointer focus-visible:ring-1 focus-visible:ring-ring outline-none"
                    >
                      <Avatar className="size-4 shrink-0">
                        <AvatarImage src={assigneeAvatar} />
                        <AvatarFallback className="text-9 font-medium bg-muted">
                          {assigneeName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-foreground truncate">{assigneeName}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => !isReadOnly && setAssigneeOpen(true)}
                      disabled={isReadOnly}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-foreground hover:text-foreground hover:bg-muted/80 transition-colors w-full text-left cursor-pointer group/assign focus-visible:ring-1 focus-visible:ring-ring outline-none"
                    >
                      <div className="size-4 rounded-md border border-border flex items-center justify-center group-hover/assign:border-foreground/60">
                        <Plus className="size-2.5 text-foreground" />
                      </div>
                      <span className="text-11 transition-opacity">
                        Assign
                      </span>
                    </button>
                  )}

                  <MemberPopover
                    open={assigneeOpen}
                    onOpenChange={setAssigneeOpen}
                    assigneeId={assigneeId ?? null}
                    setAssigneeId={(id) => onUpdateCard?.({ id: item.id, assigneeId: id })}
                    assigneeIds={
                      Array.isArray(item.assigneeIds)
                        ? item.assigneeIds
                        : assigneeId
                        ? [assigneeId]
                        : []
                    }
                    setAssigneeIds={(ids) =>
                      onUpdateCard?.({
                        id: item.id,
                        assigneeIds: ids,
                        assigneeId: ids[0] ?? null,
                      })
                    }
                    isMulti={true}
                    members={members}
                    actionBtnClass="hidden"
                    isReadOnly={isReadOnly}
                  />
                </div>
              )}

              {/* DUE DATE CELL */}
              {p.key === 'dueDate' && (
                <div className="relative w-full">
                  <SingleDatePopover
                    open={dueDateOpen}
                    onOpenChange={setDueDateOpen}
                    date={item.dueDate || ''}
                    onSelectDate={(dateStr) =>
                      onUpdateCard?.({ id: item.id, dueDate: dateStr || null })
                    }
                    label={formattedDue || 'Due date'}
                    isReadOnly={isReadOnly}
                    actionBtnClass={cn(
                      'h-7 px-2 text-11 font-mono tabular-nums border-0 shadow-none justify-start w-full cursor-pointer text-foreground hover:bg-muted/80',
                      formattedDue
                        ? isOverdue
                          ? 'bg-muted/60 font-medium'
                          : 'bg-transparent'
                        : 'bg-transparent'
                    )}
                  />
                </div>
              )}

              {/* LABELS CELL */}
              {p.key === 'labels' && (
                <div className="relative w-full">
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setLabelOpen(true)}
                    disabled={isReadOnly}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs hover:bg-muted/80 transition-colors w-full text-left truncate cursor-pointer focus-visible:ring-1 focus-visible:ring-ring outline-none"
                  >
                    {Array.isArray(item.labels) && item.labels.length > 0 ? (
                      <div className="flex items-center gap-1 overflow-hidden">
                        {item.labels.slice(0, 2).map((labelItem: string | { id?: string; name?: string; color?: string; title?: string }, idx: number) => {
                          const labelText =
                            typeof labelItem === 'string'
                              ? labelItem
                              : labelItem?.name || labelItem?.title || labelItem?.id || '';
                          const labelColor =
                            typeof labelItem === 'object' ? labelItem?.color : undefined;

                          return (
                            <span
                              key={(typeof labelItem === 'object' ? labelItem?.id : labelItem) || idx}
                              style={labelColor ? { borderColor: `${labelColor}40` } : undefined}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-11 font-normal bg-muted/60 text-foreground border border-border truncate max-w-[80px]"
                            >
                              {labelColor && (
                                <span
                                  className="size-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: labelColor }}
                                />
                              )}
                              <span className="truncate">{labelText}</span>
                            </span>
                          );
                        })}
                        {item.labels.length > 2 && (
                          <span className="text-11 font-mono text-foreground tabular-nums">
                            +{item.labels.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-foreground">-</span>
                    )}
                  </button>

                  <LabelPopover
                    open={labelOpen}
                    onOpenChange={setLabelOpen}
                    labels={
                      Array.isArray(item.labels)
                        ? item.labels.map((l) => (typeof l === 'string' ? l : l.id || '')).filter(Boolean)
                        : []
                    }
                    setLabels={(newLabelsAction: string[] | ((prev: string[]) => string[])) => {
                      const current = Array.isArray(item.labels)
                        ? item.labels.map((l) => (typeof l === 'string' ? l : l.id || '')).filter(Boolean)
                        : [];
                      const updated =
                        typeof newLabelsAction === 'function'
                          ? newLabelsAction(current)
                          : newLabelsAction;
                      onUpdateCard?.({ id: item.id, labels: updated });
                    }}
                    actionBtnClass="hidden"
                    isReadOnly={isReadOnly}
                  />
                </div>
              )}

              {/* START DATE CELL */}
              {p.key === 'startDate' && (
                <div className="relative w-full">
                  <SingleDatePopover
                    open={startDateOpen}
                    onOpenChange={setStartDateOpen}
                    date={item.startDate || ''}
                    onSelectDate={(dateStr) =>
                      onUpdateCard?.({ id: item.id, startDate: dateStr || null })
                    }
                    label={formattedStart || 'Start date'}
                    isReadOnly={isReadOnly}
                    actionBtnClass="h-7 px-2 text-11 font-mono tabular-nums border-0 shadow-none justify-start w-full bg-transparent hover:bg-muted/80 text-foreground cursor-pointer"
                  />
                </div>
              )}

              {/* CREATED ON CELL */}
              {p.key === 'createdOn' && (
                <span className="text-11 font-mono text-foreground px-2 truncate tabular-nums">
                  {formattedCreated || '-'}
                </span>
              )}

              {/* CREATED BY CELL */}
              {p.key === 'createdBy' && (
                <span className="text-xs text-foreground px-2 truncate">
                  {item.author?.name || (item as { created_by_name?: string }).created_by_name || '-'}
                </span>
              )}

              {/* UPDATED ON CELL */}
              {p.key === 'updatedOn' && (
                <span className="text-11 font-mono text-foreground px-2 truncate tabular-nums">
                  {formattedUpdated || '-'}
                </span>
              )}

              {/* ATTACHMENT CELL */}
              {p.key === 'attachment' && (
                <button
                  type="button"
                  onClick={() => onEditCard(item)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-11 font-mono tabular-nums text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Paperclip className="size-3.5 shrink-0" />
                  <span>{attachmentsCount > 0 ? attachmentsCount : '-'}</span>
                </button>
              )}

              {/* SUB ITEM COUNT CELL */}
              {p.key === 'subItemCount' && (
                <button
                  type="button"
                  onClick={() => onEditCard(item)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-11 font-mono tabular-nums text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Layers className="size-3.5 shrink-0" />
                  <span>{childCount > 0 ? `${childCount} sub-items` : '-'}</span>
                </button>
              )}

              {/* LINK CELL */}
              {p.key === 'link' && (
                <span className="text-11 font-mono text-foreground px-2 truncate tabular-nums">-</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 3. Actions Column Cell ────────────────────────────────────────── */}
      <div
        role="cell"
        style={{ width: '48px', minWidth: '48px' }}
        className="flex items-center justify-center h-full shrink-0 border-r border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 cursor-pointer focus-visible:ring-1 focus-visible:ring-ring outline-none"
              title="More actions"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 p-1 text-xs z-100 rounded-md shadow-overlay">
            <DropdownMenuItem
              onClick={() => onEditCard(item)}
              className="flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-md"
            >
              <Pencil className="size-3.5 text-muted-foreground" />
              <span>Edit work item</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleCopyLink}
              className="flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-md"
            >
              <Link2 className="size-3.5 text-muted-foreground" />
              <span>Copy link</span>
            </DropdownMenuItem>
            {!isReadOnly && (
              <>
                <DropdownMenuItem
                  onClick={() => onDuplicateCard?.(item)}
                  className="flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-md"
                >
                  <Copy className="size-3.5 text-muted-foreground" />
                  <span>Duplicate</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={() => onDeleteCard?.(item)}
                  className="flex items-center gap-2 cursor-pointer py-1.5 text-xs rounded-md text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex-1 h-full min-w-0" />
    </div>
  );
});
