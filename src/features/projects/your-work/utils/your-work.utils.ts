import type { YourWorkItem } from '../schemas/your-work.schema';
import { inferStateGroup as inferCanonicalStateGroup } from '@/features/projects/project-id/work-items/utils/work-item.utils';

export type StateGroup =
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'cancelled';

export const STATE_GROUPS: readonly StateGroup[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'cancelled',
] as const;

export interface WorkloadStateItem {
  key: StateGroup;
  label: string;
  count: number;
  color: string;
  hex: string;
  description?: string;
}

export const STATE_GROUP_CONFIG: Record<
  StateGroup,
  { label: string; color: string; hex: string; description: string }
> = {
  backlog: {
    label: 'Backlog',
    color: 'bg-state-backlog',
    hex: '#6B7280',
    description: 'Items awaiting prioritization',
  },
  unstarted: {
    label: 'Not started',
    color: 'bg-state-unstarted',
    hex: '#94A3B8',
    description: 'Items ready to be worked on',
  },
  started: {
    label: 'Working on',
    color: 'bg-state-started',
    hex: '#D97706',
    description: 'Items actively in progress or review',
  },
  completed: {
    label: 'Completed',
    color: 'bg-state-completed',
    hex: '#1A7F37',
    description: 'Items completed and accepted',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-state-cancelled',
    hex: '#EF4444',
    description: 'Items abandoned or rejected',
  },
};

export function inferStateGroup(
  id?: string | null,
  name?: string | null,
): StateGroup {
  return inferCanonicalStateGroup(id, name);
}

export function getWorkloadStates(
  statusBreakdown: Record<string, number> = {},
): WorkloadStateItem[] {
  const backlogCount = statusBreakdown.backlog ?? 0;
  const unstartedCount =
    (statusBreakdown.unstarted ?? 0) || (statusBreakdown.todo ?? 0);
  const startedCount =
    (statusBreakdown.started ?? 0) ||
    ((statusBreakdown.doing ?? 0) +
      (statusBreakdown.review ?? 0) +
      (statusBreakdown.in_progress ?? 0));
  const completedCount =
    (statusBreakdown.completed ?? 0) || (statusBreakdown.done ?? 0);
  const cancelledCount = statusBreakdown.cancelled ?? 0;

  return [
    {
      key: 'backlog',
      label: STATE_GROUP_CONFIG.backlog.label,
      count: backlogCount,
      color: STATE_GROUP_CONFIG.backlog.color,
      hex: STATE_GROUP_CONFIG.backlog.hex,
      description: STATE_GROUP_CONFIG.backlog.description,
    },
    {
      key: 'unstarted',
      label: STATE_GROUP_CONFIG.unstarted.label,
      count: unstartedCount,
      color: STATE_GROUP_CONFIG.unstarted.color,
      hex: STATE_GROUP_CONFIG.unstarted.hex,
      description: STATE_GROUP_CONFIG.unstarted.description,
    },
    {
      key: 'started',
      label: STATE_GROUP_CONFIG.started.label,
      count: startedCount,
      color: STATE_GROUP_CONFIG.started.color,
      hex: STATE_GROUP_CONFIG.started.hex,
      description: STATE_GROUP_CONFIG.started.description,
    },
    {
      key: 'completed',
      label: STATE_GROUP_CONFIG.completed.label,
      count: completedCount,
      color: STATE_GROUP_CONFIG.completed.color,
      hex: STATE_GROUP_CONFIG.completed.hex,
      description: STATE_GROUP_CONFIG.completed.description,
    },
    {
      key: 'cancelled',
      label: STATE_GROUP_CONFIG.cancelled.label,
      count: cancelledCount,
      color: STATE_GROUP_CONFIG.cancelled.color,
      hex: STATE_GROUP_CONFIG.cancelled.hex,
      description: STATE_GROUP_CONFIG.cancelled.description,
    },
  ];
}

export interface ProjectInfo {
  id: string;
  name: string;
  avatar?: string | null;
}

