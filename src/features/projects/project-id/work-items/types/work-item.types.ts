import { z } from "zod";
import {
  prioritySchema,
  relationTypeSchema,
  relationSchema,
  stateGroupSchema,
  userMinimalSchema,
  cycleMinimalSchema,
  parentItemMinimalSchema,
  subItemSchema,
  attachPageSchema,
  attachPaperSchema,
  attachFileSchema,
  attachLinkSchema,
  attachmentsSchema,
  attachmentSchema,
  attachPageInputSchema,
  attachPaperInputSchema,
  attachFileInputSchema,
  attachLinkInputSchema,
  itemSchema,
  createItemSchema,
  updateItemSchema,
  itemMutationInputSchema,
  reorderItemSchema,
  bulkUpdateItemSchema,
  bulkDeleteItemSchema,
  createSubItemSchema,
  stateSchema,
  filtersSchema,
} from "../schemas/work-item.schema";

// ── 1. Branded Identifier Types (Matt Pocock Pattern) ─────────────────────────

declare const __brand: unique symbol;
export type Brand<B> = { readonly [__brand]: B };

export type ItemId = string & Brand<'ItemId'>;
export type WorkItemId = ItemId;
export type ColumnId = string & Brand<'ColumnId'>;
export type ProjectId = string & Brand<'ProjectId'>;
export type CycleId = string & Brand<'CycleId'>;

// ── 2. Domain Types Inferred from Zod Schemas ───────────────────────────────

export type Priority = z.infer<typeof prioritySchema>;
export type ItemPriority = Priority;
export type WorkItemPriority = Priority;

export type RelationType = z.infer<typeof relationTypeSchema>;
export type ItemRelationType = RelationType;
export type WorkItemRelationType = RelationType;

export type Relation = z.infer<typeof relationSchema>;
export type ItemRelation = Relation;
export type WorkItemRelation = Relation;

export type Attachment = z.infer<typeof attachmentSchema>;
export type ItemAttachment = Attachment;
export type WorkItemAttachment = Attachment;

export type AttachPageItem = z.infer<typeof attachPageSchema>;
export type AttachPaperItem = z.infer<typeof attachPaperSchema>;
export type AttachFileItem = z.infer<typeof attachFileSchema>;
export type AttachLinkItem = z.infer<typeof attachLinkSchema>;
export type Attachments = z.infer<typeof attachmentsSchema>;
export type ItemAttachments = Attachments;
export type WorkItemAttachments = Attachments;

export type UserMinimal = z.infer<typeof userMinimalSchema>;
export type CycleMinimal = z.infer<typeof cycleMinimalSchema>;
export type ParentItemMinimal = z.infer<typeof parentItemMinimalSchema>;
export type ParentWorkItemMinimal = ParentItemMinimal;

export type SubItem = z.infer<typeof subItemSchema>;
export type SubItemMinimal = SubItem;
export type ChildWorkItem = SubItem;

export type Item = z.infer<typeof itemSchema>;
export type WorkItem = Item;

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type CreateWorkItemInput = CreateItemInput;

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdateWorkItemInput = UpdateItemInput;

export type ItemMutationInput = z.infer<typeof itemMutationInputSchema>;
export type WorkItemMutationInput = ItemMutationInput;

export type ReorderItemInput = z.infer<typeof reorderItemSchema>;
export type ReorderWorkItemInput = ReorderItemInput;

export type BulkUpdateItemInput = z.infer<typeof bulkUpdateItemSchema>;
export type BulkUpdateWorkItemInput = BulkUpdateItemInput;

export type BulkDeleteItemInput = z.infer<typeof bulkDeleteItemSchema>;
export type BulkDeleteWorkItemInput = BulkDeleteItemInput;

export type CreateSubItemInput = z.infer<typeof createSubItemSchema>;
export type CreateSubWorkItemInput = CreateSubItemInput;

export type AttachPageInput = z.infer<typeof attachPageInputSchema>;
export type AttachPaperInput = z.infer<typeof attachPaperInputSchema>;
export type AttachFileInput = z.infer<typeof attachFileInputSchema>;
export type AttachLinkInput = z.infer<typeof attachLinkInputSchema>;

export type State = z.infer<typeof stateSchema>;
export type Column = State;
export type ColumnType = Column;
export type WorkItemState = State;
export type WorkItemStateSchema = State;

export type StateGroup = z.infer<typeof stateGroupSchema>;

export interface SubItemMinimalData {
  id: string;
  title: string;
  identifier?: string | null;
  columnId: string;
  completed: boolean;
  rank?: number;
  assigneeId?: string | null;
  assignee?: { id?: string; name?: string; avatar?: string } | null;
  dueDate?: string | null;
}

export type Filters = z.infer<typeof filtersSchema>;
export type WorkItemFilters = Filters;

// ── 3. Domain Entities ───────────────────────────────────────────────────────

