'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Tag,
  Paperclip,
  Timer,
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
  Archive,
  Trash2,
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
import { useCopyTaskText } from '../../hooks/use-tasks';
import { StatusIcon } from '../StatusIcon';
import { TaskHelpers } from '../../utils/util';
import type { Task, Column as ColumnType, Cycle, ProjectMember, Priority } from '../../types/types';

// ── 1. Table Types ───────────────────────────────────────────────────────────

export type TablePropertyKey =
  | 'state'
  | 'priority'
  | 'assignees'
  | 'labels'
  | 'attach'
  | 'cycle'
  | 'startDate'
  | 'dueDate'
  | 'createdOn'
  | 'createdBy'
  | 'updatedOn'
  | 'link'
  | 'attachment'
  | 'subtask'
  | 'subWorkItem';

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
  minWidth?: number;
}

export interface TableViewProps {
  tasks: Task[];
  columns: ColumnType[];
  currentUserId?: string | null;
  currentUserAvatar?: string;
  projectId?: string;
  workspaceId?: string;
  cycles?: Cycle[];
  members?: ProjectMember[];
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onEditCard: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onJoinCard: (task: Task) => void;
  onLeaveCard: (task: Task) => void;
  onRemoveFromCycle?: (task: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  onUpdateCard?: (task: { id: string } & Partial<Task>) => void;
  isReadOnly?: boolean;
  selectedTaskIds?: string[];
  onToggleSelectTask?: (id: string) => void;
  onSelectAllTasks?: (ids: string[]) => void;
}

// ── 2. Table Custom Icons ────────────────────────────────────────────────────

export function PriorityNoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      aria-label="None"
    >
      <circle cx="8" cy="8" r="6.25" />
      <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
    </svg>
  );
}

export function PriorityLowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("size-3.5 shrink-0 text-blue-500", className)}
      aria-label="Low"
    >
      <rect x="2.5" y="10.5" width="2.5" height="3.5" rx="0.5" />
      <rect x="6.75" y="7" width="2.5" height="7" rx="0.5" opacity="0.15" />
      <rect x="11" y="3.5" width="2.5" height="10.5" rx="0.5" opacity="0.15" />
    </svg>
  );
}

export function PriorityMediumIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("size-3.5 shrink-0 text-amber-500", className)}
      aria-label="Medium"
    >
      <rect x="2.5" y="10.5" width="2.5" height="3.5" rx="0.5" />
      <rect x="6.75" y="7" width="2.5" height="7" rx="0.5" />
      <rect x="11" y="3.5" width="2.5" height="10.5" rx="0.5" opacity="0.15" />
    </svg>
  );
}

export function PriorityHighIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("size-3.5 shrink-0 text-orange-500", className)}
      aria-label="High"
    >
      <rect x="2.5" y="10.5" width="2.5" height="3.5" rx="0.5" />
      <rect x="6.75" y="7" width="2.5" height="7" rx="0.5" />
      <rect x="11" y="3.5" width="2.5" height="10.5" rx="0.5" />
    </svg>
  );
}

export function PriorityUrgentIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={cn("size-3 shrink-0 text-red-500", className)}
      aria-label="Urgent"
    >
      <circle cx="8" cy="8" r="6.25" />
      <line x1="8" y1="4.5" x2="8" y2="8.5" strokeLinecap="round" />
      <circle cx="8" cy="11.25" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PriorityHeaderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      aria-label="Priority"
    >
      <rect x="2.5" y="10.5" width="2.5" height="3.5" rx="0.5" />
      <rect x="6.75" y="7" width="2.5" height="7" rx="0.5" />
      <rect x="11" y="3.5" width="2.5" height="10.5" rx="0.5" />
    </svg>
  );
}

export function StateHeaderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      aria-label="State"
    >
      <circle cx="8" cy="8" r="6.25" />
      <circle cx="8" cy="8" r="2.5" strokeWidth="1.5" />
    </svg>
  );
}

export function ModulesGridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      aria-label="Modules"
    >
      <rect x="2.5" y="2.5" width="4" height="4" rx="1" />
      <rect x="9.5" y="2.5" width="4" height="4" rx="1" />
      <rect x="2.5" y="9.5" width="4" height="4" rx="1" />
      <rect x="9.5" y="9.5" width="4" height="4" rx="1" />
    </svg>
  );
}

