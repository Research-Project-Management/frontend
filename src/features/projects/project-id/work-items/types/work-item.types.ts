import { z } from "zod";

// ── 1. Zod Domain Schemas ────────────────────────────────────────────────────

export const prioritySchema = z.enum([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);
export const workItemPrioritySchema = prioritySchema;

// Relations
export const relationTypeSchema = z.enum([
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate_of",
]);
export const workItemRelationTypeSchema = relationTypeSchema;

export const addRelationDtoSchema = z.object({
  targetWorkItemId: z.string().min(1, "Target work item ID is required"),
  type: relationTypeSchema,
});
export type AddRelationDtoInput = z.infer<typeof addRelationDtoSchema>;

export const relationSchema = z.object({
  id: z.string(),
  type: relationTypeSchema,
  targetId: z.string().optional(),
  targetWorkItemId: z.string().optional(),
  targetTitle: z.string().optional(),
  targetIdentifier: z.string().optional(),
  targetColumnId: z.string().optional(),
  targetWorkItem: z
    .object({
      id: z.string().optional(),
      title: z.string().optional(),
      identifier: z.string().optional(),
      columnId: z.string().optional(),
    })
    .nullable()
    .optional(),
});

// State Groups
export const stateGroupSchema = z.enum([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);

// Minimal Entities
export const userMinimalSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export const parentItemMinimalSchema = z.object({
  id: z.string(),
  title: z.string(),
  identifier: z.string().nullable().optional(),
});
export const parentWorkItemMinimalSchema = parentItemMinimalSchema;

export const subItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  identifier: z.string().nullable().optional(),
  columnId: z.string().default("backlog"),
  completed: z.boolean().default(false),
  stateGroup: stateGroupSchema.optional(),
  state: z
    .object({
      id: z.string(),
      name: z.string(),
      group: stateGroupSchema.optional(),
      color: z.string().optional(),
    })
    .nullable()
    .optional(),
  rank: z.number().default(0),
  assigneeId: z.string().nullable().optional(),
  assignee: userMinimalSchema.nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

// Attach Center Schemas (Pages, Papers, Files, Links)
export const attachPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().nullable().optional(),
  addedAt: z.string().optional(),
});

export const attachPaperSchema = z.object({
  id: z.string(),
  title: z.string(),
  doi: z.string().nullable().optional(),
  citationKey: z.string().nullable().optional(),
  addedAt: z.string().optional(),
});

export const attachFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  size: z.union([z.number(), z.string()]).nullable().optional(),
  type: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  uploadedAt: z.string().optional(),
});

export const attachLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  addedAt: z.string().optional(),
});

export const attachmentsSchema = z.object({
  pages: z.array(attachPageSchema).optional(),
  papers: z.array(attachPaperSchema).optional(),
  files: z.array(attachFileSchema).optional(),
  links: z.array(attachLinkSchema).optional(),
});
export const itemAttachmentsSchema = attachmentsSchema;
export const workItemAttachmentsSchema = attachmentsSchema;

export const attachmentSchema = attachFileSchema;
export const itemAttachmentSchema = attachmentSchema;
export const workItemAttachmentSchema = attachmentSchema;

export const attachPageInputSchema = z.object({
  pageId: z.string().min(1, "Page ID is required"),
  title: z.string().optional(),
});

export const attachPaperInputSchema = z.object({
  paperId: z.string().min(1, "Paper ID is required"),
  title: z.string().optional(),
  doi: z.string().optional(),
  citationKey: z.string().optional(),
});

export const attachFileInputSchema = z.object({
  name: z.string().min(1, "File name is required"),
  url: z.string().url("Must be a valid URL"),
  size: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
});

export const attachLinkInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Must be a valid URL"),
});

