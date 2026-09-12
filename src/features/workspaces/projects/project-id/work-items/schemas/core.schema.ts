import { z } from "zod";

// ── Priority Enum (Matches Prisma TaskPriority) ──────────────────────────────
export const taskPrioritySchema = z.enum([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);
export const prioritySchema = taskPrioritySchema;
export type Priority = z.infer<typeof prioritySchema>;
export type TaskPriority = Priority;

// ── Create Work Item DTO Schema (Matches CreateWorkItemDto) ───────────────────
export const createWorkItemDtoSchema = z.object({
  title: z.string().trim().min(1, "WorkItem title is required"),
  content: z.string().optional(),
  description: z.string().optional(),
  columnId: z.string().optional(),
  projectId: z.string().optional(),
  assignee: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  startDate: z.union([z.string(), z.date()]).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).nullable().optional(),
  priority: taskPrioritySchema.optional(),
  rank: z.number().optional(),
  cycle: z.string().optional(),
  cycleId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  labelIds: z.array(z.string()).optional(),
  timeSpent: z.number().nullable().optional(),
  completed: z.boolean().optional(),
  attachments: z.any().optional(),
  relations: z.any().optional(),
});
export const createItemSchema = createWorkItemDtoSchema;
export const createTaskSchema = createWorkItemDtoSchema;
export const createWorkItemSchema = createWorkItemDtoSchema;
export type CreateWorkItemDtoInput = z.infer<typeof createWorkItemDtoSchema>;

// ── Update Work Item DTO Schema (Matches UpdateWorkItemDto) ───────────────────
export const updateWorkItemDtoSchema = createWorkItemDtoSchema.partial();
export const updateItemSchema = updateWorkItemDtoSchema;
export const updateTaskSchema = updateWorkItemDtoSchema;
export const updateWorkItemSchema = updateWorkItemDtoSchema;
export const itemMutationInputSchema = updateWorkItemDtoSchema;
export const workItemMutationInputSchema = updateWorkItemDtoSchema;
export const taskMutationInputSchema = updateWorkItemDtoSchema;
export type UpdateWorkItemDtoInput = z.infer<typeof updateWorkItemDtoSchema>;

// ── Query Work Item DTO Schema (Matches QueryWorkItemDto) ─────────────────────
export const queryWorkItemDtoSchema = z.object({
  search: z.string().optional(),
  priority: taskPrioritySchema.optional(),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  cycleId: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
});
export type QueryWorkItemDtoInput = z.infer<typeof queryWorkItemDtoSchema>;

// ── Reorder Work Item DTO Schema (Matches ReorderWorkItemDto) ─────────────────
export const reorderWorkItemDtoSchema = z.object({
  id: z.string().optional(),
  itemId: z.string().optional(),
  workItemId: z.string().optional(),
  taskId: z.string().optional(),
  columnId: z.string().optional(),
  rank: z.number(),
  projectId: z.string().optional(),
});
export const reorderWorkItemSchema = reorderWorkItemDtoSchema;
export const reorderItemSchema = reorderWorkItemDtoSchema;
export const reorderTaskSchema = reorderWorkItemDtoSchema;
export type ReorderWorkItemDtoInput = z.infer<typeof reorderWorkItemDtoSchema>;

// ── Bulk Update DTO Schema (Matches BulkUpdateWorkItemDto) ────────────────────
export const bulkUpdateWorkItemDtoSchema = z.object({
  ids: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  workItemIds: z.array(z.string()).optional(),
  taskIds: z.array(z.string()).optional(),
  data: updateWorkItemDtoSchema.extend({
    addLabel: z.string().optional(),
    removeLabel: z.string().optional(),
    clearLabels: z.boolean().optional(),
  }),
  projectId: z.string().optional(),
});
export const bulkUpdateWorkItemSchema = bulkUpdateWorkItemDtoSchema;
export const bulkUpdateItemSchema = bulkUpdateWorkItemDtoSchema;
export const bulkUpdateTaskSchema = bulkUpdateWorkItemDtoSchema;
export type BulkUpdateWorkItemDtoInput = z.infer<typeof bulkUpdateWorkItemDtoSchema>;

// ── Bulk Delete DTO Schema (Matches BulkDeleteWorkItemDto) ────────────────────
export const bulkDeleteWorkItemDtoSchema = z.object({
  ids: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  workItemIds: z.array(z.string()).optional(),
  taskIds: z.array(z.string()).optional(),
  projectId: z.string().optional(),
});
export const bulkDeleteWorkItemSchema = bulkDeleteWorkItemDtoSchema;
export const bulkDeleteItemSchema = bulkDeleteWorkItemDtoSchema;
export const bulkDeleteTaskSchema = bulkDeleteWorkItemDtoSchema;
export type BulkDeleteWorkItemDtoInput = z.infer<typeof bulkDeleteWorkItemDtoSchema>;

// ── Duplicate Work Item DTO Schema (Matches DuplicateWorkItemDto) ─────────────
export const duplicateWorkItemDtoSchema = z.object({
  destinationProjectId: z.string().optional(),
  projectId: z.string().optional(),
});
export type DuplicateWorkItemDtoInput = z.infer<typeof duplicateWorkItemDtoSchema>;

// ── Create Subtask DTO Schema ────────────────────────────────────────────────
export const createSubItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  columnId: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: taskPrioritySchema.optional(),
});
export const createSubtaskSchema = createSubItemSchema;
export const createSubWorkItemSchema = createSubItemSchema;
export type CreateSubItemInput = z.infer<typeof createSubItemSchema>;
