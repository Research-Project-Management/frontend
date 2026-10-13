'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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
  MoreHorizontal,
  Pencil,
  Copy,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Check,
  CheckSquare,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { cn } from "@/shared/lib/utils";
import { useCopyItemText } from '../../hooks/use-work-item';
import {
  StatusIcon,
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
} from '@/shared/components/icons';
import { ItemHelpers, resolveColumnId } from '../../utils/work-item.utils';
import {
  MemberPopover,
  SingleDatePopover,
  PriorityPopover,
  LabelPopover,
  AvatarStack,
} from '../modals/Popovers';
import type {
  Item,
  Column as ColumnType,
  ProjectMember,
  Priority,
  DisplayOptions,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
} from '../../types/work-item.types';

// â”€â”€ 1. Table Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type TablePropertyKey =
  | 'state'
  | 'priority'
  | 'assignees'
  | 'dueDate'
  | 'labels'
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
  members?: ProjectMember[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: ((ids?: string[]) => void) | (() => void);
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  onToggleDisplayProperty?: (key: any, value: boolean) => void;
}

// â”€â”€ 2. Table Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const TABLE_STORAGE_KEY = 'flux:table_view:columns_v5';
export const TABLE_WIDTHS_STORAGE_KEY = 'flux:table_view:column_widths_v4';

export const TABLE_PROPERTIES: TablePropertyConfig[] = [
  { key: 'state', label: 'State', icon: StatusIcon, defaultVisible: true, minWidth: 115 },
  { key: 'priority', label: 'Priority', icon: MediumPriorityBoxIcon, defaultVisible: true, minWidth: 95 },
  { key: 'assignees', label: 'Assignees', icon: Users, defaultVisible: true, minWidth: 120 },
  { key: 'startDate', label: 'Start date', icon: CalendarClock, defaultVisible: false, minWidth: 110 },
  { key: 'dueDate', label: 'Due date', icon: Calendar, defaultVisible: true, minWidth: 110 },
  { key: 'labels', label: 'Labels', icon: Tag, defaultVisible: true, minWidth: 120 },
  { key: 'subItemCount', label: 'Sub-items', icon: Layers, defaultVisible: false, minWidth: 95 },
  { key: 'attachment', label: 'Attachments', icon: Paperclip, defaultVisible: false, minWidth: 95 },
  { key: 'link', label: 'Links', icon: Link2, defaultVisible: false, minWidth: 90 },
  { key: 'createdOn', label: 'Created on', icon: Calendar, defaultVisible: false, minWidth: 110 },
  { key: 'createdBy', label: 'Created by', icon: User, defaultVisible: false, minWidth: 115 },
  { key: 'updatedOn', label: 'Updated on', icon: Calendar, defaultVisible: false, minWidth: 110 },
];

export const DEFAULT_VISIBLE_PROPERTIES: Record<TablePropertyKey, boolean> = {
  state: true,
  priority: true,
  assignees: true,
  startDate: false,
  dueDate: true,
  labels: true,
  subItemCount: false,
  attachment: false,
  link: false,
  createdOn: false,
  createdBy: false,
  updatedOn: false,
};

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  title: 320,
  state: 115,
  priority: 95,
  assignees: 120,
  startDate: 110,
  dueDate: 110,
  labels: 120,
  subItemCount: 95,
  attachment: 95,
  link: 90,
  createdOn: 110,
  createdBy: 115,
  updatedOn: 110,
};

// â”€â”€ 3. Helper: Priority Icon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ 4. Helper: Date Formatter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatTableDate(dateStr?: string | null) {
  return ItemHelpers.formatDate(dateStr) || null;
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