// Create / Update / Reorder / Bulk DTO Schemas
export const createWorkItemDtoSchema = z.object({
  title: z.string().trim().min(1, "WorkItem title is required"),
  content: z.string().optional(),
  description: z.string().optional(),
  columnId: z.string().optional(),
  projectId: z.string().optional(),
  assignee: z.union([z.string(), userMinimalSchema]).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: workItemPrioritySchema.optional(),
  rank: z.number().optional(),
  parentId: z.string().nullable().optional(),
  parentWorkItemId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  labels: z
    .array(
      z.union([
        z.string(),
        z
          .object({
            id: z.string(),
            name: z.string().optional(),
            color: z.string().optional(),
          })
          .passthrough(),
      ]),
    )
    .optional(),
  labelIds: z.array(z.string()).optional(),
  timeSpent: z.number().nullable().optional(),
  completed: z.boolean().optional(),
  attachments: attachmentsSchema.optional(),
  relations: z.array(relationSchema).optional(),
});
export const createItemSchema = createWorkItemDtoSchema;
export const createWorkItemSchema = createWorkItemDtoSchema;
export type CreateWorkItemDtoInput = z.infer<typeof createWorkItemDtoSchema>;

export const updateWorkItemDtoSchema = createWorkItemDtoSchema.partial();
export const updateItemSchema = updateWorkItemDtoSchema;
export const updateWorkItemSchema = updateWorkItemDtoSchema;
export const itemMutationInputSchema = updateWorkItemDtoSchema;
export const workItemMutationInputSchema = updateWorkItemDtoSchema;
export type UpdateWorkItemDtoInput = z.infer<typeof updateWorkItemDtoSchema>;

export const queryWorkItemDtoSchema = z.object({
  search: z.string().optional(),
  priority: workItemPrioritySchema.optional(),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});
export type QueryWorkItemDtoInput = z.infer<typeof queryWorkItemDtoSchema>;

export const reorderWorkItemDtoSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  workItemId: z.string().optional(),
  columnId: z.string().optional(),
  rank: z.number(),
  projectId: z.string().optional(),
});
export const reorderWorkItemSchema = reorderWorkItemDtoSchema;
export const reorderItemSchema = reorderWorkItemDtoSchema;
export type ReorderWorkItemDtoInput = z.infer<typeof reorderWorkItemDtoSchema>;

export const bulkUpdateWorkItemDtoSchema = z.object({
  ids: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  workItemIds: z.array(z.string()).optional(),
  data: updateWorkItemDtoSchema.extend({
    addLabel: z.string().optional(),
    removeLabel: z.string().optional(),
    clearLabels: z.boolean().optional(),
  }),
  projectId: z.string().optional(),
});
export const bulkUpdateWorkItemSchema = bulkUpdateWorkItemDtoSchema;
export const bulkUpdateItemSchema = bulkUpdateWorkItemDtoSchema;
export type BulkUpdateWorkItemDtoInput = z.infer<typeof bulkUpdateWorkItemDtoSchema>;

export const bulkDeleteWorkItemDtoSchema = z.object({
  ids: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  workItemIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
});
export const bulkDeleteWorkItemSchema = bulkDeleteWorkItemDtoSchema;
export const bulkDeleteItemSchema = bulkDeleteWorkItemDtoSchema;
export type BulkDeleteWorkItemDtoInput = z.infer<typeof bulkDeleteWorkItemDtoSchema>;

export const duplicateWorkItemDtoSchema = z.object({
  destinationProjectId: z.string().optional(),
  projectId: z.string().optional(),
});
export type DuplicateWorkItemDtoInput = z.infer<typeof duplicateWorkItemDtoSchema>;

export const createSubItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: workItemPrioritySchema.optional(),
});
export const createSubWorkItemSchema = createSubItemSchema;

