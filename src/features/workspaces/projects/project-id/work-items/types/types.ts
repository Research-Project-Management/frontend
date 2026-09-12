import { z } from "zod";
import {
  prioritySchema,
  relationTypeSchema,
  relationSchema,
  stateGroupSchema,
  userMinimalSchema,
  cycleMinimalSchema,
  parentTaskMinimalSchema,
  subtaskItemSchema,
  attachPageSchema,
  attachPaperSchema,
  attachFileSchema,
  attachLinkSchema,
  attachmentsSchema,
  attachmentSchema,
  taskSchema,
  createTaskSchema,
  updateTaskSchema,
  reorderTaskSchema,
  bulkUpdateTaskSchema,
  createSubtaskSchema,
  taskMutationInputSchema,
  stateSchema,
  stateFormSchema,
  columnFormSchema,
  attachPageInputSchema,
  attachPaperInputSchema,
  attachFileInputSchema,
  attachLinkInputSchema,
  filtersSchema,
  recurrenceSchema,
  reminderSchema,
} from "../schemas/schema";

// ── Branded Identifier Types (Matt Pocock Pattern) ──────────────────────────

declare const __brand: unique symbol;
export type Brand<B> = { readonly [__brand]: B };

export type TaskId = string & Brand<'TaskId'>;
export type WorkItemId = TaskId;
export type ColumnId = string & Brand<'ColumnId'>;
export type ProjectId = string & Brand<'ProjectId'>;
export type CycleId = string & Brand<'CycleId'>;

// ── Domain Types (Inferred Directly from Zod - Single Source of Truth) ───────

export type Priority = z.infer<typeof prioritySchema>;
export type TaskPriority = Priority;
export type WorkItemPriority = Priority;

export type Recurrence = z.infer<typeof recurrenceSchema>;
export type TaskRecurrence = Recurrence;
export type WorkItemRecurrence = Recurrence;

export type Reminder = z.infer<typeof reminderSchema>;
export type TaskReminder = Reminder;
export type WorkItemReminder = Reminder;

export type RelationType = z.infer<typeof relationTypeSchema>;
export type TaskRelationType = RelationType;
export type WorkItemRelationType = RelationType;

export type Relation = z.infer<typeof relationSchema>;
export type TaskRelation = Relation;
export type WorkItemRelation = Relation;

export type Attachment = z.infer<typeof attachmentSchema>;
export type TaskAttachment = Attachment;
export type WorkItemAttachment = Attachment;

export type AttachPageItem = z.infer<typeof attachPageSchema>;
export type AttachPaperItem = z.infer<typeof attachPaperSchema>;
export type AttachFileItem = z.infer<typeof attachFileSchema>;
export type AttachLinkItem = z.infer<typeof attachLinkSchema>;
export type Attachments = z.infer<typeof attachmentsSchema>;
export type WorkItemAttachments = Attachments;

export type UserMinimal = z.infer<typeof userMinimalSchema>;
export type CycleMinimal = z.infer<typeof cycleMinimalSchema>;
export type ParentTaskMinimal = z.infer<typeof parentTaskMinimalSchema>;

export type SubtaskItem = z.infer<typeof subtaskItemSchema>;
export type SubtaskMinimal = SubtaskItem;

export type Task = z.infer<typeof taskSchema>;
export type WorkItem = Task;

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateWorkItemInput = CreateTaskInput;

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateWorkItemInput = UpdateTaskInput;

export type TaskMutationInput = z.infer<typeof taskMutationInputSchema>;
export type WorkItemMutationInput = TaskMutationInput;

export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;
export type ReorderWorkItemInput = ReorderTaskInput;

export type BulkUpdateTaskInput = z.infer<typeof bulkUpdateTaskSchema>;
export type BulkUpdateWorkItemInput = BulkUpdateTaskInput;

export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;

export type AttachPageInput = z.infer<typeof attachPageInputSchema>;
export type AttachPaperInput = z.infer<typeof attachPaperInputSchema>;
export type AttachFileInput = z.infer<typeof attachFileInputSchema>;
export type AttachLinkInput = z.infer<typeof attachLinkInputSchema>;

export type State = z.infer<typeof stateSchema>;
export type Column = State;
export type ColumnType = Column;
export type WorkItemState = State;
export type WorkItemStateSchema = State;

