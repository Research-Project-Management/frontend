'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Users,
  Tag,
  Paperclip,
  CalendarClock,
  Calendar,
  User,
  Link2,
  Layers,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  FileText,
  SlidersHorizontal,
  Search,
  RotateCcw,
  MoreHorizontal,
  Pencil,
  Copy,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  CheckSquare,
} from 'lucide-react';
import {
  Button,
  Input,
  Checkbox,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Popover,
  PopoverContent,
  PopoverTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useCopyItemText } from '../../hooks/use-work-item';
import {
  StatusIcon,
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
  CycleIcon,
} from '@/shared/components/icons';
import { ItemHelpers, resolveColumnId } from '../../utils/work-item.utils';
import {
  MemberPopover,
  SingleDatePopover,
  PriorityPopover,
  CyclePopover,
  LabelPopover,
  AvatarStack,
} from '../modals/Popovers';
import type {
  Item,
  Column as ColumnType,
  Cycle,
  ProjectMember,
  Priority,
  DisplayOptions,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
} from '../../types/work-item.types';

// ── 1. Table Types ───────────────────────────────────────────────────────────

export type TablePropertyKey =
  | 'state'
  | 'priority'
  | 'assignees'
  | 'dueDate'
  | 'labels'
  | 'cycle'
  | 'startDate'
  | 'createdOn'
  | 'createdBy'
  | 'updatedOn'
  | 'attachment'
  | 'subItemCount'
  | 'link';

export type TableSortField =
  | 'identifier'
  | 'title'
  | 'state'
  | 'priority'
  | 'dueDate'
  | 'startDate'
  | 'createdOn'
  | 'updatedOn';

export type TableSortOrder = 'asc' | 'desc';

export interface TablePropertyConfig {
  key: TablePropertyKey;
  label: string;
  icon: React.ElementType;
  defaultVisible: boolean;
  minWidth: number;
}

export interface TableViewProps extends BaseWorkItemViewProps, WorkItemCardHandlers {
  items?: Item[];
  itemsByColumnId?: Map<string, Item[]> | Record<string, Item[]>;
  columns: ColumnType[];
  projectStates?: ColumnType[];
  projectId?: string;
  workspaceId?: string;
  cycles?: Cycle[];
  members?: ProjectMember[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: ((ids?: string[]) => void) | (() => void);
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  onToggleDisplayProperty?: (key: any, value: boolean) => void;
}

// ── 2. Table Constants ───────────────────────────────────────────────────────

export const TABLE_STORAGE_KEY = 'flux:table_view:columns_v5';
export const TABLE_WIDTHS_STORAGE_KEY = 'flux:table_view:column_widths_v4';

export const TABLE_PROPERTIES: TablePropertyConfig[] = [
  { key: 'state', label: 'State', icon: StatusIcon, defaultVisible: true, minWidth: 130 },
  { key: 'priority', label: 'Priority', icon: MediumPriorityBoxIcon, defaultVisible: true, minWidth: 110 },
  { key: 'assignees', label: 'Assignees', icon: Users, defaultVisible: true, minWidth: 140 },
  { key: 'dueDate', label: 'Due date', icon: Calendar, defaultVisible: true, minWidth: 125 },
  { key: 'labels', label: 'Labels', icon: Tag, defaultVisible: true, minWidth: 140 },
  { key: 'cycle', label: 'Cycle', icon: CycleIcon, defaultVisible: false, minWidth: 130 },
  { key: 'startDate', label: 'Start date', icon: CalendarClock, defaultVisible: false, minWidth: 125 },
  { key: 'createdOn', label: 'Created on', icon: Calendar, defaultVisible: false, minWidth: 125 },
  { key: 'createdBy', label: 'Created by', icon: User, defaultVisible: false, minWidth: 130 },
  { key: 'updatedOn', label: 'Updated on', icon: Calendar, defaultVisible: false, minWidth: 125 },
  { key: 'attachment', label: 'Attachments', icon: Paperclip, defaultVisible: false, minWidth: 120 },
  { key: 'subItemCount', label: 'Sub-items', icon: Layers, defaultVisible: false, minWidth: 120 },
  { key: 'link', label: 'Links', icon: Link2, defaultVisible: false, minWidth: 100 },
];

export const DEFAULT_VISIBLE_PROPERTIES: Record<TablePropertyKey, boolean> = {
  state: true,
  priority: true,
  assignees: true,
  dueDate: true,
  labels: true,
  cycle: false,
  startDate: false,
  createdOn: false,
  createdBy: false,
  updatedOn: false,
  attachment: false,
  subItemCount: false,
  link: false,
};

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  title: 360,
  state: 130,
  priority: 110,
  assignees: 140,
  dueDate: 125,
  labels: 140,
  cycle: 130,
  startDate: 125,
  createdOn: 125,
  createdBy: 130,
  updatedOn: 125,
  attachment: 120,
  subItemCount: 120,
  link: 100,
};