// ── 3. Table Constants ───────────────────────────────────────────────────────

export const TABLE_STORAGE_KEY = 'flux:table_view:columns_v3';

export const TABLE_PROPERTIES: TablePropertyConfig[] = [
  { key: 'state', label: 'State', icon: StateHeaderIcon, defaultVisible: true, minWidth: 130 },
  { key: 'priority', label: 'Priority', icon: PriorityHeaderIcon, defaultVisible: true, minWidth: 110 },
  { key: 'assignees', label: 'Assignees', icon: Users, defaultVisible: true, minWidth: 130 },
  { key: 'labels', label: 'Labels', icon: Tag, defaultVisible: true, minWidth: 130 },
  { key: 'attach', label: 'Attach', icon: ModulesGridIcon, defaultVisible: true, minWidth: 140 },
  { key: 'cycle', label: 'Cycle', icon: Timer, defaultVisible: false, minWidth: 130 },
  { key: 'startDate', label: 'Start date', icon: CalendarClock, defaultVisible: false, minWidth: 120 },
  { key: 'dueDate', label: 'Due date', icon: Calendar, defaultVisible: false, minWidth: 120 },
  { key: 'createdOn', label: 'Created on', icon: Calendar, defaultVisible: false, minWidth: 120 },
  { key: 'createdBy', label: 'Created by', icon: User, defaultVisible: false, minWidth: 130 },
  { key: 'updatedOn', label: 'Updated on', icon: Calendar, defaultVisible: false, minWidth: 120 },
  { key: 'link', label: 'Link', icon: Link2, defaultVisible: false, minWidth: 110 },
  { key: 'attachment', label: 'Attachment', icon: Paperclip, defaultVisible: false, minWidth: 120 },
  { key: 'subtask', label: 'Subtasks', icon: Layers, defaultVisible: false, minWidth: 130 },
  { key: 'subWorkItem', label: 'Subtasks', icon: Layers, defaultVisible: false, minWidth: 130 },
];

export const DEFAULT_VISIBLE_PROPERTIES: Record<TablePropertyKey, boolean> = {
  state: true,
  priority: true,
  assignees: true,
  labels: true,
  attach: true,
  cycle: false,
  startDate: false,
  dueDate: false,
  createdOn: false,
  createdBy: false,
  updatedOn: false,
  link: false,
  attachment: false,
  subtask: false,
  subWorkItem: false,
};

// ── 4. Table Attach Cell ─────────────────────────────────────────────────────

