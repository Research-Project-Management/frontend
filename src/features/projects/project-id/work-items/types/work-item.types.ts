import type React from "react";
import type { LucideIcon } from "lucide-react";
import { z } from "zod";

// ── 1. Zod Domain Schemas ────────────────────────────────────────────────────

export const prioritySchema = z.enum([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

// Relations
export const relationTypeSchema = z.enum([
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate_of",
  "duplicated_by",
  "starts_before",
  "starts_after",
  "finishes_before",
  "finishes_after",
  "start_to_finish",
  "finish_to_start",
  "start_to_start",
  "finish_to_finish",
  "implements",
]);

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
export const createItemSchema = z.object({
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
  priority: prioritySchema.optional(),
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


export const updateItemSchema = createItemSchema.partial();
export const itemMutationInputSchema = updateItemSchema;

export const queryWorkItemDtoSchema = z.object({
  search: z.string().optional(),
  workItems: z.union([z.string(), z.array(z.string())]).optional(),
  ids: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.union([prioritySchema, z.string(), z.array(z.string())]).optional(),
  columnId: z.union([z.string(), z.array(z.string())]).optional(),
  state: z.union([z.string(), z.array(z.string())]).optional(),
  stateGroup: z.union([z.string(), z.array(z.string())]).optional(),
  assigneeId: z.union([z.string(), z.array(z.string())]).optional(),
  assignees: z.union([z.string(), z.array(z.string())]).optional(),
  subscribers: z.union([z.string(), z.array(z.string())]).optional(),
  mentions: z.union([z.string(), z.array(z.string())]).optional(),
  labels: z.union([z.string(), z.array(z.string())]).optional(),
  attach: z.union([z.string(), z.array(z.string())]).optional(),
  createdById: z.union([z.string(), z.array(z.string())]).optional(),
  authorId: z.union([z.string(), z.array(z.string())]).optional(),
  parentWorkItemId: z.string().nullable().optional(),
  parent: z.string().nullable().optional(),
  dueDate: z.union([z.string(), z.array(z.string())]).optional(),
  startDate: z.union([z.string(), z.array(z.string())]).optional(),
  createdAt: z.union([z.string(), z.array(z.string())]).optional(),
  updatedAt: z.union([z.string(), z.array(z.string())]).optional(),
  completed: z.boolean().optional(),
  archived: z.boolean().optional(),
  orderBy: z.string().optional(),
  orderDirection: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(200).optional().default(50),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});
export type QueryWorkItemDtoInput = z.infer<typeof queryWorkItemDtoSchema>;

export const reorderItemSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  workItemId: z.string().optional(),
  columnId: z.string().optional(),
  rank: z.number(),
  projectId: z.string().optional(),
});


export const bulkUpdateItemSchema = z.object({
  ids: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  workItemIds: z.array(z.string()).optional(),
  data: updateItemSchema.extend({
    addLabel: z.string().optional(),
    removeLabel: z.string().optional(),
    clearLabels: z.boolean().optional(),
  }),
  projectId: z.string().optional(),
});


export const bulkDeleteItemSchema = z.object({
  ids: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  workItemIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
});


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
  priority: prioritySchema.optional(),
});

