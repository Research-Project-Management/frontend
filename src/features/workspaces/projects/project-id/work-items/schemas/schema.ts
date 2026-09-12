import { z } from "zod";

// ── 1. Domain Enums ──────────────────────────────────────────────────────────

export const prioritySchema = z.enum([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);
export const workItemPrioritySchema = prioritySchema;
export const taskPrioritySchema = prioritySchema;

export const relationTypeSchema = z.enum([
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate_of",
]);
export const workItemRelationTypeSchema = relationTypeSchema;
export const taskRelationTypeSchema = relationTypeSchema;

export const stateGroupSchema = z.enum([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);

export const recurrenceSchema = z.enum([
  "none",
  "daily",
  "mon-fri",
  "mon_fri",
  "weekly",
  "monthly-day",
  "monthly_day",
  "monthly-week",
  "monthly_week",
  "yearly",
]);
export const workItemRecurrenceSchema = recurrenceSchema;
export const taskRecurrenceSchema = recurrenceSchema;

export const reminderSchema = z.enum([
  "none",
  "at-time",
  "at_time",
  "5m",
  "m5",
  "10m",
  "m10",
  "15m",
  "m15",
  "1h",
  "h1",
  "2h",
  "h2",
  "1day",
  "d1",
  "2day",
  "d2",
]);
export const workItemReminderSchema = reminderSchema;
export const taskReminderSchema = reminderSchema;

// ── 2. Minimal Related Entities ─────────────────────────────────────────────

export const userMinimalSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export const cycleMinimalSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const parentTaskMinimalSchema = z.object({
  id: z.string(),
  title: z.string(),
  identifier: z.string().nullable().optional(),
});

export const relationSchema = z.object({
  id: z.string(),
  type: relationTypeSchema,
  targetTaskId: z.string(),
  targetTitle: z.string().optional(),
  targetIdentifier: z.string().optional(),
  targetColumnId: z.string().optional(),
});
export const workItemRelationSchema = relationSchema;
export const taskRelationSchema = relationSchema;

export const subtaskItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  identifier: z.string().nullable().optional(),
  columnId: z.string().default("backlog"),
  completed: z.boolean().default(false),
  rank: z.number().default(0),
  assigneeId: z.string().nullable().optional(),
  assignee: userMinimalSchema.nullable().optional(),
  dueDate: z.string().nullable().optional(),
});
export type SubtaskItem = z.infer<typeof subtaskItemSchema>;

// ── 3. Attach Center Schemas (Pages, Papers, Files, Links) ──────────────────

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
  pages: z.array(attachPageSchema).default([]),
  papers: z.array(attachPaperSchema).default([]),
  files: z.array(attachFileSchema).default([]),
  links: z.array(attachLinkSchema).default([]),
});
export const workItemAttachmentsSchema = attachmentsSchema;

export const attachmentSchema = attachFileSchema;
export const workItemAttachmentSchema = attachmentSchema;
export const taskAttachmentSchema = attachmentSchema;

// ── 4. Main Task Entity Schema ──────────────────────────────────────────────

export const taskSchema = z.object({
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
  labels: z.array(z.string()).default([]),
  attachments: attachmentsSchema.default({
    pages: [],
    papers: [],
    files: [],
    links: [],
  }),
  completed: z.boolean().default(false),
  rank: z.number().default(0),
  timeSpent: z.number().nullable().optional(),
  projectId: z.string(),
  authorId: z.string().optional(),
  author: userMinimalSchema.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assignee: userMinimalSchema.nullable().optional(),
  cycleId: z.string().nullable().optional(),
  cycle: z.union([cycleMinimalSchema, z.string()]).nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  parentTask: parentTaskMinimalSchema.nullable().optional(),
  subtasks: z.array(subtaskItemSchema).default([]),
  subtaskCount: z.number().optional(),
  subtaskCompletedCount: z.number().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  reminder: reminderSchema.nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const workItemSchema = taskSchema;

// ── 5. Mutation & Action Schemas ────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  projectId: z.string().optional(),
  content: z.string().optional(),
  description: z.string().optional(),
  columnId: z.string().optional(),
  priority: prioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  cycleId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  rank: z.number().optional(),
  timeSpent: z.number().nullable().optional(),
  relations: z.array(relationSchema).optional(),
  attachments: z.union([attachmentsSchema, z.array(attachFileSchema)]).optional(),
  completed: z.boolean().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  reminder: reminderSchema.nullable().optional(),
  subtasks: z.array(z.any()).optional(),
});
export const createWorkItemSchema = createTaskSchema;

