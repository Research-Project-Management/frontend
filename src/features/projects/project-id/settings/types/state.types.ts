export type StateGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export interface WorkItemState {
  id: string;
  projectId?: string;
  name: string;
  color: string;
  icon?: string;
  group: StateGroup;
  sequence: number;
  isDefault: boolean;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // UI Display Aliases
  title?: string;
  accentColor?: string;
}

export interface CreateStateInput {
  name: string;
  color?: string;
  icon?: string;
  group: StateGroup;
  sequence?: number;
  isDefault?: boolean;
  description?: string;
}

export interface UpdateStateInput {
  name?: string;
  color?: string;
  icon?: string;
  group?: StateGroup;
  sequence?: number;
  isDefault?: boolean;
  description?: string;
}

export interface ReorderStateItem {
  id: string;
  sequence?: number;
  group?: StateGroup;
  title?: string;
  accentColor?: string;
}

export const STATE_GROUPS: readonly StateGroup[] = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
] as const;

export const STATE_GROUP_CONFIG: Record<
  StateGroup,
  { label: string; defaultColor: string; defaultIcon: string; description: string }
> = {
  backlog: {
    label: "Backlog",
    defaultColor: "#6B7280",
    defaultIcon: "circle-dashed",
    description: "Unprioritized items awaiting scheduling",
  },
  unstarted: {
    label: "Unstarted",
    defaultColor: "#94A3B8",
    defaultIcon: "circle",
    description: "Prioritized items ready for work",
  },
  started: {
    label: "Started",
    defaultColor: "#D97706",
    defaultIcon: "circle-dot",
    description: "Items actively being worked on",
  },
  completed: {
    label: "Completed",
    defaultColor: "#1A7F37",
    defaultIcon: "check-circle",
    description: "Finished and accepted items",
  },
  cancelled: {
    label: "Cancelled",
    defaultColor: "#9CA3AF",
    defaultIcon: "x-circle",
    description: "Work items that are abandoned, rejected, or won’t be done.",
  },
};

export const DEFAULT_WORK_ITEM_STATES: WorkItemState[] = [
  { id: 'backlog', name: 'Backlog', title: 'Backlog', group: 'backlog', color: '#6B7280', accentColor: '#6B7280', icon: 'circle-dashed', sequence: 0, isDefault: true },
  { id: 'todo', name: 'Todo', title: 'Todo', group: 'unstarted', color: '#94A3B8', accentColor: '#94A3B8', icon: 'circle', sequence: 1, isDefault: false },
  { id: 'in_progress', name: 'In Progress', title: 'In Progress', group: 'started', color: '#D97706', accentColor: '#D97706', icon: 'circle-dot', sequence: 2, isDefault: false },
  { id: 'done', name: 'Done', title: 'Done', group: 'completed', color: '#1A7F37', accentColor: '#1A7F37', icon: 'check-circle', sequence: 3, isDefault: false },
  { id: 'cancelled', name: 'Cancelled', title: 'Cancelled', group: 'cancelled', color: '#9CA3AF', accentColor: '#9CA3AF', icon: 'x-circle', sequence: 4, isDefault: false },
];

export function resolveStateTitle(state?: Partial<WorkItemState> | null): string {
  if (!state) return '';
  return state.name || state.title || '';
}

export function resolveStateColor(stateOrId?: Partial<WorkItemState> | string | null, customColor?: string): string {
  if (!stateOrId) return customColor || '#94a3b8';
  if (typeof stateOrId === 'string') {
    return customColor || '#94a3b8';
  }
  return stateOrId.color || stateOrId.accentColor || customColor || '#94a3b8';
}