export type StateGroup = z.infer<typeof stateGroupSchema>;
export type StateForm = z.infer<typeof stateFormSchema>;
export type ColumnForm = z.infer<typeof columnFormSchema>;

export type Filters = z.infer<typeof filtersSchema>;
export type WorkItemFilters = Filters;

// ── Local Domain Entities (Self-contained) ──────────────────────────────────

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
  id?: string;
  userId?: string;
  role?: string;
  name?: string;
  avatar?: string;
  user?: {
    id?: string;
    name?: string;
    avatar?: string;
  };
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  avatar?: string | null;
  color?: string | null;
  status?: string;
  workspaceId?: string;
  members?: ProjectMember[];
  emoji?: string | null;
  icon?: string | null;
  [key: string]: unknown;
};

export type ActivityLog = {
  id: string;
  taskId?: string;
  workItemId?: string;
  action?: string;
  message?: string;
  type?: string;
  user?: {
    id?: string;
    name?: string;
    avatar?: string;
  } | null;
  author?: {
    id?: string;
    name?: string;
    avatar?: string;
  } | string | null;
  authorInitials?: string;
  avatarUrl?: string | null;
  content?: string;
  timestamp?: string;
  createdAt?: number | string;
  kind?: "comment" | "system" | "activity";
  reactions?: Record<string, string[]> | Array<{ emoji?: string } | string> | null;
  reactionEmoji?: string;
  metadata?: Record<string, unknown>;
  permissions?: {
    canEdit: boolean;
    canDelete: boolean;
  };
};
export type TaskActivityLog = ActivityLog;
export type WorkItemActivityLog = ActivityLog;

export type ProjectTasksData = {
  tasks: Task[];
  columns: Column[];
  states?: Column[];
  projectName?: string;
  cycles?: Cycle[];
};
export type ProjectWorkItemsData = ProjectTasksData;

// ── UI States & Discriminated Unions ─────────────────────────────────────────

export type ViewMode = "board" | "list" | "calendar" | "table" | "timeline" | "split";
export type TaskViewMode = ViewMode;
export type WorkItemViewMode = ViewMode;
export type TaskDetailDisplayMode = "side-peek" | "center" | "fullscreen";

export type ModalState =
  | { mode: "idle" }
  | { mode: "create"; columnId?: string; title?: string }
  | { mode: "edit"; task: Task }
  | { mode: "delete"; task: Task }
  | { mode: "transfer"; task: Task }
  | { mode: "add-existing" };
export type TaskModalState = ModalState;
export type WorkItemModalState = ModalState;

// ── Relation Type Configurations ──────────────────────────────────────────

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
    badgeColor: "text-muted-foreground bg-muted border-border",
  },
};

// ── State Groups & Workflow States ──────────────────────────────────────────

export const STATE_GROUPS: readonly StateGroup[] = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
] as const;

export const STATE_GROUP_CONFIG: Record<
  StateGroup,
  { label: string; defaultColor: string; description: string }
> = {
  backlog: {
    label: "Backlog",
    defaultColor: "#8A9093",
    description: "Unprioritized items awaiting scheduling",
  },
  unstarted: {
    label: "To Do",
    defaultColor: "#525866",
    description: "Prioritized items ready for the active cycle",
  },
  started: {
    label: "In Progress",
    defaultColor: "#F59E0B",
    description: "Items actively being worked on",
  },
  completed: {
    label: "Done",
    defaultColor: "#10B981",
    description: "Finished and accepted items",
  },
  cancelled: {
    label: "Cancelled",
    defaultColor: "#EF4444",
    description: "Abandoned, duplicate, or rejected items",
  },
};