export type CycleMilestone = {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
};

export type Cycle = {
  id: string;
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: "upcoming" | "active" | "completed" | "archived";
  projectId?: string;
  milestones?: CycleMilestone[];
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectMember = {
  id?: string;
  userId?: string;
  role?: string;
  name?: string;
  avatar?: string;
  user?: {
    id?: string;
    name?: string;
    avatar?: string;
  };
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  avatar?: string | null;
  color?: string | null;
  status?: string;
  workspaceId?: string;
  members?: ProjectMember[];
  emoji?: string | null;
  icon?: string | null;
  [key: string]: unknown;
};

export type ActivityLog = {
  id: string;
  itemId?: string;
  workItemId?: string;
  action?: string;
  message?: string;
  type?: string;
  user?: {
    id?: string;
    name?: string;
    avatar?: string;
  } | null;
  author?: {
    id?: string;
    name?: string;
    avatar?: string;
  } | string | null;
  authorInitials?: string;
  avatarUrl?: string | null;
  content?: string;
  timestamp?: string;
  createdAt?: number | string;
  kind?: "comment" | "system" | "activity";
  reactions?: Record<string, string[]> | Array<{ emoji?: string } | string> | null;
  reactionEmoji?: string;
  metadata?: Record<string, unknown>;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
  };
};
export type ItemActivityLog = ActivityLog;
export type WorkItemActivityLog = ActivityLog;

export type ProjectItemsData = {
  items?: Item[];
  workItems?: Item[];
  columns: Column[];
  states?: Column[];
  projectName?: string;
  cycles?: Cycle[];
};
export type ProjectWorkItemsData = ProjectItemsData;

export interface WorkItemCardHandlers {
  onEditCard: (card: any) => void;
  onDeleteCard: (card: any) => void;
  onDuplicateCard: (card: any) => void;
  onJoinCard: (card: any) => void;
  onLeaveCard: (card: any) => void;
  onRemoveFromCycle?: (card: any) => void;
  onMoveCard: (workItemId: string, newColumnId: string, laneData?: any) => void;
  onUpdateCard?: (card: any) => void;
  onUpdateItem?: (id: string, data: any) => void;
  onUpdateWorkItem?: (id: string, data: any) => void;
}

export interface BaseWorkItemViewProps {
  columns?: Column[];
  displayOptions?: DisplayOptions;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  isReadOnly?: boolean;
  members?: ProjectMember[] | any[];
  cycles?: Cycle[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
}

// ── 4. UI Modes & States ─────────────────────────────────────────────────────

export type ViewMode = "board" | "list" | "calendar" | "table" | "timeline" | "split";
export type ItemViewMode = ViewMode;
export type WorkItemViewMode = ViewMode;
export type ItemDetailDisplayMode = "side-peek" | "center" | "fullscreen";

export type ModalState =
  | { mode: "idle" }
  | { mode: "create"; columnId?: string; title?: string }
  | { mode: "edit"; item: Item; workItem?: Item }
  | { mode: "delete"; item: Item; workItem?: Item }
  | { mode: "transfer"; item: Item; workItem?: Item }
  | { mode: "add-existing" };
export type ItemModalState = ModalState;
export type WorkItemModalState = ModalState;

// ── 5. Standard Domain Configurations ────────────────────────────────────────

export const RELATION_TYPE_CONFIG: Record<
  WorkItemRelationType,
  { label: string; description: string; badgeColor: string }
> = {
  blocks: {
    label: "Blocks",
    description: "This issue blocks the other issue",
    badgeColor: "text-red-500 bg-red-500/10 border-red-500/20",
  },
  blocked_by: {
    label: "Blocked by",
    description: "This issue is blocked by the other issue",
    badgeColor: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  },
  relates_to: {
    label: "Relates to",
    description: "This issue is related to the other issue",
    badgeColor: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  duplicate_of: {
    label: "Duplicate of",
    description: "This issue is a duplicate of the other issue",
    badgeColor: "text-muted-foreground bg-muted border-border",
  },
};

export const STATE_GROUPS: readonly StateGroup[] = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
] as const;

export const STATE_GROUP_CONFIG: Record<
  StateGroup,
  { label: string; defaultColor: string; description: string }
> = {
  backlog: {
    label: "Backlog",
    defaultColor: "#8A9093",
    description: "Unprioritized items awaiting scheduling",
  },
  unstarted: {
    label: "To Do",
    defaultColor: "#525866",
    description: "Prioritized items ready for the active cycle",
  },
  started: {
    label: "In Progress",
    defaultColor: "#F59E0B",
    description: "Items actively being worked on",
  },
  completed: {
    label: "Done",
    defaultColor: "#10B981",
    description: "Finished and accepted items",
  },
  cancelled: {
    label: "Cancelled",
    defaultColor: "#EF4444",
    description: "Abandoned, duplicate, or rejected items",
  },
};

export const DEFAULT_STATES: State[] = [
  {
    id: "backlog",
    name: "Backlog",
    title: "Backlog",
    group: "backlog",
    color: "#8A9093",
    accentColor: "#8A9093",
    sequence: 1000,
    isDefault: true,
    description: "Items awaiting prioritization and scheduling",
  },
  {
    id: "todo",
    name: "To Do",
    title: "To Do",
    group: "unstarted",
    color: "#525866",
    accentColor: "#525866",
    sequence: 2000,
    isDefault: false,
    description: "Items ready to be worked on in the current cycle",
  },
  {
    id: "in_progress",
    name: "In Progress",
    title: "In Progress",
    group: "started",
    color: "#F59E0B",
    accentColor: "#F59E0B",
    sequence: 3000,
    isDefault: false,
    description: "Items actively being worked on by assignees",
  },
  {
    id: "done",
    name: "Done",
    title: "Done",
    group: "completed",
    color: "#10B981",
    accentColor: "#10B981",
    sequence: 4000,
    isDefault: false,
    description: "Items completed and accepted",
  },
  {
    id: "cancelled",
    name: "Cancelled",
    title: "Cancelled",
    group: "cancelled",
    color: "#EF4444",
    accentColor: "#EF4444",
    sequence: 5000,
    isDefault: false,
    description: "Items abandoned, duplicate, or rejected",
  },
];
export const DEFAULT_WORK_ITEM_STATES = DEFAULT_STATES;


export const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "red" },
  high: { label: "High", color: "orange" },
  medium: { label: "Medium", color: "blue" },
  low: { label: "Low", color: "gray" },
  none: { label: "None", color: "transparent" },
} as const satisfies Record<Priority, { label: string; color: string }>;

