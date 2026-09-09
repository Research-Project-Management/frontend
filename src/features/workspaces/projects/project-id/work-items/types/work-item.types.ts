import { z } from "zod";
import {
  workItemPrioritySchema,
  taskPrioritySchema,
  taskIssueTypeSchema,
  taskRelationTypeSchema,
  taskRelationSchema,
  workItemRecurrenceSchema,
  taskRecurrenceSchema,
  workItemReminderSchema,
  taskReminderSchema,
  checklistItemSchema,
  checklistSchema,
  checklistItemInputSchema,
  checklistInputSchema,
  workItemSchema,
  taskSchema,
  workItemMutationInputSchema,
  taskMutationInputSchema,
  columnSchema,
  workItemAttachmentSchema,
  taskAttachmentSchema,
} from "../schemas/work-item.schema";

// ── Branded Identifier Types (Matt Pocock Pattern) ──────────────────────────

declare const __brand: unique symbol;
export type Brand<B> = { readonly [__brand]: B };

export type WorkItemId = string & Brand<'WorkItemId'>;
export type TaskId = WorkItemId;
export type ColumnId = string & Brand<'ColumnId'>;
export type ProjectId = string & Brand<'ProjectId'>;
export type CycleId = string & Brand<'CycleId'>;

// ── Domain Types (Inferred from Zod) ─────────────────────────────────────────

export type Priority = z.infer<typeof workItemPrioritySchema>;
export type WorkItemPriority = Priority;
export type TaskPriority = Priority;

export type TaskIssueType = z.infer<typeof taskIssueTypeSchema>;
export type WorkItemIssueType = TaskIssueType;

export type TaskRelationType = z.infer<typeof taskRelationTypeSchema>;
export type WorkItemRelationType = TaskRelationType;

export type TaskRelation = z.infer<typeof taskRelationSchema>;
export type WorkItemRelation = TaskRelation;

export type WorkItemRecurrence = z.infer<typeof workItemRecurrenceSchema>;
export type TaskRecurrence = WorkItemRecurrence;

export type WorkItemReminder = z.infer<typeof workItemReminderSchema>;
export type TaskReminder = WorkItemReminder;

export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type Checklist = z.infer<typeof checklistSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemInputSchema>;
export type ChecklistInput = z.infer<typeof checklistInputSchema>;
export type WorkItemAttachment = z.infer<typeof workItemAttachmentSchema>;
export type TaskAttachment = WorkItemAttachment;
export type WorkItem = z.infer<typeof workItemSchema>;
export type Task = WorkItem;
export type WorkItemMutationInput = z.infer<typeof workItemMutationInputSchema>;
export type TaskMutationInput = WorkItemMutationInput;
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

export type WorkItemActivityLog = {
  id: string;
  taskId?: string;
  workItemId?: string;
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
export type TaskActivityLog = WorkItemActivityLog;

export type ProjectWorkItemsData = {
  tasks: WorkItem[];
  columns: Column[];
  projectName: string;
  cycles: Cycle[];
};
export type ProjectTasksData = ProjectWorkItemsData;

// ── UI States & Discriminated Unions ─────────────────────────────────────────

export type WorkItemViewMode = "board" | "list" | "calendar" | "table" | "split";
export type TaskViewMode = WorkItemViewMode;
export type TaskDetailDisplayMode = "side-peek" | "center" | "fullscreen";

export type WorkItemModalState =
  | { mode: "idle" }
  | { mode: "create"; columnId?: string; title?: string }
  | { mode: "edit"; task: WorkItem }
  | { mode: "delete"; task: WorkItem }
  | { mode: "transfer"; task: WorkItem }
  | { mode: "add-existing" };
export type TaskModalState = WorkItemModalState;

// ── Issue Type Configurations (Plane.so Style) ──────────────────────────────

export const ISSUE_TYPE_CONFIG: Record<
  TaskIssueType,
  { label: string; iconName: string; color: string; bgLight: string; badgeClass: string }
> = {
  task: {
    label: "Task",
    iconName: "CheckSquare",
    color: "#3B82F6",
    bgLight: "rgba(59, 130, 246, 0.12)",
    badgeClass: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  },
  bug: {
    label: "Bug",
    iconName: "Bug",
    color: "#EF4444",
    bgLight: "rgba(239, 68, 68, 0.12)",
    badgeClass: "text-red-500 bg-red-500/10 border-red-500/20",
  },
  feature: {
    label: "Feature",
    iconName: "Sparkles",
    color: "#8B5CF6",
    bgLight: "rgba(139, 92, 246, 0.12)",
    badgeClass: "text-purple-500 bg-purple-500/10 border-purple-500/20",
  },
  improvement: {
    label: "Improvement",
    iconName: "TrendingUp",
    color: "#10B981",
    bgLight: "rgba(16, 185, 129, 0.12)",
    badgeClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  epic: {
    label: "Epic",
    iconName: "Zap",
    color: "#F59E0B",
    bgLight: "rgba(245, 158, 11, 0.12)",
    badgeClass: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
};

export const RELATION_TYPE_CONFIG: Record<
  TaskRelationType,
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
    badgeColor: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  },
};

export const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13, 21] as const;

// ── Column Helpers ───────────────────────────────────────────────────────────

export function resolveWorkItemColumnId(column?: Pick<Column, "id"> | null): string {
  return column?.id ?? "";
}
export const resolveTaskColumnId = resolveWorkItemColumnId;

export const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "red" },
  high: { label: "High", color: "orange" },
  medium: { label: "Medium", color: "blue" },
  low: { label: "Low", color: "gray" },
  none: { label: "None", color: "transparent" },
} as const satisfies Record<Priority, { label: string; color: string }>;

export const FIXED_WORK_ITEM_COLUMNS: Column[] = [
  { id: "backlog", title: "Backlog", accentColor: "#6366F1" },
  { id: "todo", title: "To Do", accentColor: "#0EA5E9" },
  { id: "doing", title: "Doing", accentColor: "#F59E0B" },
  { id: "review", title: "Review", accentColor: "#EAB308" },
  { id: "done", title: "Done", accentColor: "#22C55E" },
];
export const DEFAULT_TASK_COLUMNS = FIXED_WORK_ITEM_COLUMNS;
export const FIXED_TASK_COLUMNS = FIXED_WORK_ITEM_COLUMNS;

export const DEFAULT_WORK_ITEM_COLUMN_COLORS: Record<string, string> = {
  backlog: "#6366F1",
  todo: "#0EA5E9",
  doing: "#F59E0B",
  in_progress: "#F59E0B",
  review: "#EAB308",
  done: "#22C55E",
  cancelled: "#94A3B8",
};
export const DEFAULT_TASK_COLUMN_COLORS = DEFAULT_WORK_ITEM_COLUMN_COLORS;

export function resolveWorkItemColumnColor(columnId: string, accentColor?: string): string {
  return accentColor || DEFAULT_WORK_ITEM_COLUMN_COLORS[columnId] || "#6B7280";
}
export const resolveTaskColumnColor = resolveWorkItemColumnColor;