export const DEFAULT_STATES: State[] = [
  {
    id: "backlog",
    name: "Backlog",
    title: "Backlog",
    group: "backlog",
    color: "#8A9093",
    accentColor: "#8A9093",
    sequence: 1000,
    isDefault: true,
    description: "Items awaiting prioritization and scheduling",
  },
  {
    id: "todo",
    name: "To Do",
    title: "To Do",
    group: "unstarted",
    color: "#525866",
    accentColor: "#525866",
    sequence: 2000,
    isDefault: false,
    description: "Items ready to be worked on in the current cycle",
  },
  {
    id: "in_progress",
    name: "In Progress",
    title: "In Progress",
    group: "started",
    color: "#F59E0B",
    accentColor: "#F59E0B",
    sequence: 3000,
    isDefault: false,
    description: "Items actively being worked on by assignees",
  },
  {
    id: "done",
    name: "Done",
    title: "Done",
    group: "completed",
    color: "#10B981",
    accentColor: "#10B981",
    sequence: 4000,
    isDefault: false,
    description: "Items completed and accepted",
  },
  {
    id: "cancelled",
    name: "Cancelled",
    title: "Cancelled",
    group: "cancelled",
    color: "#EF4444",
    accentColor: "#EF4444",
    sequence: 5000,
    isDefault: false,
    description: "Items abandoned, duplicate, or rejected",
  },
];
export const DEFAULT_WORK_ITEM_STATES = DEFAULT_STATES;

export const DEFAULT_STATE_COLORS: Record<string, string> = {
  backlog: "#8A9093",
  todo: "#525866",
  unstarted: "#525866",
  in_progress: "#F59E0B",
  started: "#F59E0B",
  done: "#10B981",
  completed: "#10B981",
  cancelled: "#EF4444",
};

export const FIXED_COLUMNS: Column[] = [
  { id: "backlog", name: "Backlog", title: "Backlog", accentColor: "#8A9093", color: "#8A9093", group: "backlog", sequence: 1000, isDefault: true },
  { id: "todo", name: "To Do", title: "To Do", accentColor: "#525866", color: "#525866", group: "unstarted", sequence: 2000, isDefault: false },
  { id: "doing", name: "In Progress", title: "In Progress", accentColor: "#F59E0B", color: "#F59E0B", group: "started", sequence: 3000, isDefault: false },
  { id: "done", name: "Done", title: "Done", accentColor: "#10B981", color: "#10B981", group: "completed", sequence: 4000, isDefault: false },
  { id: "cancelled", name: "Cancelled", title: "Cancelled", accentColor: "#EF4444", color: "#EF4444", group: "cancelled", sequence: 5000, isDefault: false },
];
export const FIXED_TASK_COLUMNS = FIXED_COLUMNS;
export const FIXED_WORK_ITEM_COLUMNS = FIXED_COLUMNS;

export const DEFAULT_COLUMN_COLORS: Record<string, string> = {
  backlog: "#8A9093",
  todo: "#525866",
  doing: "#F59E0B",
  done: "#10B981",
  cancelled: "#EF4444",
};
export const DEFAULT_TASK_COLUMN_COLORS = DEFAULT_COLUMN_COLORS;
export const DEFAULT_WORK_ITEM_COLUMN_COLORS = DEFAULT_COLUMN_COLORS;

export function resolveColumnId(column?: Pick<Column, "id"> | null): string {
  return column?.id ?? "";
}
export const resolveTaskColumnId = resolveColumnId;
export const resolveWorkItemColumnId = resolveColumnId;

export function resolveColumnColor(columnId?: string | Partial<State> | null, accentColor?: string): string {
  if (accentColor && accentColor !== "#6B7280" && accentColor !== "#6366F1" && accentColor !== "#0EA5E9") return accentColor;
  if (!columnId) return accentColor || "#8A9093";
  if (typeof columnId === "object") {
    const colObj = columnId as any;
    const group = colObj.group;
    const groupColor = group && group in DEFAULT_STATE_COLORS ? DEFAULT_STATE_COLORS[group] : undefined;
    const colAcc = colObj.accentColor || colObj.color;
    if (colAcc && colAcc !== "#6B7280" && colAcc !== "#6366F1" && colAcc !== "#0EA5E9") return colAcc;
    return groupColor || colAcc || accentColor || "#8A9093";
  }
  if (DEFAULT_COLUMN_COLORS[columnId]) return DEFAULT_COLUMN_COLORS[columnId];
  if (DEFAULT_STATE_COLORS[columnId]) return DEFAULT_STATE_COLORS[columnId];
  const lower = columnId.toLowerCase();
  if (lower.includes('backlog')) return '#8A9093';
  if (lower.includes('todo') || lower.includes('unstarted')) return '#525866';
  if (lower.includes('doing') || lower.includes('progress') || lower.includes('started')) return '#F59E0B';
  if (lower.includes('done') || lower.includes('complete')) return '#10B981';
  if (lower.includes('cancel')) return '#EF4444';
  return accentColor || "#8A9093";
}
export const resolveTaskColumnColor = resolveColumnColor;
export const resolveWorkItemColumnColor = resolveColumnColor;

