export type Column = {
  id: string;
  _id?: string;
  title: string;
  accentColor?: string;
};

export function resolveTaskColumnId(column?: Pick<Column, "id" | "_id"> | null) {
  return column?.id ?? column?._id ?? "";
}

// Đã loại bỏ DEFAULT_TASK_COLUMN_IDS vì không còn dùng

export type TaskLabel = {
  id: string;
  color: string;
  title: string;
};

export const INITIAL_LABEL_POOL: TaskLabel[] = [
  { id: "L1", color: "#4bce97", title: "" },
  { id: "L2", color: "#f5cd47", title: "" },
  { id: "L3", color: "#fea362", title: "" },
  { id: "L4", color: "#f87168", title: "" },
  { id: "L5", color: "#9f8fef", title: "" },
  { id: "L6", color: "#579dff", title: "" },
  { id: "L7", color: "#60c6d2", title: "" },
];

const TASK_LABEL_POOL_STORAGE_KEY = "flux.task.label-pool.v1";

function isTaskLabel(value: unknown): value is TaskLabel {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<TaskLabel>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0 &&
    typeof candidate.color === "string" &&
    candidate.color.trim().length > 0 &&
    typeof candidate.title === "string"
  );
}

export function getTaskLabelPool(): TaskLabel[] {
  if (typeof window === "undefined") return INITIAL_LABEL_POOL;

  try {
    const raw = window.localStorage.getItem(TASK_LABEL_POOL_STORAGE_KEY);
    if (!raw) return INITIAL_LABEL_POOL;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_LABEL_POOL;

    const customLabels = parsed.filter(isTaskLabel);
    if (customLabels.length === 0) return INITIAL_LABEL_POOL;

    const merged = new Map(INITIAL_LABEL_POOL.map((label) => [label.id, label]));
    for (const label of customLabels) {
      merged.set(label.id, label);
    }

    return Array.from(merged.values());
  } catch {
    return INITIAL_LABEL_POOL;
  }
}

export function persistTaskLabelPool(labelPool: TaskLabel[]) {
  if (typeof window === "undefined") return;

  try {
    const uniqueById = new Map<string, TaskLabel>();
    for (const label of labelPool) {
      if (!isTaskLabel(label)) continue;
      uniqueById.set(label.id, label);
    }

    const initialById = new Map(INITIAL_LABEL_POOL.map((label) => [label.id, label]));
    const customLabels = Array.from(uniqueById.values()).filter((label) => {
      const initial = initialById.get(label.id);
      if (!initial) return true;

      return initial.color !== label.color || initial.title !== label.title;
    });

    if (customLabels.length === 0) {
      window.localStorage.removeItem(TASK_LABEL_POOL_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(TASK_LABEL_POOL_STORAGE_KEY, JSON.stringify(customLabels));
  } catch {
    // Ignore persistence failures so task editing remains usable.
  }
}

export function resolveTaskLabels(labels: string[]): TaskLabel[] {
  const labelPool = getTaskLabelPool();

  return labels
    .map(
      (id) =>
        labelPool.find((label) => label.id === id) ?? {
          id,
          color: "#8590a2",
          title: "",
        }
    )
    .sort((a, b) => {
      const indexA = labelPool.findIndex((label) => label.id === a.id);
      const indexB = labelPool.findIndex((label) => label.id === b.id);

      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
}

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
  dueDate?: string;
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
  dueDate?: string;
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
  };
  dueDate?: string;
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
  startDate?: string;
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

export type CyclePhase =
  | "topic_selection"
  | "literature_review"
  | "methodology"
  | "data_collection"
  | "data_analysis"
  | "writing"
  | "review_revision"
  | "submission"
  | "custom";

export type CycleStatus = "planned" | "active" | "completed" | "cancelled";

export type CycleMilestone = {
  _id?: string;
  title: string;
  dueDate?: string;
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
  startDate?: string;
  endDate?: string;
  status: CycleStatus;
  phase: CyclePhase;
  milestones: CycleMilestone[];
  deliverables: CycleDeliverable[];
  members?: string[];
  labels?: string[];
  order: number;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
  stats?: {
    totalTasks: number;
    completedTasks: number;
    progress: number;
  };
  createdAt: string;
  updatedAt: string;
};

export const PHASE_CONFIG: Record<CyclePhase, { label: string; color: string; icon: string }> = {
  topic_selection: { label: "Topic Selection", color: "#8b5cf6", icon: "🔍" },
  literature_review: { label: "Literature Review", color: "#3b82f6", icon: "📚" },
  methodology: { label: "Methodology", color: "#06b6d4", icon: "⚙️" },
  data_collection: { label: "Data Collection", color: "#22c55e", icon: "📊" },
  data_analysis: { label: "Data Analysis", color: "#eab308", icon: "📈" },
  writing: { label: "Writing", color: "#f97316", icon: "✍️" },
  review_revision: { label: "Review & Revision", color: "#f43f5e", icon: "🔄" },
  submission: { label: "Submission / Defense", color: "#10b981", icon: "🎓" },
  custom: { label: "Custom", color: "#6b7280", icon: "📋" },
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