export type ProjectMap = Record<string, ProjectInfo>;

export function createProjectMap(
  projects: Array<{ id: string; name: string; avatar?: string | null }>,
): ProjectMap {
  const map: ProjectMap = {};
  projects.forEach((p) => {
    const pid = p.id;
    if (pid) {
      map[pid] = { id: pid, name: p.name, avatar: p.avatar || null };
    }
  });
  return map;
}

export function getWorkItemProjectId(
  workItem:
    | YourWorkItem
    | {
        projectId?: string | { id?: string } | null;
        project?: string | { id?: string } | null;
      }
    | null
    | undefined,
): string | null {
  if (!workItem) return null;
  if (
    typeof workItem.projectId === 'string' &&
    workItem.projectId.trim().length > 0
  ) {
    return workItem.projectId;
  }
  if (typeof workItem.projectId === 'object' && workItem.projectId !== null) {
    const projectId = workItem.projectId.id;
    if (projectId) return projectId;
  }
  if (workItem.project) {
    if (typeof workItem.project === 'string') return workItem.project;
    const projectId = workItem.project.id;
    if (projectId) return projectId;
  }
  return null;
}

export function getWorkItemProject(
  workItem: YourWorkItem | Record<string, unknown> | null | undefined,
  projectMap: ProjectMap = {},
): ProjectInfo | null {
  if (!workItem) return null;

  const projEmbed = (
    workItem as {
      project?: { id?: string; name?: string; avatar?: string | null };
    }
  ).project;
  if (projEmbed && typeof projEmbed === 'object' && projEmbed.name) {
    return {
      id: projEmbed.id || '',
      name: projEmbed.name,
      avatar: projEmbed.avatar || null,
    };
  }

  if (
    workItem.projectId &&
    typeof workItem.projectId === 'object' &&
    'name' in workItem.projectId &&
    workItem.projectId.name
  ) {
    const projObj = workItem.projectId as Record<string, unknown>;
    return {
      id: typeof projObj.id === 'string' ? projObj.id : '',
      name: String(projObj.name),
      avatar: typeof projObj.avatar === 'string' ? projObj.avatar : null,
    };
  }

  const projectId = getWorkItemProjectId(workItem);
  if (projectId && projectMap[projectId]) {
    return projectMap[projectId];
  }

  return null;
}

export function getDefaultStatusBreakdown(): Record<string, number> {
  return {
    backlog: 0,
    unstarted: 0,
    started: 0,
    completed: 0,
    cancelled: 0,
    todo: 0,
    in_progress: 0,
    done: 0,
  };
}

export function getDefaultPriorityBreakdown(): Record<string, number> {
  return {
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  };
}

export function calculateStatusBreakdown(
  workItems: YourWorkItem[] = [],
): Record<string, number> {
  const breakdown = getDefaultStatusBreakdown();
  workItems.forEach((t) => {
    const rawStateObj = (t as Record<string, unknown>).state as
      | { id?: string; name?: string; group?: string }
      | undefined;
    const rawCol = (
      t.columnId ||
      rawStateObj?.id ||
      rawStateObj?.name ||
      'todo'
    ).toLowerCase();
    const explicitGroup = (t as Record<string, unknown>).stateGroup as
      | string
      | undefined;
    const group =
      explicitGroup ||
      rawStateObj?.group ||
      inferStateGroup(rawCol, rawStateObj?.name || rawCol);
    breakdown[group] = (breakdown[group] || 0) + 1;
    if (rawCol !== group) {
      breakdown[rawCol] = (breakdown[rawCol] || 0) + 1;
    }
  });
  return breakdown;
}

export function calculatePriorityBreakdown(
  workItems: YourWorkItem[] = [],
): Record<string, number> {
  const breakdown = getDefaultPriorityBreakdown();
  workItems.forEach((t) => {
    const prio = (t.priority || 'none').toLowerCase();
    breakdown[prio] = (breakdown[prio] || 0) + 1;
  });
  return breakdown;
}