// ── State & Column Resolvers ────────────────────────────────────────────────

export function resolveStateId(state?: Pick<State, "id"> | null): string {
  return state?.id ?? "";
}

export function resolveStateColor(state?: string | Partial<State> | null, customColor?: string): string {
  if (customColor && customColor !== "#6B7280" && customColor !== "#6366F1" && customColor !== "#0EA5E9") return customColor;
  if (!state) return "#8A9093";
  if (typeof state === "object") {
    const sObj = state as any;
    const group = sObj.group;
    const groupColor = group && group in DEFAULT_STATE_COLORS ? DEFAULT_STATE_COLORS[group] : undefined;
    const custom = sObj.accentColor || sObj.color;
    if (custom && custom !== "#6B7280" && custom !== "#6366F1" && custom !== "#0EA5E9") return custom;
    return (sObj.id ? DEFAULT_STATE_COLORS[sObj.id] : undefined) || groupColor || custom || customColor || "#8A9093";
  }
  if (DEFAULT_STATE_COLORS[state]) return DEFAULT_STATE_COLORS[state];
  if (DEFAULT_COLUMN_COLORS[state]) return DEFAULT_COLUMN_COLORS[state];
  const lower = state.toLowerCase();
  if (lower.includes('backlog')) return '#8A9093';
  if (lower.includes('todo') || lower.includes('unstarted')) return '#525866';
  if (lower.includes('doing') || lower.includes('progress') || lower.includes('started')) return '#F59E0B';
  if (lower.includes('done') || lower.includes('complete')) return '#10B981';
  if (lower.includes('cancel')) return '#EF4444';
  return customColor || "#8A9093";
}

export function resolveStateTitle(state?: Partial<State> | null): string {
  if (!state) return "";
  return state.name || state.title || state.id || "";
}

export function inferStateGroup(id?: string | null, name?: string | null): StateGroup {
  const combined = `${id || ''} ${name || ''}`.toLowerCase().trim();
  if (combined.includes('backlog')) return 'backlog';
  if (
    combined.includes('done') ||
    combined.includes('completed') ||
    combined.includes('complete') ||
    combined.includes('closed') ||
    combined.includes('resolved')
  ) {
    return 'completed';
  }
  if (
    combined.includes('cancel') ||
    combined.includes('rejected') ||
    combined.includes('abandon') ||
    combined.includes('wontfix') ||
    combined.includes("won't fix")
  ) {
    return 'cancelled';
  }
  if (
    combined.includes('doing') ||
    combined.includes('progress') ||
    combined.includes('started') ||
    combined.includes('review') ||
    combined.includes('testing') ||
    combined.includes('qa') ||
    combined.includes('dev')
  ) {
    return 'started';
  }
  return 'unstarted';
}

export function normalizeStates(raw: unknown): Column[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_STATES];
  }
  const result: Column[] = raw.map((item, index) => {
    const rawObj = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const rawId = typeof rawObj.id === 'string' && rawObj.id.trim() ? rawObj.id.trim() : `state-${index + 1}`;
    const rawName =
      typeof rawObj.name === 'string' && rawObj.name.trim()
        ? rawObj.name.trim()
        : typeof rawObj.title === 'string' && rawObj.title.trim()
          ? rawObj.title.trim()
          : rawId;
    const group: StateGroup =
      typeof rawObj.group === 'string' && (STATE_GROUPS as readonly string[]).includes(rawObj.group)
        ? (rawObj.group as StateGroup)
        : inferStateGroup(rawId, rawName);
    const groupColorMap: Record<StateGroup, string> = {
      backlog: '#8A9093',
      unstarted: '#525866',
      started: '#F59E0B',
      completed: '#10B981',
      cancelled: '#EF4444',
    };
    const rawCustom = (rawObj.accentColor as string) || (rawObj.color as string);
    const customColor = (rawCustom === '#6366F1' || rawCustom === '#0EA5E9' || rawCustom === '#6B7280') ? undefined : rawCustom;
    const color = customColor || groupColorMap[group] || resolveStateColor(rawId, customColor);
    return {
      id: rawId,
      name: rawName,
      title: rawName,
      group,
      color,
      accentColor: color,
      sequence: typeof rawObj.sequence === 'number' && !isNaN(rawObj.sequence) ? rawObj.sequence : (index + 1) * 1000,
      isDefault: Boolean(rawObj.isDefault),
      description: typeof rawObj.description === 'string' ? rawObj.description : undefined,
    };
  });

  // Ensure default state uniqueness
  const defaultCount = result.filter((s) => s.isDefault).length;
  if (defaultCount === 0) {
    const preferred = result.find((s) => s.group === 'backlog') || result.find((s) => s.group === 'unstarted') || result[0];
    if (preferred) preferred.isDefault = true;
  } else if (defaultCount > 1) {
    let foundFirst = false;
    for (const s of result) {
      if (s.isDefault) {
        if (!foundFirst) foundFirst = true;
        else s.isDefault = false;
      }
    }
  }

  return result.sort((a, b) => a.sequence - b.sequence);
}
export const normalizeWorkItemStates = normalizeStates;