export const updateTaskSchema = createTaskSchema.partial();
export const updateWorkItemSchema = updateTaskSchema;
export const workItemMutationInputSchema = updateTaskSchema;
export const taskMutationInputSchema = updateTaskSchema;

export const reorderTaskSchema = z.object({
  taskId: z.string(),
  columnId: z.string().optional(),
  rank: z.number(),
  projectId: z.string().optional(),
});
export const reorderWorkItemSchema = reorderTaskSchema;

export const bulkUpdateTaskSchema = z.object({
  taskIds: z.array(z.string()).min(1, "At least one task ID is required"),
  data: updateTaskSchema,
  projectId: z.string().optional(),
});
export const bulkUpdateWorkItemSchema = bulkUpdateTaskSchema;

export const createSubtaskSchema = z.object({
  title: z.string().min(1, "Subtask title is required"),
  columnId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: prioritySchema.optional(),
  rank: z.number().optional(),
});

// ── 6. Board State & Column Schemas ─────────────────────────────────────────

export const stateSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  title: z.string().optional(),
  color: z.string().default("#6366F1"),
  accentColor: z.string().optional(),
  group: stateGroupSchema.default("backlog"),
  sequence: z.number().default(1000),
  isDefault: z.boolean().default(false),
  description: z.string().optional(),
  slug: z.string().optional(),
});
export const workItemStateSchema = stateSchema;
export const columnSchema = stateSchema;
export type WorkItemStateSchema = z.infer<typeof stateSchema>;

export const stateFormSchema = z.object({
  name: z.string().min(1, "State name is required"),
  color: z.string().min(1, "Color is required"),
  group: stateGroupSchema,
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export const columnFormSchema = z.object({
  sectionName: z.string().min(1, "Column name is required"),
  selectedColor: z.string(),
  group: stateGroupSchema.optional(),
});
export type ColumnFormSchema = z.infer<typeof columnFormSchema>;

// ── 7. Attach Center Mutation Inputs ────────────────────────────────────────

export const attachPageInputSchema = z.object({
  pageId: z.string(),
  title: z.string().optional(),
});

export const attachPaperInputSchema = z.object({
  paperId: z.string(),
  title: z.string().optional(),
  doi: z.string().optional(),
  citationKey: z.string().optional(),
});

export const attachFileInputSchema = z.object({
  name: z.string(),
  url: z.string(),
  size: z.number().optional(),
  type: z.string().optional(),
});

export const attachLinkInputSchema = z.object({
  title: z.string(),
  url: z.string(),
});

// ── 8. Filter Schemas ───────────────────────────────────────────────────────

export const filtersSchema = z.object({
  search: z.string().default(""),
  state: z.array(z.string()).default([]),
  state_group: z.array(stateGroupSchema).default([]),
  priority: z.array(prioritySchema).default([]),
  assignees: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]),
  created_by: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  cycle: z.array(z.string()).default([]),
  attach: z.array(z.string()).default([]),
  work_items: z.array(z.string()).default([]),
  tasks: z.array(z.string()).default([]),
  parent: z.array(z.string()).default([]),
  due_date: z.array(z.string()).default([]),
  start_date: z.array(z.string()).default([]),
  created_at: z.array(z.string()).default([]),
  updated_at: z.array(z.string()).default([]),
});
export const workItemFiltersSchema = filtersSchema;
