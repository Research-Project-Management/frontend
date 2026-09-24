import { formatDistanceToNow, parseISO } from 'date-fns';

export interface FilterBadgeItem {
  label: string;
  value: string;
  color?: string;
}

export function extractFilterBadges(filters?: Record<string, any>): FilterBadgeItem[] {
  if (!filters || typeof filters !== 'object') return [];

  const badges: FilterBadgeItem[] = [];

  // Priority
  if (Array.isArray(filters.priority) && filters.priority.length > 0) {
    badges.push({
      label: 'Priority',
      value: filters.priority.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(', '),
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    });
  }

  // State Group
  if (Array.isArray(filters.state_group) && filters.state_group.length > 0) {
    badges.push({
      label: 'State',
      value: filters.state_group.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', '),
      color: 'bg-primary/10 text-primary border-primary/20',
    });
  }

  // Specific States
  if (Array.isArray(filters.state) && filters.state.length > 0) {
    badges.push({
      label: 'Status',
      value: `${filters.state.length} selected`,
      color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    });
  }

  // Assignees
  if (Array.isArray(filters.assignees) && filters.assignees.length > 0) {
    badges.push({
      label: 'Assignees',
      value: `${filters.assignees.length} members`,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    });
  }

  // Cycles
  if (Array.isArray(filters.cycle) && filters.cycle.length > 0) {
    badges.push({
      label: 'Cycle',
      value: `${filters.cycle.length} cycles`,
      color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    });
  }

  // Labels
  if (Array.isArray(filters.labels) && filters.labels.length > 0) {
    badges.push({
      label: 'Labels',
      value: `${filters.labels.length} tags`,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    });
  }

  return badges;
}

export function formatViewDate(dateVal?: string | Date | null): string {
  if (!dateVal) return 'Recently';
  try {
    const d = typeof dateVal === 'string' ? parseISO(dateVal) : dateVal;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return 'Recently';
  }
}
