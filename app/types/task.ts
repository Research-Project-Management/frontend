export type Column = {
  id: string;
  _id?: string;
  title: string;
  accentColor?: string;
};

export function resolveTaskColumnId(column?: Pick<Column, "id" | "_id"> | null) {
  return column?.id ?? column?._id ?? "";
}

export type TaskLabel = {
  id: string;
  color: string;
  title: string;
};


export const DEFAULT_TASK_COLUMN_COLORS: Record<string, string> = {
  backlog: "#6366F1",
  todo: "#0EA5E9",
  doing: "#F59E0B",
  review: "#EAB308",
  done: "#22C55E",
};

export function resolveTaskColumnColor(columnId: string, accentColor?: string) {
  return DEFAULT_TASK_COLUMN_COLORS[columnId] || accentColor || "#6B7280";
}

export type Priority = "urgent" | "high" | "medium" | "low" | "none";
export type TaskRecurrence =
  | "none"
  | "daily"
  | "mon-fri"
  | "weekly"
  | "monthly-day"
  | "monthly-week";

export type TaskReminder =
  | "none"
  | "at-time"
  | "5m"
  | "10m"
  | "15m"
  | "1h"
  | "2h"
  | "1day"
  | "2day";

export type ChecklistItem = {
  _id: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
  dueDate?: string | null;
};

export type Checklist = {
  _id: string;
  title: string;
  items: ChecklistItem[];
};

export type ChecklistItemInput = {
  title: string;
  completed: boolean;
  assigneeId?: string;
  dueDate?: string | null;
};

export type ChecklistInput = {
  title: string;
  items: ChecklistItemInput[];
};

export type Task = {
  _id: string;
  title: string;
  content: string;
  description: string;
  project: string;
  columnId: string;
  assignee?: {
    _id: string;
    name: string;
    avatar?: string;
  } | null;
  dueDate?: string | null;
  startDate?: string | null;
  labels: string[];
  rank: number;
  author: string;
  priority: Priority;
  estimate?: number;
  cycle?: {
    _id: string;
    name: string;
    phase: CyclePhase;
    status: CycleStatus;
  } | null;
  parentTask?: {
    _id: string;
    title: string;
    identifier: string;
  } | null;
  identifier: string;
  recurrence?: TaskRecurrence;
  reminder?: TaskReminder;
  checklists?: Checklist[];
  completed: boolean;
  commentCount?: number;
  isOverdue?: boolean;
  dueState?: "none" | "onTime" | "overdue";
  permissions?: {
    canEdit: boolean;
    canMove: boolean;
    canDelete: boolean;
    canDuplicate: boolean;
  };
  attachments: {
    id: string;
    name: string;
    type: string;
    size: string;
    createdAt: string;
    url: string;
  }[];
  createdAt: string;
  updatedAt: string;
};

export type TaskMutationInput = Partial<
  Pick<
    Task,
    | "title"
    | "content"
    | "description"
    | "columnId"
    | "labels"
    | "priority"
    | "estimate"
    | "rank"
    | "recurrence"
    | "reminder"
    | "completed"
    | "commentCount"
    | "attachments"
  >
> & {
  dueDate?: string | null;
  startDate?: string | null;
  assignee?: string | null;
  cycle?: string | null;
  checklists?: ChecklistInput[];
  parentTask?: string | null;
};

export type CyclePhase = string;
/*
  | "topic_selection"
  | "literature_review"
  | "methodology"
  | "data_collection"
  | "data_analysis"
  | "writing"
  | "review_revision"
  | "submission";
*/

export type CycleStatus = "planned" | "active" | "completed" | "cancelled";

export type CycleMilestone = {
  _id?: string;
  title: string;
  dueDate?: string | null;
  completed: boolean;
};

export type CycleDeliverable = {
  _id?: string;
  title: string;
  fileId?: { _id: string; filename: string; url: string } | null;
  completed: boolean;
};

export type Cycle = {
  _id: string;
  name: string;
  description: string;
  project: string;
  startDate?: string | null;
  endDate?: string | null;
  status: CycleStatus;
  phase: CyclePhase;
  milestones: CycleMilestone[];
  deliverables: CycleDeliverable[];
  labels?: string[];
  ended_at?: string;
  order: number;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export const PHASE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  topic_selection: { label: "Topic Selection", color: "#8b5cf6", icon: "🔍" },
  literature_review: { label: "Literature Review", color: "#3b82f6", icon: "📚" },
  methodology: { label: "Methodology", color: "#06b6d4", icon: "⚙️" },
  data_collection: { label: "Data Collection", color: "#22c55e", icon: "📊" },
  data_analysis: { label: "Data Analysis", color: "#eab308", icon: "📈" },
  writing: { label: "Writing", color: "#f97316", icon: "✍️" },
  review_revision: { label: "Review & Revision", color: "#f43f5e", icon: "🔄" },
  submission: { label: "Submission / Defense", color: "#10b981", icon: "🎓" },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: string }> = {
  urgent: { label: "Urgent", color: "#ef4444", icon: "🔴" },
  high: { label: "High", color: "#f97316", icon: "🟠" },
  medium: { label: "Medium", color: "#eab308", icon: "🟡" },
  low: { label: "Low", color: "#3b82f6", icon: "🔵" },
  none: { label: "None", color: "#6b7280", icon: "⚪" },
};

export type TaskActivityLog = {
  _id: string;
  task: string;
  project: string;
  actor: {
    _id: string;
    name: string;
    avatar?: string;
  };
  action:
  | "task_created"
  | "assignee_added"
  | "assignee_removed"
  | "assignee_changed"
  | "column_moved"
  | "attachments_changed"
  | "due_date_changed"
  | "completed_status_changed"
  | "checklist_changed";
  previous_value?: any;
  new_value?: any;
  description: string;
  createdAt: string;
  updatedAt: string;
};
