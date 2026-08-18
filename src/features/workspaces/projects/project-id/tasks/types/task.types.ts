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
} from "../schemas/task.schema";

// ── Branded Identifier Types (Matt Pocock Pattern) ──────────────────────────

declare const __brand: unique symbol;
export type Brand<B> = { readonly [__brand]: B };

export type TaskId = string & Brand<'TaskId'>;
export type ColumnId = string & Brand<'ColumnId'>;
export type ProjectId = string & Brand<'ProjectId'>;
export type CycleId = string & Brand<'CycleId'>;

// ── Domain Types (Inferred from Zod) ─────────────────────────────────────────

export type Priority = z.infer<typeof taskPrioritySchema>;
export type TaskPriority = Priority;
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

// ── Local Domain Entities (Self-contained, no cross-module imports) ──────────

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
  userId: string;
  role: string;
  name?: string;
  avatar?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  color?: string;
  status?: string;
  workspaceId?: string;
  members?: ProjectMember[];
};

export type TaskActivityLog = {
  id: string;
  taskId?: string;
  action?: string;
  type?: string;
  user?: {
    id?: string;
    name?: string;
    avatar?: string;
  } | null;
  author?: string;
  authorInitials?: string;
  avatarUrl?: string | null;
  content?: string;
  timestamp?: string;
  createdAt?: number | string;
  kind?: "comment" | "system" | "activity";
  reactionEmoji?: string;
  metadata?: Record<string, unknown>;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
  };
};

export type ProjectTasksData = {
  tasks: Task[];
  columns: Column[];
  projectName: string;
  cycles: Cycle[];
};

// ── UI States & Discriminated Unions ─────────────────────────────────────────

export type TaskViewMode = "board" | "list" | "calendar";

export type TaskModalState =
  | { mode: "idle" }
  | { mode: "create"; columnId?: string; title?: string }
  | { mode: "edit"; task: Task }
  | { mode: "delete"; task: Task }
  | { mode: "transfer"; task: Task }
  | { mode: "add-existing" };

// ── Column Helpers ───────────────────────────────────────────────────────────

export function resolveTaskColumnId(column?: Pick<Column, "id"> | null): string {
  return column?.id ?? "";
}

export const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "red" },
  high: { label: "High", color: "orange" },
  medium: { label: "Medium", color: "blue" },
  low: { label: "Low", color: "gray" },
  none: { label: "None", color: "transparent" },
} as const satisfies Record<Priority, { label: string; color: string }>;

export const FIXED_TASK_COLUMNS: Column[] = [
  { id: "backlog", title: "Backlog", accentColor: "#6366F1" },
  { id: "todo", title: "To Do", accentColor: "#0EA5E9" },
  { id: "doing", title: "In Progress", accentColor: "#F59E0B" },
  { id: "review", title: "Review", accentColor: "#EAB308" },
  { id: "done", title: "Done", accentColor: "#22C55E" },
  { id: "cancelled", title: "Cancelled", accentColor: "#94A3B8" },
];

export const DEFAULT_TASK_COLUMN_COLORS: Record<string, string> = {
  backlog: "#6366F1",
  todo: "#0EA5E9",
  doing: "#F59E0B",
  in_progress: "#F59E0B",
  review: "#EAB308",
  done: "#22C55E",
  cancelled: "#94A3B8",
};

export function resolveTaskColumnColor(columnId: string, accentColor?: string): string {
  return DEFAULT_TASK_COLUMN_COLORS[columnId] || accentColor || "#6B7280";
}