export function TableAttachCell({
  task,
  onEditCard,
}: {
  task: Task;
  onEditCard?: (task: Task) => void;
}) {
  const rawAttachments = task.attachments;
  const attachmentsList: Array<{ id: string; name: string; url?: string }> = Array.isArray(rawAttachments)
    ? rawAttachments
    : rawAttachments && typeof rawAttachments === 'object'
    ? [
        ...((rawAttachments as any).files || []).map((fileItem: any) => ({
          id: fileItem.id || fileItem.url,
          name: fileItem.name || 'File',
          url: fileItem.url,
        })),
        ...((rawAttachments as any).pages || []).map((pageItem: any) => ({
          id: pageItem.id,
          name: pageItem.title || 'Page',
          url: '#',
        })),
        ...((rawAttachments as any).papers || []).map((paperItem: any) => ({
          id: paperItem.id,
          name: paperItem.title || 'Paper',
          url: '#',
        })),
        ...((rawAttachments as any).links || []).map((linkItem: any) => ({
          id: linkItem.url || linkItem.title,
          name: linkItem.title || linkItem.url,
          url: linkItem.url,
        })),
      ]
    : [];

  const hasAttachments = attachmentsList.length > 0;

  if (hasAttachments) {
    return (
      <Popover>
        <PopoverTrigger asChild onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ModulesGridIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium text-11">{attachmentsList.length}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-2 text-xs bg-popover border-border shadow-none"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border">
            <span className="font-medium text-foreground">Attachments ({attachmentsList.length})</span>
            {onEditCard && (
              <button
                type="button"
                onClick={() => onEditCard(task)}
                className="text-11 text-primary hover:underline"
              >
                View all
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {attachmentsList.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground truncate transition-colors"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{attachment.name}</span>
              </a>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div
      onClick={(event) => {
        event.stopPropagation();
        if (onEditCard) onEditCard(task);
      }}
      className="group/attach flex items-center h-6 cursor-pointer text-muted-foreground hover:text-foreground"
    >
      <div className="opacity-0 group-hover/row:opacity-100 group-hover/attach:opacity-100 transition-opacity duration-150 flex items-center gap-1 text-11 text-muted-foreground hover:text-foreground">
        <Plus className="h-3 w-3 shrink-0" />
        <span className="text-10">Attach</span>
      </div>
    </div>
  );
}

// ── 5. Table Action Menu ─────────────────────────────────────────────────────

export function TableActionMenu({
  task,
  projectId = '',
  workspaceId = '',
  onEditCard,
  onDuplicateCard,
  onDeleteCard,
}: {
  task: Task;
  projectId?: string;
  workspaceId?: string;
  onEditCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
}) {
  const copyTaskText = useCopyTaskText();

  const handleCopyLink = (event: React.MouseEvent) => {
    event.stopPropagation();
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/workspaces/${workspaceId}/projects/${projectId}/work-items?taskId=${task.id}`
        : '';
    if (url) {
      copyTaskText(url, 'Link copied to clipboard');
    }
  };

  const handleOpenInNewTab = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (typeof window !== 'undefined') {
      const url = `/workspaces/${workspaceId}/projects/${projectId}/work-items?taskId=${task.id}`;
      window.open(url, '_blank');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted p-0 rounded-sm"
        >
          <MoreHorizontal className="h-4 w-4 shrink-0" />
          <span className="sr-only">Work item actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 text-xs py-1">
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEditCard(task);
          }}
          className="gap-2 cursor-pointer"
        >
          <Pencil className="size-3.5 text-muted-foreground shrink-0" />
          <span>Edit</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onDuplicateCard(task);
          }}
          className="gap-2 cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Make a copy</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} className="gap-2 cursor-pointer">
          <Link2 className="size-3.5 text-muted-foreground shrink-0" />
          <span>Copy link</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenInNewTab} className="gap-2 cursor-pointer">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Open in new tab</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled
          className="gap-2 text-muted-foreground cursor-not-allowed"
          title="Only completed or cancelled work items can be archived"
        >
          <Archive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Archive</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onDeleteCard(task);
          }}
          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5 shrink-0" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── 6. Table Column Properties Popover ───────────────────────────────────────

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

  const filteredProperties = TABLE_PROPERTIES.filter((propertyItem) =>
    propertyItem.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = Object.values(visibleProperties).filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 border-border bg-background text-xs font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5 shrink-0" />
          <span>Display</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-10 font-medium text-muted-foreground">
            {activeCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 border-border bg-popover">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border px-1">
          <span className="text-xs font-semibold text-foreground">Display properties</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetProperties}
            className="h-6 px-1.5 text-11 text-muted-foreground hover:text-foreground gap-1"
          >
            <RotateCcw className="h-3 w-3 shrink-0" />
            Reset
          </Button>
        </div>

        <div className="relative mb-2 px-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search properties..."
            className="h-7 pl-7 text-xs bg-background border-border"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-0.5 px-1 py-0.5">
          {filteredProperties.map((propertyItem) => {
            const Icon = propertyItem.icon;
            const isChecked = Boolean(visibleProperties[propertyItem.key]);

            return (
              <label
                key={propertyItem.key}
                className="flex items-center justify-between px-2 py-1.5 rounded-sm text-xs cursor-pointer hover:bg-muted transition-colors text-foreground select-none"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{propertyItem.label}</span>
                </div>
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onToggleProperty(propertyItem.key)}
                  className="h-3.5 w-3.5"
                />
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 7. Table Header ──────────────────────────────────────────────────────────

export function TableHeader({
  visibleProperties,
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
  onToggleProperty: (key: TablePropertyKey) => void;
  onResetProperties: () => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  sortField?: TableSortField;
  sortOrder?: TableSortOrder;
  onSort?: (field: TableSortField) => void;
}) {
  const activeProperties = TABLE_PROPERTIES.filter((propertyItem) => visibleProperties[propertyItem.key]);

  const renderSortIndicator = (field: TableSortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-foreground ml-1 shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 text-foreground ml-1 shrink-0" />
    );
  };

  return (
    <div
      role="row"
      className="flex items-center h-9 border-b border-border bg-secondary text-xs text-muted-foreground font-normal select-none w-full"
    >
      <div
        role="columnheader"
        className="relative flex items-center min-w-[320px] max-w-[500px] flex-1 px-3 group/header"
      >
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center max-sm:opacity-100 sm:opacity-0 sm:group-hover/header:opacity-100 has-[[data-state=checked]]:opacity-100 transition-opacity duration-150">
          <Checkbox
            checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
            onCheckedChange={onToggleSelectAll}
            aria-label="Select all work items"
            className="h-3.5 w-3.5 border-border data-[state=checked]:border-primary"
          />
        </div>
        <span className="pl-6 text-xs font-normal text-muted-foreground select-none">
          Work items
        </span>
      </div>

      <div className="flex items-center">
        {activeProperties.map((propertyItem) => {
          const Icon = propertyItem.icon;
          const isSortable = [
            'state',
            'priority',
            'dueDate',
            'startDate',
            'createdOn',
            'updatedOn',
          ].includes(propertyItem.key);

          return (
            <div
              key={propertyItem.key}
              role="columnheader"
              tabIndex={isSortable ? 0 : undefined}
              aria-sort={sortField === propertyItem.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
              aria-label={isSortable ? `Sort by ${propertyItem.label}` : propertyItem.label}
              onKeyDown={(e) => {
                if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSort?.(propertyItem.key as TableSortField);
                }
              }}
              style={{ width: `${propertyItem.minWidth || 130}px` }}
              onClick={() => isSortable && onSort?.(propertyItem.key as TableSortField)}
              className={`flex items-center gap-1.5 px-3 h-9 text-xs text-muted-foreground select-none transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                isSortable ? 'cursor-pointer hover:bg-muted hover:text-foreground' : ''
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{propertyItem.label}</span>
              {isSortable && renderSortIndicator(propertyItem.key as TableSortField)}
            </div>
          );
        })}
      </div>

      <div className="ml-auto pr-3 flex items-center">
        <TableColumnPropertiesPopover
          visibleProperties={visibleProperties}
          onToggleProperty={onToggleProperty}
          onResetProperties={onResetProperties}
        />
      </div>
    </div>
  );
}

