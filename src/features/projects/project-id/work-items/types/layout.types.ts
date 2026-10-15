import type React from 'react';
import type {
  Column,
  Priority,
  ProjectMember,
  Project,
  Item,
  ViewMode,
  DisplayOptions,
  FilterState,
  Filters,
  DueDateFilterOption,
  Label,
  ItemMutationInput,
  DisplayPropertyKey,
} from './work-item.types';
import type { AssigneeFilterOption } from './topbar.types';

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

export interface DisplayPopoverProps {
  displayOptions: DisplayOptions;
  onDisplayOptionsChange?: (options: DisplayOptions) => void;
  onPropertyToggle?: (key: DisplayPropertyKey, value: boolean) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUpdateOption?: <K extends keyof DisplayOptions>(
    key: K,
    value: DisplayOptions[K]
  ) => void;
  viewMode?: ViewMode;
  columns?: Column[];
  compact?: boolean;
  onResetOptions?: () => void;
}

export interface WorkItemViewContainerProps {
  viewMode: string;
  isArchivedEmpty: boolean;
  isProjectEmpty: boolean;
  onDisableArchived: () => void;
  onCreateItemFromEmpty: () => void;
  isReadOnly?: boolean;
  projectId: string;
  activeFilteredItems: Item[];
  itemsByColumnId: Map<string, Item[]>;
  visibleColumns: Column[];
  columns: Column[];
  displayOptions: DisplayOptions;
  currentUserId?: string | null;
  members: ProjectMember[];
  labelMap?: Map<string, { id: string; name: string; color?: string }>;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: ((ids?: string[]) => void) | (() => void);
  onOpenAddDialog: (
    columnIdOrOptions: string | { columnId?: string; title?: string; dueDate?: string; lane?: { subGroupBy?: string; laneId?: string } },
    titleArg?: string,
    extraArg?: string | { subGroupBy?: string; laneId?: string }
  ) => void;
  onOpenEditDialog: (card: Item) => void;
  onDeleteCard: (card: Item) => void;
  onDuplicateCard: (card: Item) => void;
  onJoinCard: (card: Item) => void;
  onLeaveCard: (card: Item) => void;
  onMoveCard: (
    workItemId: string,
    newColumnId: string,
    laneData?: { subGroupBy?: string; laneId?: string }
  ) => void;
  onReorderCard: (workItemId: string, newColumnId: string, rank: number) => void;
  onQuickUpdateItem: (itemId: string, data: Partial<Item>) => void;
  onQuickUpdateItemFromCard: (item: { id: string } & Partial<Item>) => void;
  onAssignExistingItemsToDate: (
    itemIds: string[],
    dueDate: string,
    quiet?: boolean,
    startDate?: string | null
  ) => void;
  updateDisplayProperty: (property: DisplayPropertyKey, value: boolean) => void;
}

export interface AnalyticsDrawerProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  items?: Item[];
  columns?: Column[];
  members?: ProjectMember[];
  assignees?: (AssigneeFilterOption | ProjectMember)[];
  project?: Project;
  projectId?: string;
  projectName?: string;
  [key: string]: unknown;
}

export interface FilterDropdownProps {
  items?: Item[];
  columns?: Column[];
  selectedColumnIds?: string[];
  onToggleColumn?: (columnId: string) => void;
  assignees?: AssigneeFilterOption[];
  members?: ProjectMember[];
  selectedAssigneeIds?: string[];
  onToggleAssignee?: (userId: string) => void;
  selectedPriorities?: Priority[];
  onTogglePriority?: (priority: Priority) => void;
  dueDateFilter?: DueDateFilterOption;
  onDueDateFilterChange?: (option: DueDateFilterOption) => void;
  totalActiveFilters?: number;
  onClearAll?: () => void;
  filters?: Filters | FilterState;
  onFilterChange?: (filters: FilterState) => void;
  onResetFilters?: () => void;
  onToggleFilter?: <K extends keyof Filters>(key: K, item: Filters[K] extends (infer E)[] ? E : string) => void;
  onRemoveFilter?: <K extends keyof Filters>(key: K, item?: Filters[K] extends (infer E)[] ? E : string) => void;
  labels?: Label[];
  compact?: boolean;
}

export interface FilterPillsBarProps {
  columns?: Column[];
  assignees?: AssigneeFilterOption[];
  members?: ProjectMember[];
  items?: Item[];
  totalFiltersCount?: number;
  totalActiveFilters?: number;
  onClearAll?: () => void;
  filters?: Filters | FilterState;
  onFilterChange?: (filters: FilterState) => void;
  onResetFilters?: () => void;
  onRemoveFilter?: <K extends keyof Filters>(key: K, item?: Filters[K] extends (infer E)[] ? E : string) => void;
  onToggleFilter?: <K extends keyof Filters>(key: K, item: Filters[K] extends (infer E)[] ? E : string) => void;
  selectedColumnIds?: string[];
  onRemoveColumn?: (colId: string) => void;
  selectedAssigneeIds?: string[];
  onRemoveAssignee?: (userId: string) => void;
  selectedPriorities?: Priority[];
  onRemovePriority?: (priority: Priority) => void;
  dueDateFilter?: DueDateFilterOption;
  onRemoveDueDate?: () => void;
  labels?: Label[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export interface EmptyStateProps {
  viewMode?: ViewMode;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  onCreateItem?: () => void;
  isReadOnly?: boolean;
}
export type WorkItemsEmptyStateProps = EmptyStateProps;