// â”€â”€ 5. Table Column Properties Popover â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-foreground hover:bg-muted border border-border bg-background transition-colors cursor-pointer select-none relative before:absolute before:-inset-2 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring"
        >
          <SlidersHorizontal className="size-3.5 shrink-0" />
          <span>Display</span>
          <span className="rounded-md bg-muted px-1.5 py-0.2 text-10 font-mono font-medium text-foreground tabular-nums">
            {activeCount}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 border-border bg-popover shadow-overlay z-100 rounded-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border px-1">
          <span className="text-xs font-semibold text-foreground">Display properties</span>
        </div>

        <div className="relative mb-2 px-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search properties..."
            className="h-7 pl-7 text-xs bg-background border-border placeholder:text-muted-foreground text-foreground rounded-md focus-visible:ring-1 focus-visible:ring-ring"
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

// â”€â”€ 6. Table Header Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
}: {
  visibleProperties: Record<TablePropertyKey, boolean>;
  columnWidths?: Record<string, number>;
  onResizeColumn?: (key: string, width: number) => void;
  onToggleProperty?: (key: TablePropertyKey) => void;
  onResetProperties?: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  sortField?: TableSortField;
  sortOrder?: TableSortOrder;
  onSort?: (field: TableSortField) => void;
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

  const titleWidth = columnWidths?.title || DEFAULT_COLUMN_WIDTHS.title;

  return (
    <div
      role="row"
      className="sticky top-0 z-20 flex items-center h-9 border-b border-border bg-background text-11 font-medium text-muted-foreground select-none w-full"
    >
      {/* 1. First Column: Work items Title (Frozen / Sticky Left) */}
      <div
        role="columnheader"
        style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px`, left: 0 }}
        className="sticky left-0 z-30 flex items-center px-2.5 h-full border-r border-border shrink-0 group/header bg-background"
      >
        <div className="flex items-center w-full">
          <span
            onClick={() => onSort?.('title')}
            className="flex items-center gap-1.5 text-11 font-medium text-foreground cursor-pointer hover:text-foreground transition-colors truncate"
          >
            <span>Work items</span>
            {renderSortIndicator('title')}
          </span>
        </div>
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
          const propWidth = columnWidths?.[p.key] || DEFAULT_COLUMN_WIDTHS[p.key] || p.minWidth || 144;

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
                'relative flex items-center gap-1.5 px-3 h-full text-xs font-medium text-foreground select-none transition-colors outline-none shrink-0 group/col border-r border-border',
                isSortable && 'cursor-pointer hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className="size-3.5 shrink-0 text-foreground" />
              <span className="truncate">{p.label}</span>
              {isSortable && renderSortIndicator(p.key as TableSortField)}
            </div>
          );
        })}
      </div>

      {/* 3. Fixed Actions Column Header */}
      <div
        role="columnheader"
        aria-label="Actions"
        style={{ width: '48px', minWidth: '48px' }}
        className="flex items-center justify-center h-full shrink-0 border-r border-border"
      />
      <div className="flex-1 h-full min-w-0" />
    </div>
  );
}

// â”€â”€ 7. Table Group Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      className="sticky top-9 z-20 flex items-center h-9 px-2.5 border-b border-border bg-muted/50 hover:bg-muted/70 backdrop-blur-xs transition-colors cursor-pointer select-none gap-2 text-xs font-medium text-foreground w-full"
    >
      <div className="sticky left-2.5 flex items-center gap-2 shrink-0">
        {icon ? (
          icon
        ) : (
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: color || '#6B7280' }}
          />
        )}

        <span className="font-semibold text-foreground truncate">{title}</span>

        <span className="rounded-md bg-background border border-border px-1.5 py-0.2 text-10 font-mono font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
    </div>
  );
}

// â”€â”€ 8. Table Row Item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
}: {
  item: Item;
  columns: ColumnType[];
  projectStates?: ColumnType[];
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

  // Active properties list
  const activeProperties = useMemo(
    () => TABLE_PROPERTIES.filter((p) => visibleProperties[p.key]),
    [visibleProperties]
  );

  const titleWidth = columnWidths?.title || DEFAULT_COLUMN_WIDTHS.title;

  // Sub-items count
  const childCount =
    item.childWorkItemCount ?? item.childWorkItems?.length ?? 0;
  const attachmentsCount = ItemHelpers.countAttachments(item.attachments);

  const isOverdue = isDateOverdue(item.dueDate, item.completed);
  const stateMatch = columns.find((c) => resolveColumnId(c) === item.columnId);
  const stateGroup = stateMatch?.group || item.stateGroup || item.state?.group;
  const isCancelled = stateGroup === 'cancelled' || item.columnId === 'cancelled' || item.columnId === 'cancel';
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

      {/* â”€â”€ 2. Dynamic Property Cells â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ 3. Actions Column Cell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

// â”€â”€ 9. Table Inline Quick Add Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function TableInlineAddRow({
  targetColumnId,
  titleWidth = 360,
  onAddCard,
  isReadOnly = false,
}: {
  targetColumnId: string;
  titleWidth?: number;
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
      <div
        role="row"
        onClick={() => setIsAdding(true)}
        className="flex items-center h-9 border-b border-border bg-background hover:bg-muted/40 transition-colors duration-0 w-full cursor-pointer select-none group/table-add-bottom shrink-0"
      >
        <div
          className="sticky left-0 flex items-center h-full px-2.5 transition-colors border-r border-border"
          style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px` }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 h-full text-13 text-muted-foreground hover:text-foreground font-normal transition-colors cursor-pointer text-left outline-none focus-visible:outline-none"
          >
            <Plus className="size-3.5 shrink-0 text-muted-foreground group-hover/table-add-bottom:text-foreground transition-colors" />
            <span>New work item</span>
          </button>
        </div>
        <div className="flex-1 h-full" />
      </div>
    );
  }

  return (
    <form
      role="row"
      onSubmit={handleSubmit}
      className="flex items-center h-9 border-b border-border bg-background transition-colors duration-0 w-full shrink-0"
    >
      <div
        className="sticky left-0 flex items-center gap-2 h-full px-2.5 bg-background z-10 border-r border-border"
        style={{ width: `${titleWidth}px`, minWidth: `${titleWidth}px` }}
      >
        <Plus className="size-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          aria-label="New work item title"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New work item"
          className="flex-1 bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none font-normal px-1"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim()}
            className="h-6 px-2.5 text-xs font-medium rounded-md focus-visible:ring-1 focus-visible:ring-ring"
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
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md"
          >
            Cancel
          </Button>
        </div>
      </div>
      <div className="flex-1 h-full bg-background" />
    </form>
  );
}

