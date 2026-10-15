import type {
  Item,
  SubItem,
  Column,
  DisplayOptions,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
  ProjectMember,
} from './work-item.types';

export interface ItemRowProps {
  item: Item;
  columns: Column[];
  projectStates?: Column[];
  currentColumn?: Column;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEditCard: (item: Item) => void;
  onDuplicateCard: (item: Item) => void;
  onJoinCard: (item: Item) => void;
  onLeaveCard: (item: Item) => void;
  onDeleteCard: (item: Item) => void;
  onMoveCard: (itemId: string, targetColumnId: string) => void;
  onUpdateItem?: (id: string, data: Partial<Item>) => void;
  displayOptions?: DisplayOptions;
  members?: ProjectMember[];
  currentUserId?: string | null;
  isDragging?: boolean;
  isReadOnly?: boolean;
  isChildrenExpanded?: boolean;
  onToggleExpandChildren?: (itemId: string) => void;
}

export interface SortableItemRowProps extends ItemRowProps {
  onUpdateChildItem?: (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => void;
  onDeleteChildItem?: (parentItem: Item, childItemId: string, subIndex: number) => void;
  onAddChildItem?: (parentItemId: string, title: string) => void;
}

export interface ChildItemRowProps {
  childItem: SubItem;
  parentItem: Item;
  index: number;
  columns: Column[];
  projectStates?: Column[];
  members?: ProjectMember[];
  isReadOnly?: boolean;
  onEditCard: (item: Item) => void;
  onUpdateChildItem?: (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => void;
  onDeleteChildItem?: (parentItem: Item, childItemId: string, subIndex: number) => void;
}

export interface ListViewGroupProps {
  group: {
    key: string;
    label: string;
    color?: string;
    column: Column;
    items: Item[];
  };
  columns: Column[];
  projectStates?: Column[];
  isExpanded: boolean;
  onToggleExpand: (key: string) => void;
  quickAddKey: string | null;
  setQuickAddKey: (key: string | null) => void;
  onAddCard: (columnId: string, title?: string) => void;
  onEditCard: (item: Item) => void;
  onDuplicateCard: (item: Item) => void;
  onJoinCard: (item: Item) => void;
  onLeaveCard: (item: Item) => void;
  onDeleteCard: (item: Item) => void;
  onMoveCard: (itemId: string, targetColumnId: string) => void;
  onUpdateItem?: (itemId: string, data: Partial<Item>) => void;
  displayOptions?: DisplayOptions;
  members?: ProjectMember[];
  currentUserId?: string | null;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  isReadOnly?: boolean;
  projectPrefix?: string;
  expandedChildParentIds?: Set<string>;
  onToggleExpandChildren?: (itemId: string) => void;
  onUpdateChildItem?: (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => void;
  onDeleteChildItem?: (parentItem: Item, childItemId: string, subIndex: number) => void;
  onAddChildItem?: (parentItemId: string, title: string) => void;
}

export interface ListViewProps extends BaseWorkItemViewProps, WorkItemCardHandlers {
  columns: Column[];
  projectStates?: Column[];
  itemsByColumnId?: Map<string, Item[]> | Record<string, Item[]>;
  onAddCard: (columnId: string, title?: string) => void;
  onUpdateItem?: (id: string, data: Partial<Item>) => void;
  onReorderCard?: (itemId: string, newColumnId: string, rank: number) => void;
  isAddingCard?: boolean;
  projectId: string;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: ((ids?: string[]) => void) | (() => void);
  members?: ProjectMember[];
}