export const PRIORITY_CONFIG = {
  urgent: { label: "Urgent", color: "red" },
  high: { label: "High", color: "orange" },
  medium: { label: "Medium", color: "blue" },
  low: { label: "Low", color: "gray" },
  none: { label: "None", color: "transparent" },
} as const satisfies Record<Priority, { label: string; color: string }>;

// ── Display Options & Filter Types ──────────────────────────────────────────

export type DisplayPropertyKey =
  | 'id'
  | 'assignee'
  | 'startDate'
  | 'dueDate'
  | 'labels'
  | 'priority'
  | 'state'
  | 'subtaskCount'
  | 'subWorkItemCount'
  | 'attachmentCount'
  | 'link'
  | 'dependencies'
  | 'attach'
  | 'cycle';

export type GroupByOption =
  | 'state'
  | 'priority'
  | 'cycle'
  | 'attach'
  | 'labels'
  | 'assignee'
  | 'createdBy'
  | 'none';

export type SubGroupByOption =
  | 'priority'
  | 'cycle'
  | 'attach'
  | 'labels'
  | 'assignee'
  | 'createdBy'
  | 'none';

export type OrderByOption =
  | 'manual'
  | 'createdAt'
  | 'updatedAt'
  | 'startDate'
  | 'dueDate'
  | 'priority';

export type OrderDirection = 'asc' | 'desc';

export interface DisplayOptions {
  properties: Record<DisplayPropertyKey, boolean>;
  groupBy: GroupByOption;
  subGroupBy: SubGroupByOption;
  orderBy: OrderByOption;
  orderDirection: OrderDirection;
  showEmptyGroups: boolean;
  showSubtasks: boolean;
  showSubWorkItems?: boolean;
}
export type WorkItemDisplayOptions = DisplayOptions;

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  properties: {
    id: true,
    assignee: true,
    startDate: false,
    dueDate: false,
    labels: true,
    priority: true,
    state: true,
    subtaskCount: false,
    subWorkItemCount: false,
    attachmentCount: false,
    link: false,
    dependencies: true,
    attach: false,
    cycle: false,
  },
  groupBy: 'state',
  subGroupBy: 'none',
  orderBy: 'manual',
  orderDirection: 'asc',
  showEmptyGroups: true,
  showSubtasks: true,
  showSubWorkItems: true,
};
export const DEFAULT_WORK_ITEM_DISPLAY_OPTIONS = DEFAULT_DISPLAY_OPTIONS;

export type DueDateFilterOption = 'all' | 'overdue' | 'this_week' | 'no_date';

// ── Default Filters ─────────────────────────────────────────────────────────

export const DEFAULT_FILTERS: Filters = {
  search: '',
  state: [],
  state_group: [],
  priority: [],
  assignees: [],
  mentions: [],
  created_by: [],
  labels: [],
  cycle: [],
  attach: [],
  work_items: [],
  tasks: [],
  parent: [],
  due_date: [],
  start_date: [],
  created_at: [],
  updated_at: [],
};
export const DEFAULT_WORK_ITEM_FILTERS = DEFAULT_FILTERS;
