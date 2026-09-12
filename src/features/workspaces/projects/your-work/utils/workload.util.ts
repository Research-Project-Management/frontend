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
    color: 'bg-muted-foreground/60',
    hex: '#94a3b8',
    description: 'Items awaiting prioritization',
  },
  unstarted: {
    label: 'Not started',
    color: 'bg-muted-foreground',
    hex: '#525866',
    description: 'Items ready to be worked on',
  },
  started: {
    label: 'Working on',
    color: 'bg-amber-500',
    hex: '#f59e0b',
    description: 'Items actively in progress or review',
  },
  completed: {
    label: 'Completed',
    color: 'bg-emerald-500',
    hex: '#22c55e',
    description: 'Items completed and accepted',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-rose-500',
    hex: '#ef4444',
    description: 'Items abandoned or rejected',
  },
};

/**
 * Automatically infers the Flux state group from a state identifier or name.
 */
export function inferStateGroup(
  id?: string | null,
  name?: string | null,
): StateGroup {
  const combined = `${id || ''} ${name || ''}`.toLowerCase().trim();

  if (combined.includes('backlog')) {
    return 'backlog';
  }

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

