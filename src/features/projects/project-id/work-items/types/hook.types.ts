import type {
  Item,
  Column,
  ProjectMember,
  Label,
  DisplayOptions,
  GroupByOption,
  SubGroupByOption,
} from './work-item.types';

export interface UseWorkItemGroupingOptions {
  items: Item[];
  columns: Column[];
  members?: ProjectMember[];
  labels?: Label[];
  displayOptions: DisplayOptions;
  groupBy?: GroupByOption;
  subGroupBy?: SubGroupByOption;
}

export interface UseWorkItemSelectionOptions {
  initialSelectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  items?: Item[];
}

export interface UseRealtimeWorkItemsOptions {
  projectId?: string;
  enabled?: boolean;
  onWorkItemCreated?: (item: Item) => void;
  onWorkItemUpdated?: (item: Item) => void;
  onWorkItemDeleted?: (itemId: string) => void;
  onStateReordered?: () => void;
}

export interface UseProjectOptions {
  projectId: string;
}