export function TableBottomAddBar({
  defaultColId,
  onAddCard,
}: {
  defaultColId: string;
  onAddCard: (columnId: string, title: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddCard(defaultColId, trimmed);
    setTitle('');
    setIsAdding(false);
  };

  return (
    <div className="h-9 flex items-center bg-background select-none shrink-0 px-2.5">
      {!isAdding ? (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-13 text-foreground hover:text-foreground cursor-pointer font-normal"
        >
          <Plus className="size-3.5 shrink-0 text-foreground" />
          <span>Add work item</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsAdding(false);
                setTitle('');
              }
            }}
            placeholder="New work item"
            className="flex-1 bg-transparent text-13 outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setTitle('');
            }}
            className="text-11 px-2 py-0.5 rounded text-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="text-11 px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}

export interface TableGroupRowListProps {
  rows: Array<{
    item: Item;
    isSubItem: boolean;
    hasChildren: boolean;
    isChildrenExpanded: boolean;
  }>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  columns: ColumnType[];
  projectStates?: ColumnType[];
  visibleProperties: Record<TablePropertyKey, boolean>;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onEditCard: (card: Item) => void;
  onDeleteCard?: (card: any) => void;
  onDuplicateCard?: (card: any) => void;
  onUpdateCard?: (data: Partial<Item> & { id: string }) => void;
  members?: any[];
  projectId?: string;
  isReadOnly?: boolean;
  toggleExpandChildren: (parentId: string) => void;
}