// Main Item Schema
export const itemSchema = z.object({
  id: z.string(),
  identifier: z.string().nullable().optional(),
  sequenceNumber: z.number().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  content: z.string().default(""),
  description: z.string().default(""),
  columnId: z.string(),
  priority: workItemPrioritySchema.default("none"),
  relations: z.array(relationSchema).default([]),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labels: z
    .array(
      z.union([
        z.string(),
        z.object({
          id: z.string(),
          name: z.string().optional(),
          color: z.string().optional(),
        }).passthrough(),
      ]),
    )
    .default([]),
  attachments: attachmentsSchema.default({
    pages: [],
    papers: [],
    files: [],
    links: [],
  }),
  completed: z.boolean().default(false),
  stateGroup: stateGroupSchema.optional(),
  state: z
    .object({
      id: z.string(),
      name: z.string(),
      group: stateGroupSchema,
      color: z.string().optional(),
    })
    .nullable()
    .optional(),
  progressPercentage: z.number().optional(),
  rank: z.number().default(0),
  timeSpent: z.number().nullable().optional(),
  projectId: z.string(),
  authorId: z.string().optional(),
  author: userMinimalSchema.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assignee: userMinimalSchema.nullable().optional(),
  assigneeIds: z.array(z.string()).default([]),
  assignees: z.array(userMinimalSchema).default([]),
  subscriberIds: z.array(z.string()).default([]),
  parentId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  parentWorkItemId: z.string().nullable().optional(),
  parentItem: parentItemMinimalSchema.nullable().optional(),
  parentWorkItem: parentWorkItemMinimalSchema.nullable().optional(),
  subItems: z.array(subItemSchema).default([]),
  childWorkItems: z.array(subItemSchema).default([]),
  subItemCount: z.number().optional(),
  childWorkItemCount: z.number().optional(),
  subItemCompletedCount: z.number().optional(),
  childWorkItemCompletedCount: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const workItemSchema = itemSchema;

// State Schema
export const stateSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().optional(),
  slug: z.string().optional(),
  color: z.string(),
  accentColor: z.string().optional(),
  icon: z.string().optional(),
  group: stateGroupSchema,
  sequence: z.number().default(0),
  isDefault: z.boolean().default(false),
  description: z.string().nullable().optional(),
});

// Filters Schema
export const filtersSchema = z.object({
  search: z.string().default(""),
  state: z.array(z.string()).default([]),
  state_group: z.array(z.string()).default([]),
  priority: z.array(workItemPrioritySchema).default([]),
  assignees: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]),
  created_by: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  attach: z.array(z.string()).default([]),
  items: z.array(z.string()).default([]),
  work_items: z.array(z.string()).default([]),
  parent: z.array(z.string()).default([]),
  due_date: z.array(z.string()).default([]),
  start_date: z.array(z.string()).default([]),
  created_at: z.array(z.string()).default([]),
  updated_at: z.array(z.string()).default([]),
  subscribers: z.array(z.string()).default([]),
  columnId: z.union([z.string(), z.array(z.string())]).optional(),
  assigneeId: z.union([z.string(), z.array(z.string())]).optional(),
  dueDateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  hasAttachment: z.boolean().optional(),
});
export const workItemFiltersSchema = filtersSchema;

// ── 1. Branded Identifier Types (Matt Pocock Pattern) ─────────────────────────

declare const __brand: unique symbol;
export type Brand<B> = { readonly [__brand]: B };

export type ItemId = string & Brand<'ItemId'>;
export type WorkItemId = ItemId;
export type ColumnId = string & Brand<'ColumnId'>;
export type ProjectId = string & Brand<'ProjectId'>;

// ── 2. Domain Types Inferred from Zod Schemas ───────────────────────────────

export type Priority = z.infer<typeof prioritySchema>;
export type ItemPriority = Priority;
export type WorkItemPriority = Priority;

export type RelationType = z.infer<typeof relationTypeSchema>;
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
export type ParentItemMinimal = z.infer<typeof parentItemMinimalSchema>;

export type SubItem = z.infer<typeof subItemSchema>;
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
  identifier?: string;
  name: string;
  description?: string;
  avatar?: string | null;
  color?: string | null;
  status?: string;
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
  columns?: Column[];
  states?: Column[];
  projectName?: string;
  total?: number;
};
export type ProjectWorkItemsData = ProjectItemsData;

