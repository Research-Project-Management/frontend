export type StateGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';

export interface WorkItemState {
  id: string;
  projectId?: string;
  name: string;
  color: string;
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
  group: StateGroup;
  sequence?: number;
  isDefault?: boolean;
  description?: string;
}

export interface UpdateStateInput {
  name?: string;
  color?: string;
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

export const DEFAULT_WORK_ITEM_STATES: WorkItemState[] = [
  { id: 'backlog', name: 'Backlog', title: 'Backlog', group: 'backlog', color: '#6366F1', accentColor: '#6366F1', sequence: 0, isDefault: true },
  { id: 'todo', name: 'To Do', title: 'To Do', group: 'unstarted', color: '#0EA5E9', accentColor: '#0EA5E9', sequence: 1, isDefault: false },
  { id: 'in_progress', name: 'In Progress', title: 'Doing', group: 'started', color: '#F59E0B', accentColor: '#F59E0B', sequence: 2, isDefault: false },
  { id: 'done', name: 'Done', title: 'Done', group: 'completed', color: '#22c55e', accentColor: '#22c55e', sequence: 3, isDefault: false },
  { id: 'cancelled', name: 'Cancelled', title: 'Cancelled', group: 'cancelled', color: '#94a3b8', accentColor: '#94a3b8', sequence: 4, isDefault: false },
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