// Main Item Schema
export const itemSchema = z.object({
  id: z.string(),
  identifier: z.string().nullable().optional(),
  sequenceNumber: z.number().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  content: z.string().default(""),
  description: z.string().default(""),
  columnId: z.string(),
  priority: prioritySchema.default("none"),
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
  parentWorkItem: parentItemMinimalSchema.nullable().optional(),
  subItems: z.array(subItemSchema).default([]),
  childWorkItems: z.array(subItemSchema).default([]),
  subItemCount: z.number().optional(),
  childWorkItemCount: z.number().optional(),
  subItemCompletedCount: z.number().optional(),
  childWorkItemCompletedCount: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

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
  priority: z.array(prioritySchema).default([]),
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

// ── 1. Branded Identifier Types (Matt Pocock Pattern) ─────────────────────────

declare const __brand: unique symbol;
export type Brand<B> = { readonly [__brand]: B };

export type ItemId = string & Brand<'ItemId'>;
export type ColumnId = string & Brand<'ColumnId'>;
export type ProjectId = string & Brand<'ProjectId'>;

// ── 2. Domain Types Inferred from Zod Schemas ───────────────────────────────

export type Priority = z.infer<typeof prioritySchema>;

export type RelationType = z.infer<typeof relationTypeSchema>;

export type Relation = z.infer<typeof relationSchema>;

export type Attachment = z.infer<typeof attachmentSchema>;

export type AttachPageItem = z.infer<typeof attachPageSchema>;
export type AttachPaperItem = z.infer<typeof attachPaperSchema>;
export type AttachFileItem = z.infer<typeof attachFileSchema>;
export type AttachLinkItem = z.infer<typeof attachLinkSchema>;
export type Attachments = z.infer<typeof attachmentsSchema>;

export type UserMinimal = z.infer<typeof userMinimalSchema>;
export type ParentItemMinimal = z.infer<typeof parentItemMinimalSchema>;

export type SubItem = z.infer<typeof subItemSchema>;

export type Item = z.infer<typeof itemSchema>;

export type CreateItemInput = z.infer<typeof createItemSchema>;

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export type ItemMutationInput = z.infer<typeof itemMutationInputSchema>;

export type ReorderItemInput = z.infer<typeof reorderItemSchema>;

export type BulkUpdateItemInput = z.infer<typeof bulkUpdateItemSchema>;

export type BulkDeleteItemInput = z.infer<typeof bulkDeleteItemSchema>;

export type CreateSubItemInput = z.infer<typeof createSubItemSchema>;

export type AttachPageInput = z.infer<typeof attachPageInputSchema>;
export type AttachPaperInput = z.infer<typeof attachPaperInputSchema>;
export type AttachFileInput = z.infer<typeof attachFileInputSchema>;
export type AttachLinkInput = z.infer<typeof attachLinkInputSchema>;

export type State = z.infer<typeof stateSchema>;
export type Column = State;

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

export type ProjectItemsData = {
  items?: Item[];
  workItems?: Item[];
  columns?: Column[];
  states?: Column[];
  projectName?: string;
  total?: number;
};

export interface ItemHandlers {
  onEditItem: (card: Item) => void;
  onDeleteItem: (card: Item) => void;
  onDuplicateItem: (card: Item) => void;
  onJoinItem: (card: Item) => void;
  onLeaveItem: (card: Item) => void;
  onMoveItem: (workItemId: string, newColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onUpdateItem?: ((item: { id: string } & Partial<Item>) => void) | ((id: string, data: Partial<Item>) => void);
}

export interface BaseViewProps {
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


export type ModalState =
  | { type: 'idle'; mode?: 'idle' }
  | { type: 'create'; mode?: 'create'; initialData?: Partial<Item>; columnId?: string; title?: string }
  | { type: 'detail'; mode?: 'edit' | 'detail'; item: Item }
  | { type: 'delete'; mode?: 'delete'; item: Item };

// ── 5. Standard Domain Configurations ────────────────────────────────────────

export const RELATION_TYPE_CONFIG: Record<
  RelationType,
  { label: string; description: string; badgeColor: string }
> = {
  blocks: {
    label: "Blocks",
    description: "This work item blocks the other work item",
    badgeColor: "text-foreground bg-muted border-border",
  },
  blocked_by: {
    label: "Blocked by",
    description: "This work item is blocked by the other work item",
    badgeColor: "text-foreground bg-muted border-border",
  },
  relates_to: {
    label: "Relates to",
    description: "This work item is related to the other work item",
    badgeColor: "text-foreground bg-muted border-border",
  },
  duplicate_of: {
    label: "Duplicate of",
    description: "This issue is a duplicate of the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  duplicated_by: {
    label: "Duplicated by",
    description: "This issue is duplicated by the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  starts_before: {
    label: "Starts before",
    description: "This issue starts before the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  starts_after: {
    label: "Starts after",
    description: "This issue starts after the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  finishes_before: {
    label: "Finishes before",
    description: "This issue finishes before the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  finishes_after: {
    label: "Finishes after",
    description: "This issue finishes after the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  start_to_finish: {
    label: "Start to finish",
    description: "This issue starts before the other issue finishes",
    badgeColor: "text-foreground bg-muted border-border",
  },
  finish_to_start: {
    label: "Finish to start",
    description: "This issue finishes before the other issue starts",
    badgeColor: "text-foreground bg-muted border-border",
  },
  start_to_start: {
    label: "Start to start",
    description: "This issue starts with the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  finish_to_finish: {
    label: "Finish to finish",
    description: "This issue finishes with the other issue",
    badgeColor: "text-foreground bg-muted border-border",
  },
  implements: {
    label: "Implements",
    description: "This issue implements the other issue",
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
    color: "#EF4444",
    accentColor: "#EF4444",
    sequence: 5000,
    isDefault: false,
    description: "Items abandoned, duplicate, or rejected",
  },
];


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
  | 'createdOn'
  | 'createdBy'
  | 'updatedOn';

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

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  properties: {
    id: true,
    assignee: true,
    startDate: false,
    dueDate: true,
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
    createdOn: false,
    createdBy: false,
    updatedOn: false,
  },
  groupBy: 'state',
  subGroupBy: 'none',
  orderBy: 'manual',
  orderDirection: 'asc',
  showEmptyGroups: true,
  showChildWorkItems: true,
};

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


// ── 7. View, Modal, Picker, Filter, Topbar, Hook & CPM Types ─────────────────

// List View Types
export interface ItemRowProps {
  item: Item;
  columns: Column[];
  projectStates?: Column[];
  currentColumn?: Column;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEditItem: (item: Item) => void;
  onDuplicateItem: (item: Item) => void;
  onJoinItem: (item: Item) => void;
  onLeaveItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onMoveItem: (itemId: string, targetColumnId: string) => void;
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
  onEditItem: (item: Item) => void;
  onUpdateChildItem?: (parentItem: Item, childItem: SubItem, subIndex: number, data: Partial<SubItem>) => void;
  onDeleteChildItem?: (parentItem: Item, childItemId: string, subIndex: number) => void;
}

export interface GroupRowProps {
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
  onAddItem: (columnId: string, title?: string) => void;
  onEditItem: (item: Item) => void;
  onDuplicateItem: (item: Item) => void;
  onJoinItem: (item: Item) => void;
  onLeaveItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onMoveItem: (itemId: string, targetColumnId: string) => void;
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

export interface ListViewProps extends BaseViewProps, ItemHandlers {
  columns: Column[];
  projectStates?: Column[];
  itemsByColumnId?: Map<string, Item[]> | Record<string, Item[]>;
  onAddItem: (columnId: string, title?: string) => void;
  onUpdateItem?: (id: string, data: Partial<Item>) => void;
  onReorderItem?: (itemId: string, newColumnId: string, rank: number) => void;
  isAddingItem?: boolean;
  projectId: string;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: ((ids?: string[]) => void) | (() => void);
  members?: ProjectMember[];
}

// Table View Types
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

export interface TableViewProps extends BaseViewProps, ItemHandlers {
  items?: Item[];
  itemsByColumnId?: Map<string, Item[]> | Record<string, Item[]>;
  columns: Column[];
  projectStates?: Column[];
  projectId?: string;
  members?: ProjectMember[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: ((ids?: string[]) => void) | (() => void);
  onAddItem: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateItem?: (item: { id: string } & Partial<Item>) => void;
  onToggleDisplayProperty?: (key: DisplayPropertyKey, value: boolean) => void;
}

export interface ColumnPropertiesPopoverProps {
  visibleProperties: Record<TablePropertyKey, boolean>;
  onToggleProperty: (key: TablePropertyKey) => void;
  compact?: boolean;
}

// Kanban View Types
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
  onMoveItem?: (cardId: string, targetColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onReorderItem?: (workItemId: string, targetColumnId: string, rank: number) => void;
  isReadOnly?: boolean;
  subGroupBy?: string;
  groupBy?: string;
  itemsByColumnId?: Map<string, Item[]>;
}

export interface UseCardOptions {
  card: Item;
  isReadOnly?: boolean;
  columns?: Column[];
  onMoveItem?: (cardId: string, newColumnId: string) => void;
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
  onMoveItem?: (cardId: string, newColumnId: string) => void;
  onUpdateItem?: (cardId: string, data: Partial<Item>) => void;
  isReadOnly?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (itemId: string) => void;
}

export interface ColumnProps extends BaseViewProps, Partial<ItemHandlers> {
  column: Column;
  cards: Item[];
  columns?: Column[];
  projectStates?: Column[];
  droppableId?: string;
  laneId?: string;
  subGroupBy?: string;
  labelMap?: Map<string, ItemCardLabel>;
  onAddItem?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onUpdateItem?: (itemId: string, data: Partial<Item>) => void;
}

export interface BoardViewProps extends BaseViewProps, Partial<ItemHandlers> {
  items?: Item[];
  itemsByColumnId?: Map<string, Item[]>;
  columns: Column[];
  projectStates?: Column[];
  labelMap?: Map<string, ItemCardLabel>;
  onAddItem?: (columnId: string, title?: string, swimlaneData?: { subGroupBy?: string; laneId?: string }) => void;
  onMoveItem?: (itemId: string, newColumnId: string, laneData?: { subGroupBy?: string; laneId?: string }) => void;
  onReorderItem?: (itemId: string, newColumnId: string, rank: number) => void;
  onUpdateItem?: (itemId: string, data: Partial<Item>) => void;
}


// Timeline View Types
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

export type DepLineType = 'FS' | 'SS' | 'FF' | 'SF' | 'violated' | 'critical' | 'normal';

export interface DependencyLine {
  fromItemId: string;
  toItemId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: DepLineType;
  dependencyType?: 'FS' | 'SS' | 'FF' | 'SF';
  status?: 'violated' | 'critical' | 'normal';
  violated: boolean;
  isCritical?: boolean;
}

export interface TimelineViewProps extends BaseViewProps, ItemHandlers {
  items?: Item[];
  columns: Column[];
  projectStates?: Column[];
  projectId?: string;
  members?: ProjectMember[];
  onAddItem: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateItem?: (item: { id: string } & Partial<Item>) => void;
  isReadOnly?: boolean;
}

// Calendar View Types
export type CalendarLayoutMode = 'month' | 'week';

export interface CalendarViewProps {
  items?: Item[];
  columns: Column[];
  projectId?: string;
  onAddItem: (columnId: string, title?: string, dueDate?: string) => void;
  onOpenItemDetail: (item: Item) => void;
  onAssignExistingItems?: (itemIds: string[], dueDate: string) => void;
  onDateChange?: (item: Item, dueDate: string) => void;
  isReadOnly?: boolean;
}

// Attachment Center Types
export type AttachCenterData = {
  pages?: AttachPageItem[];
  papers?: AttachPaperItem[];
  files?: (Attachment | AttachFileItem)[];
  links?: AttachLinkItem[];
};

export type AttachmentsProps = {
  attachments?: AttachCenterData | Attachment[];
  itemId?: string;
  workItemId?: string;
  projectId?: string;
  onRenameAttachment?: (attachmentId: string, newName: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onAttachPage?: (page: { pageId: string; title: string }) => void;
  onDetachPage?: (pageId: string) => void;
  onAttachPaper?: (paper: { paperId: string; title: string; doi?: string; citationKey?: string }) => void;
  onDetachPaper?: (paperId: string) => void;
  onAttachFile?: (file: { name: string; url: string; size?: number; type?: string; fileId?: string }) => void;
  onAttachFiles?: (files: Array<{ name: string; url: string; size?: number; type?: string; fileId?: string }>) => void;
  onDetachFile?: (fileId: string) => void;
  onAttachLink?: (link: { title: string; url: string }) => void;
  onDetachLink?: (linkIndex: number | string) => void;
  onCommentAttachment?: (attachment: Attachment) => void;
  onDownloadAttachment?: (attachment: Attachment) => void;
  isReadOnly?: boolean;
};

// Modal Types
export interface ModalsProps {
  modal: ModalState;
  onCloseModal: () => void;
  columns: Column[];
  members: ProjectMember[];
  project?: Project;
  projectId: string;
  allItems: Item[];
  isSaving: boolean;
  isDeleting: boolean;
  isReadOnly?: boolean;
  onCreateItem: (data: ItemMutationInput & { createMore?: boolean }) => Promise<void> | void;
  onSaveItem: (data: ItemMutationInput) => Promise<void> | void;
  onDeleteItem: () => void;
  onConfirmDelete: () => Promise<void> | void;
  onDuplicateItem: () => void;
  isAnalyticsOpen?: boolean;
  onCloseAnalytics?: () => void;
  analyticsItems?: Item[];
  analyticsAssignees?: ProjectMember[];
}

export type DetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Partial<Item>;
  columns: Column[];
  project?: Project;
  members?: ProjectMember[];
  availableItems?: Item[];
  onSave: (data: ItemMutationInput) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  isReadOnly?: boolean;
};

export interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: Column[];
  members?: ProjectMember[];
  initialData?: Partial<Item>;
  project?: {
    id?: string;
    name?: string;
    identifier?: string;
    emoji?: string | null;
    icon?: string | null;
    modules?: string[];
  } | null;
  availableItems?: Item[];
  onSubmit: (data: ItemMutationInput & { createMore?: boolean }) => Promise<void> | void;
  isSubmitting?: boolean;
}

export interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
}

export interface RelationsProps {
  relations?: Relation[];
  currentItemId?: string;
  currentWorkItemId?: string;
  availableItems?: Item[];
  onAddRelation: (relation: Relation) => void;
  onRemoveRelation: (relationId: string, targetId?: string) => void;
  isReadOnly?: boolean;
}

// Picker Types
export interface RangeDatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string | null;
  dueDate: string | null;
  onApplyDates: (payload: {
    startDate: string | null;
    dueDate: string | null;
  }) => void;
  actionBtnClass?: string;
  label?: React.ReactNode;
  children?: React.ReactNode;
  isReadOnly?: boolean;
}

export interface SingleDatePickerProps {
  label: string;
  date: string;
  onSelectDate: (dateString: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionBtnClass?: string;
  variant?: 'outline' | 'ghost' | 'default' | 'secondary';
  disabled?: boolean;
  isReadOnly?: boolean;
  children?: React.ReactNode;
}

export interface LabelPickerProps {
  labels?: string[] | Label[];
  setLabels?: React.Dispatch<React.SetStateAction<string[]>>;
  actionBtnClass?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  isReadOnly?: boolean;
  iconOnly?: boolean;
  children?: React.ReactNode;
  selectedLabelIds?: string[];
  onToggleLabel?: (labelId: string) => void;
  onCreateLabel?: (name: string, color?: string) => Promise<Label | null | void>;
}

export interface MemberPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId?: string | null;
  setAssigneeId?: (id: string | null) => void;
  assigneeIds?: string[];
  setAssigneeIds?: (ids: string[]) => void;
  members: ProjectMember[];
  actionBtnClass?: string;
  triggerLabel?: string;
  isMulti?: boolean;
  disabled?: boolean;
  isReadOnly?: boolean;
  selectedMemberIds?: string[];
  onToggleMember?: (memberId: string) => void;
  children?: React.ReactNode;
}

export interface ParentPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
  setParentId?: (parentId: string | null) => void;
  items?: Item[];
  actionBtnClass?: string;
  isReadOnly?: boolean;
  currentParentId?: string | null;
  currentItemId?: string | null;
  availableItems?: Item[];
  onSelectParent?: (parentId: string | null) => void;
  children?: React.ReactNode;
}

export interface PriorityPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priority: Priority;
  setPriority?: (priority: Priority) => void;
  onSelectPriority?: (priority: Priority) => void;
  actionBtnClass?: string;
  isReadOnly?: boolean;
  defaultLabel?: string;
  children?: React.ReactNode;
}

