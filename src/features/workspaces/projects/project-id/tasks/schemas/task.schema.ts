import { z } from "zod";

export const TaskLabelSchema = z.object({
  id: z.string(),
  color: z.string(),
  title: z.string(),
});

export const TaskPrioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]);

export const TaskRecurrenceSchema = z.enum([
  "none",
  "daily",
  "mon-fri",
  "weekly",
  "monthly-day",
  "monthly-week",
]);

export const TaskReminderSchema = z.enum([
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

export const ChecklistItemSchema = z.object({
  _id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  assigneeId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export const ChecklistSchema = z.object({
  _id: z.string(),
  title: z.string(),
  items: z.array(ChecklistItemSchema),
});

export const ChecklistItemInputSchema = z.object({
  title: z.string(),
  completed: z.boolean(),
  assigneeId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

export const ChecklistInputSchema = z.object({
  title: z.string(),
  items: z.array(ChecklistItemInputSchema),
});

export const TaskSchema = z.object({
  _id: z.string(),
  title: z.string(),
  content: z.string(),
  description: z.string(),
  projectId: z.string(),
  columnId: z.string(),
  assigneeId: z.object({
    _id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
  }).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  labels: z.array(z.string()),
  rank: z.number(),
  authorId: z.string(),
  priority: TaskPrioritySchema,
  estimate: z.number().optional(),
  cycleId: z.object({
    _id: z.string(),
    name: z.string(),
    phase: z.string(), // Extracted from cycle feature
    status: z.string(), // Extracted from cycle feature
    startDate: z.string(),
    endDate: z.string(),
  }).nullable().optional(),
  parentTaskId: z.object({
    _id: z.string(),
    title: z.string(),
    identifier: z.string(),
  }).nullable().optional(),
  identifier: z.string(),
  recurrence: TaskRecurrenceSchema.optional(),
  reminder: TaskReminderSchema.optional(),
  checklists: z.array(ChecklistSchema).optional(),
  completed: z.boolean(),
  commentCount: z.number().optional(),
  isOverdue: z.boolean().optional(),
  dueState: z.enum(["none", "onTime", "overdue"]).optional(),
  permissions: z.object({
    canEdit: z.boolean(),
    canMove: z.boolean(),
    canDelete: z.boolean(),
    canDuplicate: z.boolean(),
  }).optional(),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    size: z.string(),
    createdAt: z.string(),
    url: z.string(),
  })),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const TaskMutationInputSchema = TaskSchema.pick({
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
}).partial().extend({
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  cycleId: z.string().nullable().optional(),
  checklists: z.array(ChecklistInputSchema).optional(),
  parentTaskId: z.string().nullable().optional(),
});
