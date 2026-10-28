import type React from 'react';
import {
  Users,
  Tag,
  Paperclip,
  CalendarClock,
  Calendar,
  User,
  Link2,
  Layers,
} from 'lucide-react';
import {
  StatusIcon,
  MediumPriorityBoxIcon,
} from '@/shared/components/icons';
import type {
  Item,
  Column,
  ProjectMember,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
  DisplayPropertyKey,
} from './work-item.types';

export type { DisplayPropertyKey };

// ── Table Property Keys ──────────────────────────────────────────────────────

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
  columns: Column[];
  projectStates?: Column[];
  projectId?: string;
  members?: ProjectMember[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: ((ids?: string[]) => void) | (() => void);
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  onToggleDisplayProperty?: (key: DisplayPropertyKey, value: boolean) => void;
}

export interface TableColumnPropertiesPopoverProps {
  visibleProperties: Record<TablePropertyKey, boolean>;
  onToggleProperty: (key: TablePropertyKey) => void;
  compact?: boolean;
}

// ── Table Constants ──────────────────────────────────────────────────────────

export const TABLE_STORAGE_KEY = 'flux:table_view:columns_v5';
export const TABLE_WIDTHS_STORAGE_KEY = 'flux:table_view:column_widths_v4';

export const TABLE_PROPERTIES: TablePropertyConfig[] = [
  { key: 'state', label: 'State', icon: StatusIcon, defaultVisible: true, minWidth: 140 },
  { key: 'priority', label: 'Priority', icon: MediumPriorityBoxIcon, defaultVisible: true, minWidth: 110 },
  { key: 'assignees', label: 'Assignees', icon: Users, defaultVisible: true, minWidth: 145 },
  { key: 'startDate', label: 'Start date', icon: CalendarClock, defaultVisible: false, minWidth: 135 },
  { key: 'dueDate', label: 'Due date', icon: Calendar, defaultVisible: true, minWidth: 135 },
  { key: 'labels', label: 'Labels', icon: Tag, defaultVisible: true, minWidth: 190 },
  { key: 'subItemCount', label: 'Sub-items', icon: Layers, defaultVisible: false, minWidth: 115 },
  { key: 'attachment', label: 'Attachments', icon: Paperclip, defaultVisible: false, minWidth: 115 },
  { key: 'link', label: 'Links', icon: Link2, defaultVisible: false, minWidth: 100 },
  { key: 'createdOn', label: 'Created on', icon: Calendar, defaultVisible: false, minWidth: 135 },
  { key: 'createdBy', label: 'Created by', icon: User, defaultVisible: false, minWidth: 135 },
  { key: 'updatedOn', label: 'Updated on', icon: Calendar, defaultVisible: false, minWidth: 135 },
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
  title: 380,
  state: 140,
  priority: 110,
  assignees: 145,
  startDate: 135,
  dueDate: 135,
  labels: 190,
  subItemCount: 115,
  attachment: 115,
  link: 100,
  createdOn: 135,
  createdBy: 135,
  updatedOn: 135,
};