export interface ProjectPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: {
    id?: string;
    name?: string;
    identifier?: string;
    emoji?: string | null;
  } | null;
  projects?: Array<{ id: string; name?: string; identifier?: string; emoji?: string | null }>;
  onSelectProject: (project: { id: string; name?: string; identifier?: string }) => void;
  disabled?: boolean;
  currentProjectId?: string;
  children?: React.ReactNode;
  actionBtnClass?: string;
  isReadOnly?: boolean;
}

export interface StatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId?: string;
  setColumnId?: (columnId: string) => void;
  currentStateId?: string;
  columns?: Column[];
  onSelectState?: (stateId: string) => void;
  actionBtnClass?: string;
  isReadOnly?: boolean;
  children?: React.ReactNode;
}

// Topbar & Layout Types
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
  initialFilters?: Filters | Record<string, unknown>;
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
  viewMode: ViewMode;
  onViewChange?: (mode: ViewMode) => void;
  onViewModeChange?: (mode: ViewMode) => void;
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
  filters?: Filters;
  onFilterChange?: (filters: Filters) => void;
  onResetFilters?: () => void;
  filterCounts?: number;
  hasActiveFilters?: boolean;
  onToggleFilter?: <K extends keyof Filters>(key: K, item: Filters[K] extends (infer E)[] ? E : string) => void;
  onRemoveFilter?: <K extends keyof Filters>(key: K, item?: Filters[K] extends (infer E)[] ? E : string) => void;
  displayOptions?: DisplayOptions;
  onDisplayOptionsChange?: (options: DisplayOptions) => void;
  onPropertyToggle?: (key: DisplayPropertyKey, value: boolean) => void;
  displayOpen?: boolean;
  onDisplayOpenChange?: (open: boolean) => void;
  onUpdateDisplayOption?: <K extends keyof DisplayOptions>(
    key: K,
    value: DisplayOptions[K]
  ) => void;
  onOpenAnalytics?: () => void;
  onAddItem?: (columnId?: string) => void;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  className?: string;
}

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

