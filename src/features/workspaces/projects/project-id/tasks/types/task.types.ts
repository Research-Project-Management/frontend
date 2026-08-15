import { z } from "zod";
import {
  taskPrioritySchema,
  taskRecurrenceSchema,
  taskReminderSchema,
  checklistItemSchema,
  checklistSchema,
  checklistItemInputSchema,
  checklistInputSchema,
  taskSchema,
  taskMutationInputSchema,
  columnSchema,
  taskAttachmentSchema,
} from "../schemas/task.schemas";
import { taskLabelSchema, labelSchema } from "../schemas/label.schemas";

// ── Domain Types (Inferred from Zod) ─────────────────────────────────────────

export type Priority = z.infer<typeof taskPrioritySchema>;
export type TaskRecurrence = z.infer<typeof taskRecurrenceSchema>;
export type TaskReminder = z.infer<typeof taskReminderSchema>;
export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Checklist = z.infer<typeof checklistSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemInputSchema>;
export type ChecklistInput = z.infer<typeof checklistInputSchema>;
export type TaskAttachment = z.infer<typeof taskAttachmentSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskMutationInput = z.infer<typeof taskMutationInputSchema>;
export type Column = z.infer<typeof columnSchema>;

export type TaskActivityLog = any;
export type Cycle = any;
export type CycleMilestone = any;

export type ProjectTasksData = {
  tasks: Task[];
  columns: Column[];
  projectName: string;
  cycles: Cycle[];
};

// ── Column Helpers ───────────────────────────────────────────────────────────

export function resolveTaskColumnId(column?: Pick<Column, "id" | "_id"> | null): string {
  return column?.id ?? column?._id ?? "";
}

export const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "red" },
  high: { label: "High", color: "orange" },
  medium: { label: "Medium", color: "blue" },
  low: { label: "Low", color: "gray" },
  none: { label: "None", color: "transparent" },
} as const;

export const DEFAULT_TASK_COLUMN_COLORS: Record<string, string> = {
  backlog: "#6366F1",
  todo: "#0EA5E9",
  doing: "#F59E0B",
  review: "#EAB308",
  done: "#22C55E",
};

export function resolveTaskColumnColor(columnId: string, accentColor?: string): string {
  return DEFAULT_TASK_COLUMN_COLORS[columnId] || accentColor || "#6B7280";
}
