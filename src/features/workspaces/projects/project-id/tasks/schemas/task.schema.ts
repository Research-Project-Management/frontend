import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────────────

export const taskPrioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]);

export const taskRecurrenceSchema = z.enum([
  "none",
  "daily",
  "mon-fri",
  "weekly",
  "monthly-day",
  "monthly-week",
]);

export const taskReminderSchema = z.enum([
  "none",
  "at-time",
  "5m",
  "10m",
  "15m",
  "1h",
  "2h",
  "1day",
  "2day",
]);

// ── Checklist Schemas ────────────────────────────────────────────────────────

export const checklistItemSchema = z.object({
  _id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  assigneeId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export const checklistSchema = z.object({
  _id: z.string(),
  title: z.string(),
  items: z.array(checklistItemSchema),
});

export const checklistItemInputSchema = z.object({
  title: z.string(),
  completed: z.boolean(),
  assigneeId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export const checklistInputSchema = z.object({
  title: z.string(),
  items: z.array(checklistItemInputSchema),
});

// ── Attachment Schema ────────────────────────────────────────────────────────

export const taskAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.string(),
  createdAt: z.string(),
  url: z.string(),
});

// ── Main Task Schema ─────────────────────────────────────────────────────────

export const taskSchema = z.object({
  _id: z.string(),
  title: z.string(),
  content: z.string(),
  description: z.string(),
  projectId: z.string(),
  columnId: z.string(),
  assigneeId: z
    .object({
      _id: z.string(),
      name: z.string(),
      avatar: z.string().optional(),
    })
    .nullable()
    .optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  labels: z.array(z.string()),
  rank: z.number(),
  authorId: z.string(),
  priority: taskPrioritySchema,
  estimate: z.number().optional(),
  cycleId: z
    .union([
      z.string(),
      z.object({
        _id: z.string().optional(),
        id: z.string().optional(),
        name: z.string().optional(),
        phase: z.string().optional(),
        status: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
    ])
    .nullable()
    .optional(),
  parentTaskId: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
  parentTask: z
    .object({
      id: z.string().optional(),
      _id: z.string().optional(),
      title: z.string().optional(),
      identifier: z.string().optional(),
    })
    .nullable()
    .optional(),
  subtasks: z.array(z.any()).optional(),
  subtaskCount: z.number().optional(),
  subtaskCompletedCount: z.number().optional(),
  identifier: z.string().nullable().optional(),
  recurrence: taskRecurrenceSchema.optional(),
  reminder: taskReminderSchema.optional(),
  checklists: z.array(checklistSchema).optional(),
  completed: z.boolean().optional(),
  commentCount: z.number().optional(),
  isOverdue: z.boolean().optional(),
  dueState: z.enum(["none", "onTime", "overdue"]).optional(),
  permissions: z
    .object({
      canEdit: z.boolean(),
      canMove: z.boolean(),
      canDelete: z.boolean(),
      canDuplicate: z.boolean(),
    })
    .optional(),
  attachments: z.array(taskAttachmentSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ── Mutation Input Schema ────────────────────────────────────────────────────

export const taskMutationInputSchema = taskSchema
  .pick({
    title: true,
    content: true,
    description: true,
    columnId: true,
    labels: true,
    priority: true,
    estimate: true,
    rank: true,
    recurrence: true,
    reminder: true,
    completed: true,
    commentCount: true,
    attachments: true,
  })
  .partial()
  .extend({
    dueDate: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
    cycleId: z.string().nullable().optional(),
    checklists: z.array(checklistInputSchema).optional(),
    parentTaskId: z.string().nullable().optional(),
  });

// ── Column Schema ────────────────────────────────────────────────────────────

export const columnSchema = z.object({
  id: z.string(),
  _id: z.string().optional(),
  title: z.string(),
  accentColor: z.string().optional(),
});

// ── Backward-compatible Aliases ──────────────────────────────────────────────

export const TaskPrioritySchema = taskPrioritySchema;
export const TaskRecurrenceSchema = taskRecurrenceSchema;
export const TaskReminderSchema = taskReminderSchema;
export const ChecklistItemSchema = checklistItemSchema;
export const ChecklistSchema = checklistSchema;
export const ChecklistItemInputSchema = checklistItemInputSchema;
export const ChecklistInputSchema = checklistInputSchema;
export const TaskSchema = taskSchema;
export const TaskMutationInputSchema = taskMutationInputSchema;
