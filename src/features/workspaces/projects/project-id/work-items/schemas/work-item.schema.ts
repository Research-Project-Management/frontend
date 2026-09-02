import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────────────

export const workItemPrioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]);
export const taskPrioritySchema = workItemPrioritySchema;

export const workItemRecurrenceSchema = z.enum([
  "none",
  "daily",
  "mon-fri",
  "mon_fri",
  "weekly",
  "monthly-day",
  "monthly_day",
  "monthly-week",
  "monthly_week",
]);
export const taskRecurrenceSchema = workItemRecurrenceSchema;

export const workItemReminderSchema = z.enum([
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
export const taskReminderSchema = workItemReminderSchema;

// ── Checklist Schemas ────────────────────────────────────────────────────────

export const checklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean().default(false),
  isCompleted: z.boolean().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export const checklistSchema = z.object({
  id: z.string(),
  title: z.string(),
  items: z.array(checklistItemSchema),
});

export const checklistItemInputSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  completed: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export const checklistInputSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  items: z.array(checklistItemInputSchema),
});

// ── Attachment Schema ────────────────────────────────────────────────────────

export const workItemAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.string(),
  url: z.string(),
  createdAt: z.string(),
});
export const taskAttachmentSchema = workItemAttachmentSchema;

// ── WorkItem / Task Schema ───────────────────────────────────────────────────

export const workItemSchema = z.object({
  id: z.string(),
  identifier: z.string().nullable().optional(),
  title: z.string(),
  content: z.string(),
  description: z.string(),
  projectId: z.string(),
  columnId: z.string(),
  assignee: z
    .object({
      id: z.string(),
      name: z.string(),
      avatar: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  assigneeId: z
    .object({
      id: z.string(),
      name: z.string().optional(),
      avatar: z.string().optional(),
      email: z.string().optional(),
    })
    .nullable()
    .optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  labels: z.array(z.string()),
  rank: z.number(),
  authorId: z.string(),
  priority: workItemPrioritySchema,
  estimate: z.number().optional(),
  cycleId: z
    .union([
      z.string(),
      z.object({
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
      title: z.string().optional(),
      identifier: z.string().optional(),
    })
    .nullable()
    .optional(),
  subtasks: z.array(z.any()).optional(),
  subtaskCount: z.number().optional(),
  subtaskCompletedCount: z.number().optional(),
  recurrence: workItemRecurrenceSchema.optional(),
  reminder: workItemReminderSchema.optional(),
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
  attachments: z.array(workItemAttachmentSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const taskSchema = workItemSchema;

// ── Mutation Input Schema ────────────────────────────────────────────────────

export const workItemMutationInputSchema = workItemSchema
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
export const taskMutationInputSchema = workItemMutationInputSchema;

export const columnSchema = z.object({
  id: z.string(),
  title: z.string(),
  accentColor: z.string().optional(),
});

export const columnFormSchema = z.object({
  sectionName: z.string().min(1, "Column name is required"),
  selectedColor: z.string(),
});
export type ColumnFormSchema = z.infer<typeof columnFormSchema>;

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
export const WorkItemSchema = workItemSchema;
export const WorkItemMutationInputSchema = workItemMutationInputSchema;
