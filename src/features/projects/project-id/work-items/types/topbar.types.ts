import type React from 'react';
import type {
  Item,
  Column,
  ViewMode,
  DisplayOptions,
  FilterState,
  ProjectMember,
  Priority,
  DueDateFilterOption,
  DisplayPropertyKey,
  Filters,
} from './work-item.types';

export type { ViewMode, FilterState };

export type AssigneeFilterOption = {
  id: string;
  name: string;
  avatar?: string;
};

export interface UseTopbarOptions {
  items?: Item[];
  workItems?: Item[];
  columns?: Column[];
  selectedColumnIds?: string[];
  onColumnFilterChange?: (colIds: string[]) => void;
  assignees?: AssigneeFilterOption[];
  members?: ProjectMember[];
  selectedAssigneeIds?: string[];
  onAssigneeFilterChange?: (userIds: string[]) => void;
  initialViewMode?: ViewMode;
  initialFilters?: FilterState | Record<string, unknown>;
  projectId?: string;
  isReadOnly?: boolean;
}

export interface TopbarProps {
  projectId?: string;
  project?: {
    id?: string;
    name: string;
    avatar?: string | null;
    modules?: string[];
  };
  projectModules?: string[];
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  Icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  items?: Item[];
  // View controls
  viewMode: ViewMode;
  onViewChange?: (mode: ViewMode) => void;
  onViewModeChange?: (mode: ViewMode) => void;
  // Search & Filters
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  columns?: Column[];
  selectedColumnIds?: string[];
  onColumnFilterChange?: (colIds: string[]) => void;
  onToggleColumn?: (colId: string) => void;
  assignees?: AssigneeFilterOption[];
  members?: ProjectMember[];
  selectedAssigneeIds?: string[];
  onAssigneeFilterChange?: (userIds: string[]) => void;
  onToggleAssignee?: (userId: string) => void;
  selectedPriorities?: Priority[];
  onTogglePriority?: (priority: Priority) => void;
  dueDateFilter?: DueDateFilterOption;
  onDueDateFilterChange?: (opt: DueDateFilterOption) => void;
  onClearAllFilters?: () => void;
  totalActiveFilters?: number;
  filters?: Filters | FilterState;
  onFilterChange?: (filters: FilterState) => void;
  onResetFilters?: () => void;
  filterCounts?: number;
  hasActiveFilters?: boolean;
  onToggleFilter?: <K extends keyof Filters>(key: K, item: Filters[K] extends (infer E)[] ? E : string) => void;
  onRemoveFilter?: <K extends keyof Filters>(key: K, item?: Filters[K] extends (infer E)[] ? E : string) => void;
  // Display Options
  displayOptions?: DisplayOptions;
  onDisplayOptionsChange?: (options: DisplayOptions) => void;
  onPropertyToggle?: (key: DisplayPropertyKey, value: boolean) => void;
  displayOpen?: boolean;
  onDisplayOpenChange?: (open: boolean) => void;
  onUpdateDisplayOption?: <K extends keyof DisplayOptions>(
    key: K,
    value: DisplayOptions[K]
  ) => void;
  // Analytics drawer
  onOpenAnalytics?: () => void;
  // Actions
  onAddItem?: () => void;
  onAddCard?: (columnId?: string) => void;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  className?: string;
}