export interface WorkItemCardHandlers {
  onEditCard: (card: Item) => void;
  onDeleteCard: (card: Item) => void;
  onDuplicateCard: (card: Item) => void;
  onJoinCard: (card: Item) => void;
  onLeaveCard: (card: Item) => void;
  onMoveCard: (workItemId: string, newColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onUpdateCard?: (card: { id: string } & Partial<Item>) => void;
  onUpdateItem?: (id: string, data: Partial<Item>) => void;
  onUpdateWorkItem?: (id: string, data: Partial<Item>) => void;
}

export interface BaseWorkItemViewProps {
  columns?: Column[];
  displayOptions?: DisplayOptions;
  currentUserId?: string | null;
  currentUserAvatar?: string;
  isReadOnly?: boolean;
  members?: ProjectMember[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
}

// ── 4. UI Modes & States ─────────────────────────────────────────────────────

export type ViewMode = "board" | "list" | "calendar" | "table" | "timeline" | "split";
export type ItemDetailDisplayMode = "side-peek" | "center" | "fullscreen";

export type FilterState = WorkItemFilters;

export type ModalState =
  | { type: 'idle'; mode?: 'idle' }
  | { type: 'create'; mode?: 'create'; initialData?: Partial<Item>; columnId?: string; title?: string }
  | { type: 'detail'; mode?: 'edit' | 'detail'; card: Item; item?: Item; workItem?: Item }
  | { type: 'delete'; mode?: 'delete'; item: Item; workItem?: Item };

// ── 5. Standard Domain Configurations ────────────────────────────────────────

export const RELATION_TYPE_CONFIG: Record<
  WorkItemRelationType,
  { label: string; description: string; badgeColor: string }
> = {
  blocks: {
    label: "Blocks",
    description: "This issue blocks the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  blocked_by: {
    label: "Blocked by",
    description: "This issue is blocked by the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  relates_to: {
    label: "Relates to",
    description: "This issue is related to the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  duplicate_of: {
    label: "Duplicate of",
    description: "This issue is a duplicate of the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
};

export const PRIORITY_THEME_COLORS: Record<Priority, string> = {
  urgent: "#CF222E",
  high: "#D97706",
  medium: "#9A6700",
  low: "#6E6E6E",
  none: "#9CA3AF",
} as const;

export const GROUP_DEFAULT_COLORS = {
  assignee: "#0969DA",
  label: "#0969DA",
  createdBy: "#8250DF",
  all: "#0969DA",
  unassigned: "#9CA3AF",
  noLabel: "#9CA3AF",
  unknown: "#9CA3AF",
} as const;

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
    defaultColor: "#6B7280",
    description: "Unprioritized items awaiting scheduling",
  },
  unstarted: {
    label: "To Do",
    defaultColor: "#94A3B8",
    description: "Prioritized items ready to be worked on",
  },
  started: {
    label: "In Progress",
    defaultColor: "#D97706",
    description: "Items actively being worked on",
  },
  completed: {
    label: "Done",
    defaultColor: "#1A7F37",
    description: "Finished and accepted items",
  },
  cancelled: {
    label: "Cancelled",
    defaultColor: "#9CA3AF",
    description: "Abandoned, duplicate, or rejected items",
  },
};

export const DEFAULT_STATES: State[] = [
  {
    id: "backlog",
    name: "Backlog",
    title: "Backlog",
    group: "backlog",
    color: "#6B7280",
    accentColor: "#6B7280",
    sequence: 1000,
    isDefault: true,
    description: "Items awaiting prioritization and scheduling",
  },
  {
    id: "todo",
    name: "To Do",
    title: "To Do",
    group: "unstarted",
    color: "#94A3B8",
    accentColor: "#94A3B8",
    sequence: 2000,
    isDefault: false,
    description: "Items ready to be worked on",
  },
  {
    id: "in_progress",
    name: "In Progress",
    title: "In Progress",
    group: "started",
    color: "#D97706",
    accentColor: "#D97706",
    sequence: 3000,
    isDefault: false,
    description: "Items actively being worked on by assignees",
  },
  {
    id: "done",
    name: "Done",
    title: "Done",
    group: "completed",
    color: "#1A7F37",
    accentColor: "#1A7F37",
    sequence: 4000,
    isDefault: false,
    description: "Items completed and accepted",
  },
  {
    id: "cancelled",
    name: "Cancelled",
    title: "Cancelled",
    group: "cancelled",
    color: "#9CA3AF",
    accentColor: "#9CA3AF",
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
  | 'attach';

export type GroupByOption =
  | 'state'
  | 'priority'
  | 'attach'
  | 'labels'
  | 'assignee'
  | 'createdBy'
  | 'none';

export type SubGroupByOption =
  | 'priority'
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

// ── Re-exports from modular types ───────────────────────────────────────────
export * from './list-view.types';
export * from './table-view.types';
export * from './kanban-view.types';
export * from './timeline-view.types';
export * from './calendar-view.types';
export * from './attachment.types';
export * from './modal.types';
export * from './picker.types';
export * from './layout.types';
export * from './topbar.types';
export * from './hook.types';
export * from './cpm.types';
export * from './filter.types';
export * from './activity.types';
