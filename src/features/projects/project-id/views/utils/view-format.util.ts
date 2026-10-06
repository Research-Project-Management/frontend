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
      color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    });
  }

  // State Group
  if (Array.isArray(filters.state_group) && filters.state_group.length > 0) {
    badges.push({
      label: 'State',
      value: filters.state_group.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', '),
      color: 'bg-primary-subtle text-primary border-primary/30',
    });
  }

  // Specific States
  if (Array.isArray(filters.state) && filters.state.length > 0) {
    badges.push({
      label: 'Status',
      value: `${filters.state.length} selected`,
      color: 'bg-muted text-foreground border-border',
    });
  }

  // Assignees
  if (Array.isArray(filters.assignees) && filters.assignees.length > 0) {
    badges.push({
      label: 'Assignees',
      value: `${filters.assignees.length} members`,
      color: 'bg-muted text-foreground border-border',
    });
  }

  // Labels
  if (Array.isArray(filters.labels) && filters.labels.length > 0) {
    badges.push({
      label: 'Labels',
      value: `${filters.labels.length} tags`,
      color: 'bg-muted text-foreground border-border',
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
