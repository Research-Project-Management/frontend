import type { Item, Column } from './work-item.types';

export type CalendarLayoutMode = 'month' | 'week';

export interface CalendarViewProps {
  items?: Item[];
  columns: Column[];
  projectId?: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onOpenCardDetail: (item: Item) => void;
  onAssignExistingItems?: (itemIds: string[], dueDate: string) => void;
  onDateChange?: (item: Item, dueDate: string) => void;
  isReadOnly?: boolean;
}