// ── 8. Table Quick Add Row ───────────────────────────────────────────────────

export function TableQuickAddRow({
  columns,
  defaultColumnId,
  onAddCard,
}: {
  columns: ColumnType[];
  defaultColumnId?: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>(
    defaultColumnId || columns[0]?.id || ''
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (defaultColumnId) {
      setSelectedColumnId(defaultColumnId);
    } else if (columns.length > 0 && !selectedColumnId) {
      setSelectedColumnId(columns[0].id || '');
    }
  }, [defaultColumnId, columns, selectedColumnId]);

  const activeColumn = columns.find((columnItem) => columnItem.id === selectedColumnId) || columns[0];

  const handleSubmit = (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!title.trim()) return;

    onAddCard(activeColumn?.id || '', title.trim());
    setTitle('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === 'Escape') {
      setIsAdding(false);
      setTitle('');
    }
  };

  if (!isAdding) {
    return (
      <div className="border-t border-border bg-background">
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full text-left font-normal select-none"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span>Add work item</span>
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-background p-2.5">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 max-w-2xl bg-background border border-border rounded-md p-1.5 focus-within:border-ring transition-colors"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <StatusIcon
                title={activeColumn?.title}
                group={activeColumn?.slug || activeColumn?.title}
                color={activeColumn?.accentColor}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className="max-w-[90px] truncate">
                {activeColumn?.title || 'State'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 text-xs py-1">
            {columns.map((columnItem) => (
              <DropdownMenuItem
                key={columnItem.id}
                onClick={() => columnItem.id && setSelectedColumnId(columnItem.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <StatusIcon
                  title={columnItem.title}
                  group={columnItem.slug || columnItem.title}
                  color={columnItem.accentColor}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span>{columnItem.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Input
          ref={inputRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Work item title..."
          className="h-7 border-0 shadow-none focus-visible:ring-0 text-xs px-1 bg-transparent"
        />

        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="submit"
            size="sm"
            disabled={!title.trim()}
            className="h-7 px-2.5 text-xs font-medium"
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
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// ── 9. Table Row ─────────────────────────────────────────────────────────────

export function TableRow({
  task,
  columns,
  visibleProperties,
  isSelected,
  onToggleSelect,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onMoveCard,
  onUpdateCard,
  members = [],
  cycles = [],
  projectId = '',
  workspaceId = '',
}: {
  task: Task;
  columns: ColumnType[];
  visibleProperties: Record<TablePropertyKey, boolean>;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEditCard: (task: Task) => void;
  onDeleteCard: (task: Task) => void;
  onDuplicateCard: (task: Task) => void;
  onMoveCard: (taskId: string, newColumnId: string) => void;
  onUpdateCard?: (task: { id: string } & Partial<Task>) => void;
  members?: ProjectMember[];
  cycles?: Cycle[];
  projectId?: string;
  workspaceId?: string;
}) {
  const currentColumn = columns.find((columnItem) => columnItem.id === task.columnId);
  const activeProperties = TABLE_PROPERTIES.filter((propertyItem) => visibleProperties[propertyItem.key]);

  const getPriorityIcon = (priority?: Priority) => {
    switch (priority) {
      case 'urgent':
        return <PriorityUrgentIcon className="h-3.5 w-3.5 shrink-0" />;
      case 'high':
        return <PriorityHighIcon className="h-3.5 w-3.5 shrink-0" />;
      case 'medium':
        return <PriorityMediumIcon className="h-3.5 w-3.5 shrink-0" />;
      case 'low':
        return <PriorityLowIcon className="h-3.5 w-3.5 shrink-0" />;
      case 'none':
      default:
        return <PriorityNoneIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
    }
  };

  const priorityLabels: Record<string, string> = {
    none: 'None',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    urgent: 'Urgent',
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const parsedDate = new Date(dateStr);
      return parsedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const resolvedAssignee = TaskHelpers.resolveAssignee(task);
  const assigneeId = TaskHelpers.resolveAssigneeId(task);
  const memberMatch = members.find((member) => member.userId === assigneeId || member.id === assigneeId);

  const assigneeName = resolvedAssignee?.name || memberMatch?.name || null;
  const assigneeAvatar = resolvedAssignee?.avatar || memberMatch?.avatar || undefined;

  const renderCellContent = (key: TablePropertyKey) => {
    switch (key) {
      case 'state': {
        const title = currentColumn?.title || 'Backlog';

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full text-left truncate"
              >
                <StatusIcon
                  title={title}
                  group={currentColumn?.slug || title}
                  color={currentColumn?.accentColor}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className="truncate">{title}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40 text-xs py-1">
              {columns.map((columnItem) => (
                <DropdownMenuItem
                  key={columnItem.id}
                  onClick={() => columnItem.id && onMoveCard(task.id, columnItem.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <StatusIcon
                    title={columnItem.title}
                    group={columnItem.slug || columnItem.title}
                    color={columnItem.accentColor}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span>{columnItem.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      case 'priority': {
        const priorityKey = (task.priority || 'none') as Priority;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full text-left truncate"
              >
                {getPriorityIcon(priorityKey)}
                <span className="truncate">{priorityLabels[priorityKey] || 'None'}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-36 text-xs py-1">
              {(['urgent', 'high', 'medium', 'low', 'none'] as Priority[]).map((pKey) => (
                <DropdownMenuItem
                  key={pKey}
                  onClick={() => onUpdateCard?.({ id: task.id, priority: pKey })}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {getPriorityIcon(pKey)}
                  <span>{priorityLabels[pKey]}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }

      case 'assignees': {
        return (
          <div className="flex items-center gap-1.5 px-1.5 truncate">
            {assigneeName ? (
              <>
                <Avatar className="h-4 w-4 shrink-0">
                  <AvatarImage src={assigneeAvatar} />
                  <AvatarFallback className="text-9 font-medium">
                    {assigneeName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-foreground truncate">{assigneeName}</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">-</span>
            )}
          </div>
        );
      }

      case 'labels': {
        const labelList = Array.isArray(task.labels) ? task.labels : [];
        if (labelList.length === 0) {
          return <span className="text-xs text-muted-foreground px-1.5">-</span>;
        }

        return (
          <div className="flex items-center gap-1 px-1.5 overflow-hidden">
            {labelList.slice(0, 2).map((labelId) => (
              <span
                key={labelId}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-10 font-medium bg-muted text-muted-foreground border border-border truncate max-w-[80px]"
              >
                {labelId}
              </span>
            ))}
            {labelList.length > 2 && (
              <span className="text-10 text-muted-foreground font-medium">
                +{labelList.length - 2}
              </span>
            )}
          </div>
        );
      }

      case 'attach': {
        return <TableAttachCell task={task} onEditCard={onEditCard} />;
      }

      case 'cycle': {
        const currentCycle = cycles.find((cycleItem) => cycleItem.id === task.cycleId);
        return (
          <span className="text-xs text-muted-foreground px-1.5 truncate">
            {currentCycle?.name || '-'}
          </span>
        );
      }

      case 'startDate':
        return (
          <span className="text-xs text-muted-foreground px-1.5">
            {formatDate(task.startDate)}
          </span>
        );

      case 'dueDate':
        return (
          <span className="text-xs text-muted-foreground px-1.5">
            {formatDate(task.dueDate)}
          </span>
        );

      case 'createdOn':
        return (
          <span className="text-xs text-muted-foreground px-1.5">
            {formatDate((task as any).createdAt)}
          </span>
        );

      case 'createdBy':
        return (
          <span className="text-xs text-muted-foreground px-1.5 truncate">
            {(task as any).author?.name || '-'}
          </span>
        );

      case 'updatedOn':
        return (
          <span className="text-xs text-muted-foreground px-1.5">
            {formatDate((task as any).updatedAt)}
          </span>
        );

      case 'link':
        return (
          <span className="text-xs text-muted-foreground px-1.5">-</span>
        );

      case 'attachment': {
        const count = TaskHelpers.countAttachments(task.attachments);
        return (
          <span className="text-xs text-muted-foreground px-1.5">
            {count > 0 ? `${count} file${count > 1 ? 's' : ''}` : '-'}
          </span>
        );
      }

      case 'subtask':
      case 'subWorkItem': {
        const subtaskCount = (task as any).subtaskCount ?? (task.subtasks?.length || 0);
        return (
          <span className="text-xs text-muted-foreground px-1.5">
            {subtaskCount > 0 ? `${subtaskCount} subtask${subtaskCount > 1 ? 's' : ''}` : '-'}
          </span>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => onEditCard(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEditCard(task);
        }
      }}
      aria-label={`Work item: ${task.title}`}
      className={`group/row flex items-center h-9 border-b border-border hover:bg-muted transition-colors cursor-pointer w-full text-xs select-none outline-none focus-visible:ring-1 focus-visible:ring-primary ${
        isSelected ? 'bg-muted font-medium' : ''
      }`}
    >
      <div
        role="cell"
        className="relative flex items-center min-w-[320px] max-w-[500px] flex-1 px-3"
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center max-sm:opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 has-[[data-state=checked]]:opacity-100 transition-opacity duration-150"
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(task.id)}
            aria-label={isSelected ? `Deselect ${task.title}` : `Select ${task.title}`}
            className="h-3.5 w-3.5 border-border data-[state=checked]:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 pl-6 min-w-0 pr-2">
          {task.identifier && (
            <span className="text-11 font-mono text-muted-foreground shrink-0 select-none">
              {task.identifier}
            </span>
          )}
          <span
            className={`truncate font-normal ${
              task.completed
                ? 'line-through text-muted-foreground'
                : 'text-foreground'
            }`}
          >
            {task.title}
          </span>
        </div>
      </div>

      <div className="flex items-center">
        {activeProperties.map((propertyItem) => (
          <div
            key={propertyItem.key}
            role="cell"
            style={{ width: `${propertyItem.minWidth || 130}px` }}
            className="flex items-center h-9 overflow-hidden"
          >
            {renderCellContent(propertyItem.key)}
          </div>
        ))}
      </div>

      <div className="ml-auto pr-3 flex items-center opacity-0 group-hover/row:opacity-100 transition-opacity">
        <TableActionMenu
          task={task}
          projectId={projectId}
          workspaceId={workspaceId}
          onEditCard={onEditCard}
          onDuplicateCard={onDuplicateCard}
          onDeleteCard={onDeleteCard}
        />
      </div>
    </div>
  );
}

// ── 10. Main TableView Component ─────────────────────────────────────────────

export function TableView({
  tasks,
  columns,
  projectId = '',
  workspaceId = '',
  cycles = [],
  members = [],
  onAddCard,
  onEditCard,
  onDeleteCard,
  onDuplicateCard,
  onMoveCard,
  onUpdateCard,
  isReadOnly,
  selectedTaskIds: propSelectedTaskIds,
  onToggleSelectTask: propOnToggleSelectTask,
  onSelectAllTasks: propOnSelectAllTasks,
}: TableViewProps) {
  const [visibleProperties, setVisibleProperties] = useState<Record<TablePropertyKey, boolean>>(
    DEFAULT_VISIBLE_PROPERTIES
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TABLE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setVisibleProperties((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleToggleProperty = (key: TablePropertyKey) => {
    setVisibleProperties((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage errors
      }
      return updated;
    });
  };

  const handleResetProperties = () => {
    setVisibleProperties(DEFAULT_VISIBLE_PROPERTIES);
    try {
      localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(DEFAULT_VISIBLE_PROPERTIES));
    } catch {
      // Ignore localStorage errors
    }
  };

  const [localSelectedTaskIds, setLocalSelectedTaskIds] = useState<string[]>([]);
  const selectedTaskIds = propSelectedTaskIds ?? localSelectedTaskIds;

  const handleToggleSelect = (id: string) => {
    if (propOnToggleSelectTask) {
      propOnToggleSelectTask(id);
    } else {
      setLocalSelectedTaskIds((prev) =>
        prev.includes(id) ? prev.filter((taskId) => taskId !== id) : [...prev, id]
      );
    }
  };

  const handleSelectAll = () => {
    const allIds = tasks.map((task) => task.id);
    const isAllSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

    if (propOnSelectAllTasks) {
      propOnSelectAllTasks(isAllSelected ? [] : allIds);
    } else {
      setLocalSelectedTaskIds(isAllSelected ? [] : allIds);
    }
  };

  const [sortField, setSortField] = useState<TableSortField>('identifier');
  const [sortOrder, setSortOrder] = useState<TableSortOrder>('asc');

  const handleSort = (field: TableSortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedTasks = useMemo(() => {
    const list = [...tasks];
    list.sort((taskA, taskB) => {
      let comparison = 0;

      switch (sortField) {
        case 'identifier': {
          const numA = (taskA as any).sequenceNumber || 0;
          const numB = (taskB as any).sequenceNumber || 0;
          comparison = numA - numB;
          break;
        }
        case 'title':
          comparison = (taskA.title || '').localeCompare(taskB.title || '');
          break;
        case 'dueDate': {
          const timeA = taskA.dueDate ? new Date(taskA.dueDate).getTime() : 0;
          const timeB = taskB.dueDate ? new Date(taskB.dueDate).getTime() : 0;
          comparison = timeA - timeB;
          break;
        }
        case 'startDate': {
          const timeA = taskA.startDate ? new Date(taskA.startDate).getTime() : 0;
          const timeB = taskB.startDate ? new Date(taskB.startDate).getTime() : 0;
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
          const weightA = weights[taskA.priority || 'none'] || 0;
          const weightB = weights[taskB.priority || 'none'] || 0;
          comparison = weightA - weightB;
          break;
        }
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return list;
  }, [tasks, sortField, sortOrder]);

  const isAllSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;
  const isSomeSelected = selectedTaskIds.length > 0 && selectedTaskIds.length < tasks.length;

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden bg-background">
      <div className="flex-1 overflow-auto">
        <div role="table" aria-label="Work items table" className="min-w-max">
          <div role="rowgroup">
            <TableHeader
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

          {sortedTasks.length === 0 ? (
            <div className="py-16 text-center text-xs text-muted-foreground select-none">
              No work items found
            </div>
          ) : (
            <div role="rowgroup" className="flex flex-col">
              {sortedTasks.map((task) => (
                <TableRow
                  key={task.id}
                  task={task}
                  columns={columns}
                  visibleProperties={visibleProperties}
                  isSelected={selectedTaskIds.includes(task.id)}
                  onToggleSelect={handleToggleSelect}
                  onEditCard={onEditCard}
                  onDeleteCard={onDeleteCard}
                  onDuplicateCard={onDuplicateCard}
                  onMoveCard={onMoveCard}
                  onUpdateCard={onUpdateCard}
                  members={members}
                  cycles={cycles}
                  projectId={projectId}
                  workspaceId={workspaceId}
                />
              ))}
            </div>
          )}

          {!isReadOnly && (
            <TableQuickAddRow
              columns={columns}
              onAddCard={onAddCard}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default TableView;
