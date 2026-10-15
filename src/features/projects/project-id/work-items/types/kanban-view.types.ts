import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import type {
  Item,
  Column,
  ProjectMember,
  DisplayOptions,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
} from './work-item.types';

export type ItemCardLabel = {
  id: string;
  name: string;
  color?: string;
};

export type CardMetadataItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  text: string;
};

export interface UseKanbanOptions {
  items?: Item[];
  workItems?: Item[];
  columns: Column[];
  onMoveCard?: (cardId: string, targetColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onReorderCard?: (workItemId: string, targetColumnId: string, rank: number) => void;
  isReadOnly?: boolean;
  subGroupBy?: string;
  groupBy?: string;
  itemsByColumnId?: Map<string, Item[]>;
}

export interface UseCardOptions {
  card: Item;
  isReadOnly?: boolean;
  columns?: Column[];
  onMoveCard?: (cardId: string, newColumnId: string) => void;
  labelMap?: Map<string, ItemCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  onEdit?: (card: Item) => void;
  onDuplicate?: (card: Item) => void;
  onDelete?: (card: Item) => void;
  onJoin?: (card: Item) => void;
  onLeave?: (card: Item) => void;
}

export interface SwimlaneDef {
  id: string;
  title: string;
  color?: string;
  icon?: React.ReactNode;
}

export interface CardProps {
  card: Item;
  columns?: Column[];
  projectStates?: Column[];
  displayOptions?: DisplayOptions;
  labelMap?: Map<string, ItemCardLabel>;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  members?: ProjectMember[];
  onEdit?: (card: Item) => void;
  onDuplicate?: (card: Item) => void;
  onDelete?: (card: Item) => void;
  onJoin?: (card: Item) => void;
  onLeave?: (card: Item) => void;
  onMoveCard?: (cardId: string, newColumnId: string) => void;
  onUpdateItem?: (cardId: string, data: Partial<Item>) => void;
  isReadOnly?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (itemId: string) => void;
}

export interface ColumnProps extends BaseWorkItemViewProps, Partial<WorkItemCardHandlers> {
  column: Column;
  cards: Item[];
  columns?: Column[];
  projectStates?: Column[];
  droppableId?: string;
  laneId?: string;
  subGroupBy?: string;
  labelMap?: Map<string, ItemCardLabel>;
  onAddCard?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onUpdateItem?: (itemId: string, data: Partial<Item>) => void;
}

export interface BoardViewProps extends BaseWorkItemViewProps, Partial<WorkItemCardHandlers> {
  items?: Item[];
  itemsByColumnId?: Map<string, Item[]>;
  columns: Column[];
  projectStates?: Column[];
  labelMap?: Map<string, ItemCardLabel>;
  onAddCard?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onMoveCard?: (itemId: string, newColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onReorderCard?: (itemId: string, newColumnId: string, rank: number) => void;
  onUpdateItem?: (itemId: string, data: Partial<Item>) => void;
}

export type BoardProps = BoardViewProps;
