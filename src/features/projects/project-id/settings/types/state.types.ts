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
    defaultColor: "#8A9093",
    defaultIcon: "circle-dashed",
    description: "Unprioritized items awaiting scheduling",
  },
  unstarted: {
    label: "Unstarted",
    defaultColor: "#525866",
    defaultIcon: "circle",
    description: "Prioritized items ready for work",
  },
  started: {
    label: "Started",
    defaultColor: "#EAB308",
    defaultIcon: "circle-dot",
    description: "Items actively being worked on",
  },
  completed: {
    label: "Completed",
    defaultColor: "#10B981",
    defaultIcon: "check-circle",
    description: "Finished and accepted items",
  },
  cancelled: {
    label: "Cancelled",
    defaultColor: "#8A9093",
    defaultIcon: "x-circle",
    description: "Abandoned, duplicate, or rejected items",
  },
};

export const DEFAULT_WORK_ITEM_STATES: WorkItemState[] = [
  { id: 'backlog', name: 'Backlog', title: 'Backlog', group: 'backlog', color: '#8A9093', accentColor: '#8A9093', icon: 'circle-dashed', sequence: 0, isDefault: true },
  { id: 'todo', name: 'Todo', title: 'Todo', group: 'unstarted', color: '#525866', accentColor: '#525866', icon: 'circle', sequence: 1, isDefault: false },
  { id: 'in_progress', name: 'In Progress', title: 'In Progress', group: 'started', color: '#EAB308', accentColor: '#EAB308', icon: 'circle-dot', sequence: 2, isDefault: false },
  { id: 'done', name: 'Done', title: 'Done', group: 'completed', color: '#10B981', accentColor: '#10B981', icon: 'check-circle', sequence: 3, isDefault: false },
  { id: 'cancelled', name: 'Cancelled', title: 'Cancelled', group: 'cancelled', color: '#8A9093', accentColor: '#8A9093', icon: 'x-circle', sequence: 4, isDefault: false },
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
