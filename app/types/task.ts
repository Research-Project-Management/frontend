export type Column = {
  id: string;
  _id?: string;
  title: string;
  isDefault: boolean;
  accentColor?: string;
};

export const DEFAULT_TASK_COLUMN_IDS = [
  "backlog",
  "todo",
  "doing",
  "review",
  "done",
];

export const DEFAULT_TASK_COLUMN_COLORS: Record<string, string> = {
  backlog: "#6366F1",
  todo: "#0EA5E9",
  doing: "#F59E0B",
  review: "#EAB308",
  done: "#22C55E",
};

export type Priority = "urgent" | "high" | "medium" | "low" | "none";

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
    | "dueDate"
    | "labels"
    | "priority"
    | "estimate"
    | "rank"
  >
> & {
  assignee?: string | null;
  cycle?: string | null;
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
  topic_selection:   { label: "Topic Selection",       color: "#8b5cf6", icon: "🔍" },
  literature_review: { label: "Literature Review",     color: "#3b82f6", icon: "📚" },
  methodology:       { label: "Methodology",           color: "#06b6d4", icon: "⚙️" },
  data_collection:   { label: "Data Collection",       color: "#22c55e", icon: "📊" },
  data_analysis:     { label: "Data Analysis",         color: "#eab308", icon: "📈" },
  writing:           { label: "Writing",               color: "#f97316", icon: "✍️" },
  review_revision:   { label: "Review & Revision",     color: "#f43f5e", icon: "🔄" },
  submission:        { label: "Submission / Defense",   color: "#10b981", icon: "🎓" },
  custom:            { label: "Custom",                color: "#6b7280", icon: "📋" },
};

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: string }> = {
  urgent: { label: "Urgent", color: "#ef4444", icon: "🔴" },
  high:   { label: "High",   color: "#f97316", icon: "🟠" },
  medium: { label: "Medium", color: "#eab308", icon: "🟡" },
  low:    { label: "Low",    color: "#3b82f6", icon: "🔵" },
  none:   { label: "None",   color: "#6b7280", icon: "⚪" },
};
