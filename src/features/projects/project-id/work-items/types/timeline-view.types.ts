import type {
  Item,
  Column as ColumnType,
  ProjectMember,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
} from './work-item.types';

export type TimelineZoom = 'week' | 'month' | 'quarter';

export interface TimelineColumn {
  id: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isWeekend?: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  width: number;
}

export interface TimelineTier1Group {
  id: string;
  label: string;
  subLabel?: string;
  isCurrent?: boolean;
  startIndex: number;
  spanCount: number;
  width: number;
}

export interface TimelineBarData {
  item: Item;
  hasDates: boolean;
  pixelLeft: number;
  pixelWidth: number;
  durationDays: number;
  durationLabel: string;
  effectiveStart?: Date;
  effectiveDue?: Date;
}

export type DepLineType = 'FS' | 'SS' | 'FF';

export interface DependencyLine {
  fromItemId: string;
  toItemId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: DepLineType;
  violated: boolean;
  isCritical?: boolean;
}

export interface TimelineViewProps extends BaseWorkItemViewProps, WorkItemCardHandlers {
  items?: Item[];
  columns: ColumnType[];
  projectStates?: ColumnType[];
  projectId?: string;
  members?: ProjectMember[];
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  isReadOnly?: boolean;
}