// ── 3. Helper: Priority Icon ─────────────────────────────────────────────────

export function renderPriorityIcon(priority?: Priority, className?: string) {
  const p = priority || 'none';
  switch (p) {
    case 'urgent':
      return <UrgentPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'high':
      return <HighPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'medium':
      return <MediumPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'low':
      return <LowPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'none':
    default:
      return <NonePriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
  }
}

// ── 4. Helper: Date Formatter ────────────────────────────────────────────────

function formatTableDate(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function isDateOverdue(dateStr?: string | null, completed?: boolean) {
  if (!dateStr || completed) return false;
  try {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch {
    return false;
  }
}

// ── 5. Table Column Properties Popover ───────────────────────────────────────

export function TableColumnPropertiesPopover({
  visibleProperties,
  onToggleProperty,
  onResetProperties,
}: {
  visibleProperties: Record<TablePropertyKey, boolean>;
  onToggleProperty: (key: TablePropertyKey) => void;
  onResetProperties: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProperties = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return TABLE_PROPERTIES;
    return TABLE_PROPERTIES.filter((p) => p.label.toLowerCase().includes(q));
  }, [searchQuery]);

  const activeCount = useMemo(
    () => Object.values(visibleProperties).filter(Boolean).length,
    [visibleProperties]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted border border-border/60 bg-background transition-colors cursor-pointer select-none"
        >
          <SlidersHorizontal className="size-3.5 shrink-0" />
          <span>Display</span>
          <span className="rounded-md bg-muted px-1.5 py-0.2 text-10 font-mono font-medium text-foreground tabular-nums">
            {activeCount}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 border-border bg-popover shadow-2xs z-100 rounded-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border px-1">
          <span className="text-xs font-semibold text-foreground">Display properties</span>
        </div>

        <div className="relative mb-2 px-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search properties..."
            className="h-7 pl-7 text-xs bg-background border-border shadow-2xs placeholder:text-foreground/70 text-foreground rounded-md"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5 px-1 py-0.5">
          {filteredProperties.map((p) => {
            const Icon = p.icon;
            const isChecked = Boolean(visibleProperties[p.key]);

            return (
              <label
                key={p.key}
                className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer hover:bg-muted transition-colors text-foreground select-none"
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5 text-foreground shrink-0" />
                  <span>{p.label}</span>
                </div>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleProperty(p.key)}
                  className="size-3.5 rounded-sm"
                />
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 6. Table Header Row ──────────────────────────────────────────────────────

export function TableHeaderRow({
  visibleProperties,
  columnWidths,
  onResizeColumn,
  onToggleProperty,
  onResetProperties,
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
  sortField,
  sortOrder,
  onSort,
  totalItemsCount = 0,
}: {
  visibleProperties: Record<TablePropertyKey, boolean>;
  columnWidths: Record<string, number>;
  onResizeColumn: (key: string, width: number) => void;
  onToggleProperty: (key: TablePropertyKey) => void;
  onResetProperties: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  sortField?: TableSortField;
  sortOrder?: TableSortOrder;
  onSort?: (field: TableSortField) => void;
  totalItemsCount?: number;
}) {
  const activeProperties = useMemo(
    () => TABLE_PROPERTIES.filter((p) => visibleProperties[p.key]),
    [visibleProperties]
  );

  const renderSortIndicator = (field: TableSortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="size-3 text-foreground ml-1 shrink-0" />
    ) : (
      <ArrowDown className="size-3 text-foreground ml-1 shrink-0" />
    );
  };

  const handleResizeMouseDown = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const currentW = columnWidths[colKey] || (colKey === 'title' ? 360 : 130);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const minW = colKey === 'title' ? 200 : 70;
      onResizeColumn(colKey, Math.max(minW, currentW + deltaX));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const titleWidth = columnWidths.title || 360;

  return (
    <div
      role="row"
      className="sticky top-0 z-20 flex items-center h-10 border-b border-border bg-background/95 backdrop-blur-xs text-xs font-medium text-muted-foreground select-none w-full"
    >
      {/* 1. First Column: Checkbox + Work items Title */}
      <div
        role="columnheader"
        style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px` }}
        className="relative flex items-center px-3 h-full border-r border-border/40 shrink-0 group/header"
      >
        <div className="flex items-center gap-2.5 w-full">
          <Checkbox
            checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all work items"
            className="size-3.5 border-border data-[state=checked]:border-primary"
          />
          <span
            onClick={() => onSort?.('title')}
            className="flex items-center gap-1.5 text-xs font-semibold text-foreground cursor-pointer hover:text-foreground transition-colors truncate"
          >
            <span>Work items</span>
            {totalItemsCount > 0 && (
              <span className="text-11 font-mono text-muted-foreground font-normal">
                {totalItemsCount}
              </span>
            )}
            {renderSortIndicator('title')}
          </span>
        </div>

        {/* Resize Handle */}
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 group-hover/header:bg-border/60 transition-colors z-20"
          onMouseDown={(e) => handleResizeMouseDown('title', e)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* 2. Dynamic Property Headers */}
      <div className="flex items-center h-full">
        {activeProperties.map((p) => {
          const Icon = p.icon;
          const isSortable = [
            'state',
            'priority',
            'dueDate',
            'startDate',
            'createdOn',
            'updatedOn',
          ].includes(p.key);
          const propWidth = columnWidths[p.key] || p.minWidth || 130;

          return (
            <div
              key={p.key}
              role="columnheader"
              tabIndex={isSortable ? 0 : undefined}
              aria-sort={
                sortField === p.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined
              }
              aria-label={isSortable ? `Sort by ${p.label}` : p.label}
              onKeyDown={(e) => {
                if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSort?.(p.key as TableSortField);
                }
              }}
              style={{ width: `${propWidth}px`, minWidth: `${propWidth}px` }}
              onClick={() => isSortable && onSort?.(p.key as TableSortField)}
              className={cn(
                'relative flex items-center gap-1.5 px-3 h-full text-xs font-medium text-foreground select-none transition-colors outline-none border-r border-border/40 shrink-0 group/col',
                isSortable && 'cursor-pointer hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className="size-3.5 shrink-0 text-foreground" />
              <span className="truncate">{p.label}</span>
              {isSortable && renderSortIndicator(p.key as TableSortField)}

              {/* Resize Handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 group-hover/col:bg-border/60 transition-colors z-20"
                onMouseDown={(e) => handleResizeMouseDown(p.key, e)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        })}
      </div>

      {/* 3. Right: Display Popover */}
      <div className="ml-auto pr-3 flex items-center shrink-0">
        <TableColumnPropertiesPopover
          visibleProperties={visibleProperties}
          onToggleProperty={onToggleProperty}
          onResetProperties={onResetProperties}
        />
      </div>
    </div>
  );
}

// ── 7. Table Group Header ────────────────────────────────────────────────────

export function TableGroupHeader({
  title,
  color,
  icon,
  count,
  isExpanded,
  onToggle,
  onQuickAdd,
  isReadOnly,
}: {
  title: string;
  color?: string;
  icon?: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  onQuickAdd?: () => void;
  isReadOnly?: boolean;
}) {
  return (
    <div
      role="row"
      onClick={onToggle}
      className="flex items-center justify-between h-9 px-3 border-b border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer select-none group/groupHeader"
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="size-4 flex items-center justify-center text-foreground hover:text-foreground transition-colors"
          aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
        >
          {isExpanded ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
        </button>

        {icon ? (
          icon
        ) : (
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: color || '#8A9093' }}
          />
        )}

        <span className="text-xs font-semibold text-foreground truncate">{title}</span>

        <span className="rounded-md bg-muted px-1.5 py-0.2 text-10 font-mono font-medium text-foreground tabular-nums">
          {count}
        </span>
      </div>

      {!isReadOnly && onQuickAdd && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd();
          }}
          className="opacity-0 group-hover/groupHeader:opacity-100 p-1 rounded-md text-foreground hover:text-foreground hover:bg-muted transition-all"
          title={`Add item to ${title}`}
        >
          <Plus className="size-3.5 shrink-0" />
        </button>
      )}
    </div>
  );
}

// ── 8. Table Row Item ────────────────────────────────────────────────────────

export function TableRowItem({
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
  cycles = [],
  projectId = '',
  workspaceId = '',
  isReadOnly = false,
}: {
  item: Item;
  columns: ColumnType[];
  projectStates?: ColumnType[];
  visibleProperties: Record<TablePropertyKey, boolean>;
  columnWidths: Record<string, number>;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEditCard: (item: Item) => void;
  onDeleteCard: (item: Item) => void;
  onDuplicateCard: (item: Item) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  members?: ProjectMember[];
  cycles?: Cycle[];
  projectId?: string;
  workspaceId?: string;
  isReadOnly?: boolean;
}) {
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

  // State resolution
  const currentColumn = useMemo(() => {
    if (item.state && typeof item.state === 'object') {
      return {
        id: item.state.id,
        title: item.state.name,
        name: item.state.name,
        group: item.state.group,
        color: item.state.color,
        accentColor: item.state.color,
        slug: item.state.name,
      };
    }
    return stateList.find((c) => resolveColumnId(c) === item.columnId);
  }, [item.state, item.columnId, stateList]);

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
  const [cycleOpen, setCycleOpen] = useState(false);

  // Active properties list
  const activeProperties = useMemo(
    () => TABLE_PROPERTIES.filter((p) => visibleProperties[p.key]),
    [visibleProperties]
  );

  const titleWidth = columnWidths.title || 360;

  // Sub-items count
  const childCount =
    (item as any).childWorkItemCount ?? (item as any).childWorkItems?.length ?? 0;
  const attachmentsCount = ItemHelpers.countAttachments(item.attachments);

  const isOverdue = isDateOverdue(item.dueDate, item.completed);
  const formattedDue = formatTableDate(item.dueDate);
  const formattedStart = formatTableDate(item.startDate);
  const formattedCreated = formatTableDate((item as any).createdAt);
  const formattedUpdated = formatTableDate((item as any).updatedAt);

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
        ? `${window.location.origin}/projects/${projectId}/work-items?itemId=${item.id}`
        : '';
    if (url) {
      copyItemText(url, 'Link copied to clipboard');
    }
  };

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => onEditCard(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditingTitle) {
          e.preventDefault();
          onEditCard(item);
        }
      }}
      aria-label={`Work item: ${item.title}`}
      className={cn(
        'group/row flex items-center h-10 border-b border-border/40 hover:bg-muted/40 transition-colors cursor-pointer text-xs select-none w-full relative outline-none focus-visible:ring-1 focus-visible:ring-primary',
        isSelected && 'bg-primary/5 font-medium'
      )}
    >
      {/* ── 1. Checkbox + Identifier + Title Column ────────────────────────── */}
      <div
        role="cell"
        style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px` }}
        className="relative flex items-center px-3 h-full shrink-0 border-r border-border/30"
        onClick={(e) => {
          // If double click title cell, allow inline edit
          if (e.detail === 2 && !isReadOnly) {
            e.stopPropagation();
            setIsEditingTitle(true);
          }
        }}
      >
        {/* Checkbox */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center shrink-0 mr-2.5"
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(item.id)}
            aria-label={isSelected ? `Deselect ${item.title}` : `Select ${item.title}`}
            className={cn(
              'size-3.5 border-border data-[state=checked]:border-primary transition-opacity',
              !isSelected && 'sm:opacity-0 sm:group-hover/row:opacity-100'
            )}
          />
        </div>

        {/* Identifier Badge */}
        {item.identifier && (
          <button
            type="button"
            onClick={handleCopyIdentifier}
            title="Click to copy identifier"
            className="text-11 font-mono text-foreground hover:bg-muted/80 px-1 py-0.5 rounded-md mr-2 shrink-0 transition-colors"
          >
            {item.identifier}
          </button>
        )}

        {/* Sub-item Indicator */}
        {childCount > 0 && (
          <div
            className="flex items-center gap-1 text-10 font-mono text-foreground mr-1.5 shrink-0"
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
              className="w-full bg-background border border-primary px-1.5 py-0.5 rounded-md text-xs text-foreground outline-none shadow-2xs"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
            <span
              className={cn(
                'truncate font-normal text-xs',
                item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
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
                className="opacity-0 group-hover/row:opacity-100 p-0.5 text-foreground hover:text-foreground transition-opacity shrink-0"
                title="Edit title"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Dynamic Property Cells ───────────────────────────────────────── */}
      <div className="flex items-center h-full">
        {activeProperties.map((p) => {
          const propWidth = columnWidths[p.key] || p.minWidth || 130;

          return (
            <div
              key={p.key}
              role="cell"
              style={{ width: `${propWidth}px`, minWidth: `${propWidth}px` }}
              className="flex items-center h-full px-2 overflow-hidden shrink-0 border-r border-border/30"
              onClick={(e) => e.stopPropagation()}
            >
              {/* STATE CELL */}
              {p.key === 'state' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild disabled={isReadOnly}>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-muted/80 text-foreground transition-colors w-full text-left truncate cursor-pointer"
                    >
                      <StatusIcon
                        id={item.columnId}
                        title={currentColumn?.title || currentColumn?.name || 'Backlog'}
                        group={currentColumn?.group || currentColumn?.slug || 'backlog'}
                        color={currentColumn?.color || currentColumn?.accentColor || '#8A9093'}
                        className="size-3.5 shrink-0"
                      />
                      <span className="truncate">
                        {currentColumn?.title || currentColumn?.name || 'Backlog'}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44 p-1 text-xs z-100 rounded-md">
                    {stateList.map((col) => {
                      const cId = resolveColumnId(col);
                      const isCurrent = cId === item.columnId;
                      const cTitle = col.title || col.name || 'Column';
                      const cColor = col.color || col.accentColor || '#8A9093';
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
                    actionBtnClass="w-full justify-start h-7 px-2 border-0 bg-transparent hover:bg-muted/80 shadow-none font-normal text-xs text-foreground cursor-pointer"
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
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-muted/80 transition-colors w-full text-left truncate cursor-pointer"
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
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-muted/80 transition-colors w-full text-left truncate cursor-pointer"
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
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-foreground hover:text-foreground hover:bg-muted/80 transition-colors w-full text-left cursor-pointer group/assign"
                    >
                      <div className="size-4 rounded-md border border-dashed border-border/80 flex items-center justify-center group-hover/assign:border-foreground/60">
                        <Plus className="size-2.5 text-foreground" />
                      </div>
                      <span className="text-11 opacity-0 group-hover/row:opacity-100 transition-opacity">
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
                      'h-7 px-2 text-xs font-normal border-0 shadow-none justify-start w-full cursor-pointer',
                      formattedDue
                        ? isOverdue
                          ? 'text-destructive bg-destructive/10 hover:bg-destructive/20 font-medium'
                          : 'bg-transparent hover:bg-muted/80 text-foreground'
                        : 'bg-transparent text-foreground hover:bg-muted/80'
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
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs hover:bg-muted/80 transition-colors w-full text-left truncate cursor-pointer"
                  >
                    {Array.isArray(item.labels) && item.labels.length > 0 ? (
                      <div className="flex items-center gap-1 overflow-hidden">
                        {item.labels.slice(0, 2).map((labelItem: any, idx: number) => {
                          const labelText =
                            typeof labelItem === 'string'
                              ? labelItem
                              : labelItem?.name || labelItem?.title || labelItem?.id || '';
                          const labelColor =
                            typeof labelItem === 'object' ? labelItem?.color : undefined;

                          return (
                            <span
                              key={labelItem?.id || idx}
                              style={labelColor ? { borderColor: `${labelColor}40` } : undefined}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-10 font-medium bg-muted/60 text-foreground border border-border truncate max-w-[80px]"
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
                          <span className="text-10 font-mono text-foreground">
                            +{item.labels.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-foreground hover:text-foreground">-</span>
                    )}
                  </button>

                  <LabelPopover
                    open={labelOpen}
                    onOpenChange={setLabelOpen}
                    labels={
                      Array.isArray(item.labels)
                        ? item.labels.map((l: any) => (typeof l === 'string' ? l : l.id))
                        : []
                    }
                    setLabels={(newLabelsAction: any) => {
                      const current = Array.isArray(item.labels)
                        ? item.labels.map((l: any) => (typeof l === 'string' ? l : l.id))
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

              {/* CYCLE CELL */}
              {p.key === 'cycle' && (
                <div className="relative w-full">
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setCycleOpen(true)}
                    disabled={isReadOnly}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-muted/80 transition-colors w-full text-left truncate cursor-pointer"
                  >
                    {item.cycleId ? (
                      <>
                        <CycleIcon className="size-3.5 text-foreground shrink-0" />
                        <span className="truncate">
                          {cycles.find((c) => c.id === item.cycleId)?.name || 'Cycle'}
                        </span>
                      </>
                    ) : (
                      <span className="text-foreground hover:text-foreground">-</span>
                    )}
                  </button>

                  <CyclePopover
                    open={cycleOpen}
                    onOpenChange={setCycleOpen}
                    cycleId={item.cycleId || null}
                    setCycleId={(cid) => onUpdateCard?.({ id: item.id, cycleId: cid || undefined })}
                    cycles={cycles}
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
                    actionBtnClass="h-7 px-2 text-xs font-normal border-0 shadow-none justify-start w-full bg-transparent hover:bg-muted/80 text-foreground cursor-pointer"
                  />
                </div>
              )}

              {/* CREATED ON CELL */}
              {p.key === 'createdOn' && (
                <span className="text-xs text-foreground px-2 truncate">
                  {formattedCreated || '-'}
                </span>
              )}

              {/* CREATED BY CELL */}
              {p.key === 'createdBy' && (
                <span className="text-xs text-foreground px-2 truncate">
                  {(item as any).author?.name || (item as any).created_by_name || '-'}
                </span>
              )}

              {/* UPDATED ON CELL */}
              {p.key === 'updatedOn' && (
                <span className="text-xs text-foreground px-2 truncate">
                  {formattedUpdated || '-'}
                </span>
              )}

              {/* ATTACHMENT CELL */}
              {p.key === 'attachment' && (
                <button
                  type="button"
                  onClick={() => onEditCard(item)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
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
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Layers className="size-3.5 shrink-0" />
                  <span>{childCount > 0 ? `${childCount} sub-items` : '-'}</span>
                </button>
              )}

              {/* LINK CELL */}
              {p.key === 'link' && (
                <span className="text-xs text-foreground px-2 truncate">-</span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 3. Row Actions (Hover Toolbar on Far Right) ─────────────────────── */}
      <div className="ml-auto pr-2 flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={handleCopyLink}
          className="p-1 rounded-md text-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Copy link"
        >
          <Link2 className="size-3.5" />
        </button>

        {!isReadOnly && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditCard(item);
              }}
              className="p-1 rounded-md text-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit work item"
            >
              <Pencil className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateCard(item);
              }}
              className="p-1 rounded-md text-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Duplicate"
            >
              <Copy className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCard(item);
              }}
              className="p-1 rounded-md text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── 9. Table Inline Quick Add Row ────────────────────────────────────────────

export function TableInlineAddRow({
  targetColumnId,
  groupTitle,
  onAddCard,
  isReadOnly = false,
}: {
  targetColumnId: string;
  groupTitle?: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  isReadOnly?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  if (isReadOnly) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddCard(targetColumnId, trimmed);
    setTitle('');
    // Keep focus so user can rapidly add multiple items in sequence
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsAdding(false);
      setTitle('');
    }
  };

  if (!isAdding) {
    return (
      <div className="border-b border-border/30">
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 h-9 px-3 w-full text-xs text-foreground hover:bg-muted/30 transition-colors cursor-pointer text-left group/add"
        >
          <Plus className="size-3.5 text-foreground transition-colors" />
          <span>{groupTitle ? `Add item to ${groupTitle}...` : 'New work item...'}</span>
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center h-10 px-3 border-b border-primary/50 bg-background transition-colors gap-2"
    >
      <Plus className="size-3.5 text-primary shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What needs to be done? (Enter to save, Esc to cancel)"
        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none px-1"
      />
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim()}
          className="h-7 px-3 text-xs font-medium rounded-md"
        >
          Add
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsAdding(false);
            setTitle('');
          }}
          className="h-7 w-7 p-0 text-foreground hover:text-foreground rounded-md"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </form>
  );
}

// ── 10. Main TableView Component ─────────────────────────────────────────────

export function TableView({
  items = [],
  itemsByColumnId,
  columns,
  projectStates,
  displayOptions,
  projectId = '',
  workspaceId = '',
  cycles = [],
  members = [],
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onUpdateCard,
  isReadOnly = false,
  selectedIds: propSelectedIds,
  onToggleSelect: rawOnToggleSelect,
  onSelectAll: rawOnSelectAll,
  onToggleDisplayProperty,
}: TableViewProps) {
  // ── A. Column Visibility ───────────────────────────────────────────────────
  const [localVisibleProperties, setLocalVisibleProperties] = useState<
    Record<TablePropertyKey, boolean>
  >(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(TABLE_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_VISIBLE_PROPERTIES, ...parsed };
          }
        }
      } catch {
        // Ignore localStorage error
      }
    }
    return DEFAULT_VISIBLE_PROPERTIES;
  });

  // Merge with displayOptions.properties (supports camelCase & snake_case from DB)
  const visibleProperties = useMemo<Record<TablePropertyKey, boolean>>(() => {
    if (!displayOptions?.properties) return localVisibleProperties;
    const p = displayOptions.properties as any;

    return {
      ...localVisibleProperties,
      ...(p.state !== undefined ? { state: Boolean(p.state) } : {}),
      ...(p.priority !== undefined ? { priority: Boolean(p.priority) } : {}),
      ...((p.assignees ?? p.assignee) !== undefined
        ? { assignees: Boolean(p.assignees ?? p.assignee) }
        : {}),
      ...((p.dueDate ?? p.due_date) !== undefined
        ? { dueDate: Boolean(p.dueDate ?? p.due_date) }
        : {}),
      ...(p.labels !== undefined ? { labels: Boolean(p.labels) } : {}),
      ...(p.cycle !== undefined ? { cycle: Boolean(p.cycle) } : {}),
      ...((p.startDate ?? p.start_date) !== undefined
        ? { startDate: Boolean(p.startDate ?? p.start_date) }
        : {}),
      ...((p.createdOn ?? p.created_on) !== undefined
        ? { createdOn: Boolean(p.createdOn ?? p.created_on) }
        : {}),
      ...((p.createdBy ?? p.created_by) !== undefined
        ? { createdBy: Boolean(p.createdBy ?? p.created_by) }
        : {}),
      ...((p.updatedOn ?? p.updated_on) !== undefined
        ? { updatedOn: Boolean(p.updatedOn ?? p.updated_on) }
        : {}),
      ...((p.attachment ?? p.attachment_count ?? p.attach) !== undefined
        ? { attachment: Boolean(p.attachment ?? p.attachment_count ?? p.attach) }
        : {}),
      ...((p.subItemCount ?? p.sub_issue_count ?? p.childWorkItemCount) !== undefined
        ? { subItemCount: Boolean(p.subItemCount ?? p.sub_issue_count ?? p.childWorkItemCount) }
        : {}),
      ...(p.link !== undefined ? { link: Boolean(p.link) } : {}),
    };
  }, [localVisibleProperties, displayOptions?.properties]);

  const handleToggleProperty = (key: TablePropertyKey) => {
    const nextVal = !visibleProperties[key];
    setLocalVisibleProperties((prev) => {
      const updated = { ...prev, [key]: nextVal };
      try {
        localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage error
      }
      return updated;
    });

    if (onToggleDisplayProperty) {
      const keyMap: Partial<Record<TablePropertyKey, string>> = {
        state: 'state',
        priority: 'priority',
        assignees: 'assignee',
        dueDate: 'due_date',
        labels: 'labels',
        cycle: 'cycle',
        startDate: 'start_date',
        createdOn: 'created_on',
        createdBy: 'created_by',
        updatedOn: 'updated_on',
        attachment: 'attachment_count',
        subItemCount: 'sub_issue_count',
        link: 'link',
      };
      const displayKey = keyMap[key];
      if (displayKey) {
        onToggleDisplayProperty(displayKey, nextVal);
      }
    }
  };

  const handleResetProperties = () => {
    setLocalVisibleProperties(DEFAULT_VISIBLE_PROPERTIES);
    try {
      localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(DEFAULT_VISIBLE_PROPERTIES));
    } catch {
      // Ignore localStorage error
    }
  };

  // ── B. Column Widths ───────────────────────────────────────────────────────
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(TABLE_WIDTHS_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
          }
        }
      } catch {
        // Ignore localStorage error
      }
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const handleResizeColumn = useCallback((key: string, newWidth: number) => {
    setColumnWidths((prev) => {
      const updated = { ...prev, [key]: newWidth };
      try {
        localStorage.setItem(TABLE_WIDTHS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage error
      }
      return updated;
    });
  }, []);

  // ── C. Multi-Select Handling ───────────────────────────────────────────────
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([]);
  const selectedIds = propSelectedIds ?? localSelectedIds;

  const handleToggleSelect = useCallback(
    (id: string) => {
      if (rawOnToggleSelect) {
        rawOnToggleSelect(id);
      } else {
        setLocalSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
      }
    },
    [rawOnToggleSelect]
  );

  const handleSelectAll = useCallback(() => {
    const allIds = items.map((i) => i.id);
    const isAll = items.length > 0 && selectedIds.length === items.length;

    if (rawOnSelectAll) {
      rawOnSelectAll(isAll ? [] : allIds);
    } else {
      setLocalSelectedIds(isAll ? [] : allIds);
    }
  }, [items, selectedIds, rawOnSelectAll]);

  // ── D. Sorting ─────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<TableSortField>('identifier');
  const [sortOrder, setSortOrder] = useState<TableSortOrder>('asc');

  const handleSort = useCallback(
    (field: TableSortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField]
  );

  const sortItemsList = useCallback(
    (list: Item[]) => {
      const copy = [...list];
      copy.sort((itemA, itemB) => {
        let comparison = 0;

        switch (sortField) {
          case 'identifier': {
            const numA = (itemA as any).sequenceNumber || 0;
            const numB = (itemB as any).sequenceNumber || 0;
            comparison = numA - numB;
            break;
          }
          case 'title':
            comparison = (itemA.title || '').localeCompare(itemB.title || '');
            break;
          case 'dueDate': {
            const timeA = itemA.dueDate ? new Date(itemA.dueDate).getTime() : 0;
            const timeB = itemB.dueDate ? new Date(itemB.dueDate).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'startDate': {
            const timeA = itemA.startDate ? new Date(itemA.startDate).getTime() : 0;
            const timeB = itemB.startDate ? new Date(itemB.startDate).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'createdOn': {
            const timeA = (itemA as any).createdAt ? new Date((itemA as any).createdAt).getTime() : 0;
            const timeB = (itemB as any).createdAt ? new Date((itemB as any).createdAt).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'updatedOn': {
            const timeA = (itemA as any).updatedAt ? new Date((itemA as any).updatedAt).getTime() : 0;
            const timeB = (itemB as any).updatedAt ? new Date((itemB as any).updatedAt).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'priority': {
            const weights: Record<string, number> = {
              urgent: 4,
              high: 3,
              medium: 2,
              low: 1,
              none: 0,
            };
            const weightA = weights[itemA.priority || 'none'] || 0;
            const weightB = weights[itemB.priority || 'none'] || 0;
            comparison = weightA - weightB;
            break;
          }
          default:
            comparison = 0;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
      return copy;
    },
    [sortField, sortOrder]
  );

  // ── E. Grouping Logic ──────────────────────────────────────────────────────
  const isGrouped = displayOptions?.groupBy && displayOptions.groupBy !== 'none';

  // Group expansion state
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Groups generation
  const groups = useMemo(() => {
    if (!isGrouped) return [];

    return columns.map((col) => {
      const colId = resolveColumnId(col);
      const groupItems =
        itemsByColumnId instanceof Map
          ? itemsByColumnId.get(colId) ?? []
          : (itemsByColumnId as Record<string, Item[]>)?.[colId] ??
            items.filter((i) => i.columnId === colId);

      const colColor = col.color || col.accentColor || '#8A9093';
      const colTitle = col.title || col.name || 'Group';

      return {
        key: colId,
        title: colTitle,
        color: colColor,
        column: col,
        items: sortItemsList(groupItems),
      };
    });
  }, [isGrouped, columns, itemsByColumnId, items, sortItemsList]);

  // Flat sorted items when not grouped
  const flatSortedItems = useMemo(() => {
    if (isGrouped) return [];
    return sortItemsList(items);
  }, [isGrouped, items, sortItemsList]);

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  const defaultColId = useMemo(() => {
    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    return defaultCol ? resolveColumnId(defaultCol) : 'backlog';
  }, [columns]);

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden bg-background">
      <div className="flex-1 overflow-auto">
        <div role="table" aria-label="Work items table" className="min-w-max">
          {/* Main Sticky Header */}
          <div role="rowgroup">
            <TableHeaderRow
              visibleProperties={visibleProperties}
              columnWidths={columnWidths}
              onResizeColumn={handleResizeColumn}
              onToggleProperty={handleToggleProperty}
              onResetProperties={handleResetProperties}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              onToggleSelectAll={handleSelectAll}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
              totalItemsCount={items.length}
            />
          </div>

          {/* Zero items state */}
          {items.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="size-10 rounded-md bg-muted flex items-center justify-center mb-3">
                <FileText className="size-5 text-foreground" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">No work items found</h4>
              <p className="text-xs text-muted-foreground mb-4">
                There are no items matching the current view filters.
              </p>
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddCard(defaultColId)}
                  className="gap-1.5 text-xs rounded-md"
                >
                  <Plus className="size-3.5" />
                  <span>Create work item</span>
                </Button>
              )}
            </div>
          )}

          {/* Grouped Mode */}
          {isGrouped && items.length > 0 && (
            <div role="rowgroup" className="flex flex-col">
              {groups.map((group) => {
                const isExpanded = !collapsedGroupKeys.has(group.key);

                // Group icon
                let groupIcon: React.ReactNode = null;
                if (displayOptions?.groupBy === 'priority') {
                  groupIcon = renderPriorityIcon(group.key as Priority);
                } else {
                  groupIcon = (
                    <StatusIcon
                      id={group.key}
                      title={group.title}
                      group={group.column.group || group.title}
                      color={group.color}
                      className="size-3.5 shrink-0"
                    />
                  );
                }

                return (
                  <div key={group.key} className="flex flex-col border-b border-border/40">
                    <TableGroupHeader
                      title={group.title}
                      color={group.color}
                      icon={groupIcon}
                      count={group.items.length}
                      isExpanded={isExpanded}
                      onToggle={() => toggleGroupCollapse(group.key)}
                      onQuickAdd={() => onAddCard(group.key)}
                      isReadOnly={isReadOnly}
                    />

                    {isExpanded && (
                      <div className="flex flex-col">
                        {group.items.map((item) => (
                          <TableRowItem
                            key={item.id}
                            item={item}
                            columns={columns}
                            projectStates={projectStates || columns}
                            visibleProperties={visibleProperties}
                            columnWidths={columnWidths}
                            isSelected={selectedIds.includes(item.id)}
                            onToggleSelect={handleToggleSelect}
                            onEditCard={onEditCard}
                            onDeleteCard={onDeleteCard}
                            onDuplicateCard={onDuplicateCard}
                            onUpdateCard={onUpdateCard}
                            members={members}
                            cycles={cycles}
                            projectId={projectId}
                            workspaceId={workspaceId}
                            isReadOnly={isReadOnly}
                          />
                        ))}

                        <TableInlineAddRow
                          targetColumnId={group.key}
                          groupTitle={group.title}
                          onAddCard={onAddCard}
                          isReadOnly={isReadOnly}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Flat Mode */}
          {!isGrouped && items.length > 0 && (
            <div role="rowgroup" className="flex flex-col">
              {flatSortedItems.map((item) => (
                <TableRowItem
                  key={item.id}
                  item={item}
                  columns={columns}
                  projectStates={projectStates || columns}
                  visibleProperties={visibleProperties}
                  columnWidths={columnWidths}
                  isSelected={selectedIds.includes(item.id)}
                  onToggleSelect={handleToggleSelect}
                  onEditCard={onEditCard}
                  onDeleteCard={onDeleteCard}
                  onDuplicateCard={onDuplicateCard}
                  onUpdateCard={onUpdateCard}
                  members={members}
                  cycles={cycles}
                  projectId={projectId}
                  workspaceId={workspaceId}
                  isReadOnly={isReadOnly}
                />
              ))}

              <TableInlineAddRow
                targetColumnId={defaultColId}
                onAddCard={onAddCard}
                isReadOnly={isReadOnly}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TableView;