export function TableGroupRowList({
  rows,
  scrollRef,
  columns,
  projectStates,
  visibleProperties,
  selectedIds,
  onToggleSelect,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onUpdateCard,
  members = [],
  projectId = '',
  isReadOnly = false,
  toggleExpandChildren,
}: TableGroupRowListProps) {
  const isVirtualized = rows.length > 50;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 10,
    enabled: isVirtualized,
  });

  const virtualItems = isVirtualized ? virtualizer.getVirtualItems() : [];

  if (isVirtualized && virtualItems.length > 0) {
    return (
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          const { item, isSubItem, hasChildren, isChildrenExpanded } = row;
          return (
            <div
              key={item.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TableRowItem
                item={item}
                columns={columns}
                projectStates={projectStates || columns}
                visibleProperties={visibleProperties}
                isSelected={selectedIds.includes(item.id)}
                onToggleSelect={onToggleSelect}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                onUpdateCard={onUpdateCard}
                members={members}
                projectId={projectId}
                isReadOnly={isReadOnly}
                isSubItem={isSubItem}
                hasChildren={hasChildren}
                isChildrenExpanded={isChildrenExpanded}
                onToggleExpandChildren={toggleExpandChildren}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {rows.map(({ item, isSubItem, hasChildren, isChildrenExpanded }) => (
        <TableRowItem
          key={item.id}
          item={item}
          columns={columns}
          projectStates={projectStates || columns}
          visibleProperties={visibleProperties}
          isSelected={selectedIds.includes(item.id)}
          onToggleSelect={onToggleSelect}
          onEditCard={onEditCard}
          onDeleteCard={onDeleteCard}
          onDuplicateCard={onDuplicateCard}
          onUpdateCard={onUpdateCard}
          members={members}
          projectId={projectId}
          isReadOnly={isReadOnly}
          isSubItem={isSubItem}
          hasChildren={hasChildren}
          isChildrenExpanded={isChildrenExpanded}
          onToggleExpandChildren={toggleExpandChildren}
        />
      ))}
    </div>
  );
}

// ── 10. Main TableView Component ──────────────────────────────────────────────

export function TableView({
  items = [],
  itemsByColumnId,
  columns,
  projectStates,
  displayOptions,
  projectId = '',
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
  // â”€â”€ A. Column Visibility (Synchronized with displayOptions.properties) â”€â”€â”€â”€â”€
  const visibleProperties = useMemo<Record<TablePropertyKey, boolean>>(() => {
    const p = (displayOptions?.properties || {}) as Record<string, unknown>;

    return {
      state: p.state !== undefined ? Boolean(p.state) : DEFAULT_VISIBLE_PROPERTIES.state,
      priority: p.priority !== undefined ? Boolean(p.priority) : DEFAULT_VISIBLE_PROPERTIES.priority,
      assignees:
        (p.assignees ?? p.assignee) !== undefined
          ? Boolean(p.assignees ?? p.assignee)
          : DEFAULT_VISIBLE_PROPERTIES.assignees,
      startDate:
        (p.startDate ?? p.start_date) !== undefined
          ? Boolean(p.startDate ?? p.start_date)
          : DEFAULT_VISIBLE_PROPERTIES.startDate,
      dueDate:
        (p.dueDate ?? p.due_date) !== undefined
          ? Boolean(p.dueDate ?? p.due_date)
          : DEFAULT_VISIBLE_PROPERTIES.dueDate,
      labels: p.labels !== undefined ? Boolean(p.labels) : DEFAULT_VISIBLE_PROPERTIES.labels,
      subItemCount:
        (p.subItemCount ?? p.sub_issue_count ?? p.childWorkItemCount) !== undefined
          ? Boolean(p.subItemCount ?? p.sub_issue_count ?? p.childWorkItemCount)
          : DEFAULT_VISIBLE_PROPERTIES.subItemCount,
      attachment:
        (p.attachment ?? p.attachment_count ?? p.attachmentCount ?? p.attach) !== undefined
          ? Boolean(p.attachment ?? p.attachment_count ?? p.attachmentCount ?? p.attach)
          : DEFAULT_VISIBLE_PROPERTIES.attachment,
      link: p.link !== undefined ? Boolean(p.link) : DEFAULT_VISIBLE_PROPERTIES.link,
      createdOn:
        (p.createdOn ?? p.created_on) !== undefined
          ? Boolean(p.createdOn ?? p.created_on)
          : DEFAULT_VISIBLE_PROPERTIES.createdOn,
      createdBy:
        (p.createdBy ?? p.created_by) !== undefined
          ? Boolean(p.createdBy ?? p.created_by)
          : DEFAULT_VISIBLE_PROPERTIES.createdBy,
      updatedOn:
        (p.updatedOn ?? p.updated_on) !== undefined
          ? Boolean(p.updatedOn ?? p.updated_on)
          : DEFAULT_VISIBLE_PROPERTIES.updatedOn,
    };
  }, [displayOptions?.properties]);

  const handleToggleProperty = useCallback(
    (key: TablePropertyKey) => {
      const nextVal = !visibleProperties[key];
      if (onToggleDisplayProperty) {
        const keyMap: Partial<Record<TablePropertyKey, string>> = {
          state: 'state',
          priority: 'priority',
          assignees: 'assignee',
          startDate: 'startDate',
          dueDate: 'dueDate',
          labels: 'labels',
          subItemCount: 'childWorkItemCount',
          attachment: 'attachmentCount',
          link: 'link',
        };
        const displayKey = keyMap[key];
        if (displayKey) {
          onToggleDisplayProperty(displayKey, nextVal);
        }
      }
    },
    [visibleProperties, onToggleDisplayProperty]
  );

  const handleResetProperties = useCallback(() => {
    // Reset properties to default
  }, []);

  // â”€â”€ B. Multi-Select Handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ D. Sorting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            const numA = itemA.sequenceNumber || 0;
            const numB = itemB.sequenceNumber || 0;
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
            const timeA = itemA.createdAt ? new Date(itemA.createdAt).getTime() : 0;
            const timeB = itemB.createdAt ? new Date(itemB.createdAt).getTime() : 0;
            comparison = timeA - timeB;
            break;
          }
          case 'updatedOn': {
            const timeA = itemA.updatedAt ? new Date(itemA.updatedAt).getTime() : 0;
            const timeB = itemB.updatedAt ? new Date(itemB.updatedAt).getTime() : 0;
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

  // â”€â”€ E. Grouping Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const effectiveGroupBy = displayOptions?.groupBy ?? 'none';
  const isGrouped = Boolean(effectiveGroupBy && effectiveGroupBy !== 'none');

  // Group expansion state
  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  const stateList = useMemo(
    () => (projectStates && projectStates.length > 0 ? projectStates : columns),
    [projectStates, columns]
  );

  // Dynamic Groups Generation based on effectiveGroupBy
  const groups = useMemo(() => {
    if (!isGrouped) return [];

    if (effectiveGroupBy === 'priority') {
      const priorityConfigs: Array<{ key: Priority; title: string }> = [
        { key: 'urgent', title: 'Urgent' },
        { key: 'high', title: 'High' },
        { key: 'medium', title: 'Medium' },
        { key: 'low', title: 'Low' },
        { key: 'none', title: 'No priority' },
      ];

      return priorityConfigs.map((p) => {
        const groupItems =
          itemsByColumnId instanceof Map && itemsByColumnId.has(p.key)
            ? itemsByColumnId.get(p.key) || []
            : items.filter((item) => (item.priority || 'none').toLowerCase() === p.key.toLowerCase());
        return {
          key: p.key,
          title: p.title,
          color: undefined,
          icon: renderPriorityIcon(p.key),
          items: sortItemsList(groupItems),
        };
      });
    }

    if (effectiveGroupBy === 'assignee') {
      const memberGroups = (members || []).map((m) => {
        const mem = m as typeof m & { user?: { id?: string; name?: string } };
        const userId = mem.userId || mem.user?.id || mem.id || '';
        const name = mem.name || mem.user?.name || 'Member';
        const groupItems =
          itemsByColumnId instanceof Map && itemsByColumnId.has(userId)
            ? itemsByColumnId.get(userId) || []
            : items.filter(
                (item) => ItemHelpers.resolveAssigneeId(item) === userId
              );
        return {
          key: userId,
          title: name,
          color: undefined,
          icon: (
            <Avatar className="size-4 shrink-0">
              <AvatarImage src={mem.avatar || mem.user?.avatar} />
              <AvatarFallback className="text-9 font-medium bg-muted">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ),
          items: sortItemsList(groupItems),
        };
      });

      const unassignedItems =
        itemsByColumnId instanceof Map && itemsByColumnId.has('__unassigned__')
          ? itemsByColumnId.get('__unassigned__') || []
          : items.filter((item) => !ItemHelpers.resolveAssigneeId(item));
      memberGroups.push({
        key: '__unassigned__',
        title: 'Unassigned',
        color: undefined,
        icon: <User className="size-3.5 shrink-0 text-muted-foreground" />,
        items: sortItemsList(unassignedItems),
      });

      return memberGroups;
    }

    if (effectiveGroupBy === 'labels') {
      const labelMap = new Map<string, { id: string; name: string; color?: string }>();
      items.forEach((item) => {
        if (Array.isArray(item.labels)) {
          item.labels.forEach((l: any) => {
            const id = typeof l === 'string' ? l : l.id || l.name;
            const name = typeof l === 'string' ? l : l.name || l.title || l.id;
            const color = typeof l === 'object' ? l.color : undefined;
            if (id && !labelMap.has(id)) {
              labelMap.set(id, { id, name, color });
            }
          });
        }
      });

      const labelGroups = Array.from(labelMap.values()).map((l) => {
        const groupItems = items.filter((item) => {
          if (!Array.isArray(item.labels)) return false;
          return item.labels.some((il: any) => (typeof il === 'string' ? il : il.id || il.name) === l.id);
        });
        return {
          key: l.id,
          title: l.name,
          color: l.color,
          icon: l.color ? (
            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
          ) : (
            <Tag className="size-3.5 shrink-0 text-muted-foreground" />
          ),
          items: sortItemsList(groupItems),
        };
      });

      const noLabelItems = items.filter((item) => !Array.isArray(item.labels) || item.labels.length === 0);
      labelGroups.push({
        key: '__no_label__',
        title: 'No label',
        color: undefined,
        icon: <Tag className="size-3.5 shrink-0 text-muted-foreground" />,
        items: sortItemsList(noLabelItems),
      });

      return labelGroups;
    }

    // Default: Group by State
    return stateList.map((col) => {
      const colId = resolveColumnId(col);
      const groupItems =
        itemsByColumnId instanceof Map
          ? itemsByColumnId.get(colId) || []
          : (itemsByColumnId as Record<string, Item[]>)?.[colId] ??
            items.filter((i) => {
              const itemCol = i.columnId || (i as any).stateId || i.state?.id;
              return itemCol === colId;
            });
      const colColor = col.color || col.accentColor || '#6B7280';
      const colTitle = col.title || col.name || 'Group';

      return {
        key: colId,
        title: colTitle,
        color: colColor,
        icon: (
          <StatusIcon
            id={colId}
            title={colTitle}
            group={col.group || col.slug || colTitle}
            color={colColor}
            className="size-3.5 shrink-0"
          />
        ),
        items: sortItemsList(groupItems),
      };
    });
  }, [isGrouped, effectiveGroupBy, items, itemsByColumnId, stateList, members, sortItemsList]);

  // Flat sorted items when not grouped
  const flatSortedItems = useMemo(() => {
    if (isGrouped) return [];
    return sortItemsList(items);
  }, [isGrouped, items, sortItemsList]);

  // â”€â”€ F. Sub-items Tree & Hierarchy (Plane.so style) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());

  const toggleExpandChildren = useCallback((parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  const showChildWorkItems = displayOptions?.showChildWorkItems ?? true;

  const buildTreeRows = useCallback(
    (sortedList: Item[]): Array<{
      item: Item;
      isSubItem: boolean;
      hasChildren: boolean;
      isChildrenExpanded: boolean;
    }> => {
      if (!showChildWorkItems) {
        return sortedList
          .filter((item) => !item.parentId && !item.parentItemId && !item.parentWorkItemId)
          .map((item) => ({
            item,
            isSubItem: false,
            hasChildren: false,
            isChildrenExpanded: true,
          }));
      }

      const itemMap = new Map<string, Item>();
      sortedList.forEach((it) => itemMap.set(it.id, it));

      const childrenByParentId = new Map<string, Item[]>();
      const rootItems: Item[] = [];

      sortedList.forEach((it) => {
        const pId = it.parentId || it.parentItemId || it.parentWorkItemId;
        if (pId && itemMap.has(pId)) {
          const arr = childrenByParentId.get(pId) || [];
          arr.push(it);
          childrenByParentId.set(pId, arr);
        } else {
          rootItems.push(it);
        }
      });

      const result: Array<{
        item: Item;
        isSubItem: boolean;
        hasChildren: boolean;
        isChildrenExpanded: boolean;
      }> = [];
      const visited = new Set<string>();

      const appendItemAndChildren = (it: Item, depth: number) => {
        if (visited.has(it.id)) return;
        visited.add(it.id);

        const children = childrenByParentId.get(it.id) || [];
        const hasChildren = children.length > 0;
        const isChildrenExpanded = !collapsedParentIds.has(it.id);

        result.push({
          item: it,
          isSubItem: depth > 0,
          hasChildren,
          isChildrenExpanded,
        });

        if (hasChildren && isChildrenExpanded) {
          children.forEach((child) => appendItemAndChildren(child, depth + 1));
        }
      };

      rootItems.forEach((root) => appendItemAndChildren(root, 0));

      return result;
    },
    [showChildWorkItems, collapsedParentIds]
  );

  const flatTreeRows = useMemo(
    () => buildTreeRows(flatSortedItems),
    [buildTreeRows, flatSortedItems]
  );

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;
  const isSomeSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  const defaultColId = useMemo(() => {
    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    return defaultCol ? resolveColumnId(defaultCol) : 'backlog';
  }, [columns]);

  const tableScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden bg-background">
      <div
        ref={tableScrollRef}
        className="flex-1 overflow-auto select-none bg-background relative min-h-0 interactive-scrollbar"
      >
        <div role="table" aria-label="Work items table" className="min-w-full w-max flex flex-col">
          {/* Main Sticky Header */}
          <div role="rowgroup">
            <TableHeaderRow
              visibleProperties={visibleProperties}
              onToggleProperty={handleToggleProperty}
              onResetProperties={handleResetProperties}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              onToggleSelectAll={handleSelectAll}
              sortField={sortField}
              sortOrder={sortOrder}
              onSort={handleSort}
            />
          </div>

          {/* Zero items state */}
          {items.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="size-10 rounded-md bg-muted flex items-center justify-center mb-3">
                <FileText className="size-5 text-foreground" />
              </div>
              <h4 className="text-16 font-semibold text-foreground mb-1">No work items found</h4>
              <p className="text-13 text-muted-foreground mb-4">
                There are no items matching the current view filters.
              </p>
              {!isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddCard(defaultColId)}
                  className="gap-1.5 text-xs rounded-md focus-visible:ring-1 focus-visible:ring-ring"
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
                if (group.items.length === 0 && !displayOptions?.showEmptyGroups) {
                  return null;
                }
                const isExpanded = !collapsedGroupKeys.has(group.key);

                return (
                  <div key={group.key} className="flex flex-col">
                    <TableGroupHeader
                      title={group.title}
                      color={group.color}
                      icon={group.icon}
                      count={group.items.length}
                      isExpanded={isExpanded}
                      onToggle={() => toggleGroupCollapse(group.key)}
                    />

                    {isExpanded && (
                      <TableGroupRowList
                        rows={buildTreeRows(group.items)}
                        scrollRef={tableScrollRef}
                        columns={columns}
                        projectStates={projectStates || columns}
                        visibleProperties={visibleProperties}
                        selectedIds={selectedIds}
                        onToggleSelect={handleToggleSelect}
                        onEditCard={onEditCard}
                        onDeleteCard={onDeleteCard}
                        onDuplicateCard={onDuplicateCard}
                        onUpdateCard={onUpdateCard}
                        members={members}
                        projectId={projectId}
                        isReadOnly={isReadOnly}
                        toggleExpandChildren={toggleExpandChildren}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Flat Mode */}
          {!isGrouped && items.length > 0 && (
            <div role="rowgroup" className="flex flex-col">
              <TableGroupRowList
                rows={flatTreeRows}
                scrollRef={tableScrollRef}
                columns={columns}
                projectStates={projectStates || columns}
                visibleProperties={visibleProperties}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onDuplicateCard={onDuplicateCard}
                onUpdateCard={onUpdateCard}
                members={members}
                projectId={projectId}
                isReadOnly={isReadOnly}
                toggleExpandChildren={toggleExpandChildren}
              />
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Footer: "+ New work item" Row (pinned at bottom, outside the scroll area) */}
      {items.length > 0 && !isReadOnly && (
        <div className="shrink-0 border-t border-border bg-background z-20">
          <TableInlineAddRow
            targetColumnId={defaultColId}
            titleWidth={DEFAULT_COLUMN_WIDTHS.title}
            onAddCard={onAddCard}
            isReadOnly={isReadOnly}
          />
        </div>
      )}
    </div>
  );
}

export function TableHorizontalScrollbar({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    canScroll: false,
  });

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const can = el.scrollWidth > el.clientWidth + 2;
    setScrollState({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      canScroll: can,
    });
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();

    const handleScroll = () => {
      updateScrollState();
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateScrollState);
      ro.disconnect();
    };
  }, [scrollRef, updateScrollState]);

  if (!scrollState.canScroll) return null;

  const maxScroll = Math.max(1, scrollState.scrollWidth - scrollState.clientWidth);
  const scrollRatio = Math.min(1, Math.max(0, scrollState.scrollLeft / maxScroll));
  // Keep thumb width clean and compact (between 15% and 35%) so it is never excessively long
  const thumbWidthPercent = Math.max(
    15,
    Math.min(35, (scrollState.clientWidth / scrollState.scrollWidth) * 100)
  );
  const maxThumbLeft = 100 - thumbWidthPercent;
  const thumbLeftPercent = scrollRatio * maxThumbLeft;

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    el.scrollTo({
      left: ratio * maxScroll,
      behavior: 'smooth',
    });
  };

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return;

    const startX = e.clientX;
    const startScrollLeft = el.scrollLeft;
    const trackRect = track.getBoundingClientRect();
    const thumbWidthPx = (thumbWidthPercent / 100) * trackRect.width;
    const availableTravel = Math.max(1, trackRect.width - thumbWidthPx);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const scrollDelta = (deltaX / availableTravel) * maxScroll;
      el.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + scrollDelta));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="h-3.5 w-full border-t border-border bg-background flex items-center justify-center shrink-0 select-none py-1">
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative w-64 sm:w-80 h-1.5 rounded-full bg-muted/60 hover:bg-muted/80 cursor-pointer transition-colors"
      >
        <div
          onMouseDown={handleThumbMouseDown}
          className="absolute top-0 bottom-0 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/60 active:bg-muted-foreground/80 transition-colors cursor-grab active:cursor-grabbing"
          style={{
            width: `${thumbWidthPercent}%`,
            left: `${thumbLeftPercent}%`,
          }}
        />
      </div>
    </div>
  );
}

export default TableView;