export interface ViewContainerProps {
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
  onDeleteItem: (card: Item) => void;
  onDuplicateItem: (card: Item) => void;
  onJoinItem: (card: Item) => void;
  onLeaveItem: (card: Item) => void;
  onMoveItem: (
    workItemId: string,
    newColumnId: string,
    laneData?: { subGroupBy?: string; laneId?: string }
  ) => void;
  onReorderItem: (workItemId: string, newColumnId: string, rank: number) => void;
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
  filters?: Filters;
  onFilterChange?: (filters: Filters) => void;
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
  filters?: Filters;
  onFilterChange?: (filters: Filters) => void;
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

// Hook Options Types
export interface UseGroupingOptions {
  items: Item[];
  columns: Column[];
  members?: ProjectMember[];
  labels?: Label[];
  displayOptions: DisplayOptions;
  groupBy?: GroupByOption;
  subGroupBy?: SubGroupByOption;
}

export interface UseItemSelectionOptions {
  initialSelectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  items?: Item[];
}

export interface UseRealtimeItemsOptions {
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

// CPM Analysis Types
export type CpmDependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface CpmEdge {
  fromId: string;
  toId: string;
  type: CpmDependencyType;
  lagDays?: number;
}

export interface CpmNode {
  id: string;
  title: string;
  durationDays: number;
  startDate?: Date | null;
  dueDate?: Date | null;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slackDays: number;
  isCritical: boolean;
  predecessors: string[];
  successors: string[];
}

export interface CpmAnalysisResult {
  nodes: Map<string, CpmNode>;
  criticalPathItemIds: Set<string>;
  criticalEdges: Set<string>;
  violatedEdges?: Set<string>;
  hasCycle: boolean;
  cycleNodeIds: string[];
  projectDurationDays: number;
  topologicalOrder: string[];
}

export interface ServerCpmNodeDto {
  id: string;
  title: string;
  durationDays: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  totalFloat: number;
  freeFloat: number;
  isCritical: boolean;
  predecessors: string[];
  successors: string[];
  hasActualDates: boolean;
}

export interface ServerCpmAnalysisDto {
  nodes: Record<string, ServerCpmNodeDto>;
  criticalPathItemIds: string[];
  criticalEdges: string[];
  violatedEdges: string[];
  hasCycle: boolean;
  cycleNodeIds: string[];
  projectDurationDays: number;
  topologicalOrder: string[];
}

// Filter & Activity Entry Types
export type FilterQuery = Partial<Filters>;

export interface FilterItemConfig {
  id: string;
  label: string;
  icon?: React.ElementType;
}

export type ActivityEntry = {
  id: string;
  author: string;
  authorInitials: string;
  avatarUrl?: string | null;
  content: string;
  timestamp: string;
  createdAt?: number;
  kind?: 'comment' | 'system' | 'activity';
  reactionEmoji?: string;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
  };
};

export type ActivitiesProps = {
  commentText: string;
  setCommentText: (text: string) => void;
  commentTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onSaveComment: (content: string) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReactComment: (commentId: string, emoji: string) => void;
  attachmentLinks?: Array<{ name: string; url: string }>;
  commentFocusToken?: number;
  commentCaretPosition?: number;
  onCommentCaretChange?: (position: number) => void;
  canComment?: boolean;
  isSavingComment?: boolean;
  isUpdatingComment?: boolean;
  showDetailActivity: boolean;
  setShowDetailActivity: (show: boolean | ((prev: boolean) => boolean)) => void;
  activityLoading?: boolean;
  activityError?: boolean;
  activities: ActivityEntry[];
  isReadOnly?: boolean;
};

export type ActivityTab = 'all' | 'activity' | 'comments' | 'history';

export {
  TABLE_STORAGE_KEY,
  TABLE_WIDTHS_STORAGE_KEY,
  TABLE_PROPERTIES,
  DEFAULT_VISIBLE_PROPERTIES,
  DEFAULT_COLUMN_WIDTHS,
} from '../utils/work-item.utils';