// ── 6. Display Options & Filter Configurations ───────────────────────────────

export type DisplayPropertyKey =
  | 'id'
  | 'assignee'
  | 'startDate'
  | 'dueDate'
  | 'labels'
  | 'priority'
  | 'state'
  | 'childWorkItemCount'
  | 'subWorkItemCount'
  | 'subItemCount'
  | 'attachmentCount'
  | 'attachment'
  | 'link'
  | 'dependencies'
  | 'attach'
  | 'cycle';

export type GroupByOption =
  | 'state'
  | 'priority'
  | 'cycle'
  | 'attach'
  | 'labels'
  | 'assignee'
  | 'createdBy'
  | 'none';

export type SubGroupByOption =
  | 'priority'
  | 'cycle'
  | 'attach'
  | 'labels'
  | 'assignee'
  | 'createdBy'
  | 'none';

export type OrderByOption =
  | 'manual'
  | 'title'
  | 'createdAt'
  | 'updatedAt'
  | 'startDate'
  | 'dueDate'
  | 'priority';

export type OrderDirection = 'asc' | 'desc';

export interface DisplayOptions {
  properties: Record<DisplayPropertyKey, boolean>;
  groupBy: GroupByOption;
  subGroupBy: SubGroupByOption;
  orderBy: OrderByOption;
  orderDirection: OrderDirection;
  showEmptyGroups: boolean;
  showChildWorkItems: boolean;
  showSubWorkItems?: boolean;
}
export type WorkItemDisplayOptions = DisplayOptions;

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  properties: {
    id: true,
    assignee: true,
    startDate: false,
    dueDate: false,
    labels: true,
    priority: true,
    state: true,
    childWorkItemCount: false,
    subWorkItemCount: false,
    subItemCount: false,
    attachmentCount: false,
    attachment: false,
    link: false,
    dependencies: true,
    attach: false,
    cycle: false,
  },
  groupBy: 'state',
  subGroupBy: 'none',
  orderBy: 'manual',
  orderDirection: 'asc',
  showEmptyGroups: true,
  showChildWorkItems: true,
};
export const DEFAULT_WORK_ITEM_DISPLAY_OPTIONS = DEFAULT_DISPLAY_OPTIONS;

export type DueDateFilterOption = 'all' | 'overdue' | 'this_week' | 'no_date';

export const DEFAULT_FILTERS: Filters = {
  search: '',
  state: [],
  state_group: [],
  priority: [],
  assignees: [],
  mentions: [],
  created_by: [],
  labels: [],
  cycle: [],
  attach: [],
  items: [],
  work_items: [],
  parent: [],
  due_date: [],
  start_date: [],
  created_at: [],
  updated_at: [],
  subscribers: [],
};
export const DEFAULT_WORK_ITEM_FILTERS = DEFAULT_FILTERS;

// ── Work Item Label Types (Entity only - No CRUD in work-items) ─────────────

export interface Label {
  id: string;
  name: string;
  color?: string;
  description?: string | null;
  projectId?: string;
  parentId?: string | null;
  sortOrder?: number;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type WorkItemLabel = Label;

