import type { YourWorkActivityEvent } from '../schemas/your-work.schema';

export type ActivityFilterOptions = {
  projectId?: string | null;
  type?: string | null;
  actorName?: string | null;
  search?: string | null;
};

/**
 * Resolves the numeric timestamp of a YourWorkActivityEvent for chronological sorting.
 */
export function getActivityTimestamp(
  event?: YourWorkActivityEvent | { time?: string; createdAt?: string | number } | null,
): number {
  if (!event) return 0;
  const raw =
    (event as { time?: string }).time ??
    (event as { createdAt?: string | number }).createdAt;
  if (typeof raw === 'number') return Number.isNaN(raw) ? 0 : raw;
  if (typeof raw === 'string' && raw.trim()) {
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

/**
 * Sorts activity events in descending (newest first) or ascending chronological order.
 */
export function sortActivities(
  activities: YourWorkActivityEvent[] = [],
  direction: 'desc' | 'asc' = 'desc',
): YourWorkActivityEvent[] {
  if (!Array.isArray(activities)) return [];
  const factor = direction === 'asc' ? 1 : -1;
  return [...activities].sort(
    (a, b) => (getActivityTimestamp(a) - getActivityTimestamp(b)) * factor,
  );
}

/**
 * Filters activity events by projectId, type, actorName, and text search.
 */
export function filterActivities(
  activities: YourWorkActivityEvent[] = [],
  options: ActivityFilterOptions = {},
): YourWorkActivityEvent[] {
  if (!Array.isArray(activities)) return [];
  const { projectId, type, actorName, search } = options;
  const searchLower = search?.trim().toLowerCase() || '';

  return activities.filter((act) => {
    if (!act) return false;

    if (projectId) {
      const actProjId =
        typeof act.project === 'object' && act.project !== null
          ? act.project.id
          : typeof act.project === 'string'
            ? act.project
            : undefined;
      if (actProjId !== projectId) return false;
    }

    if (type) {
      const actType = (act.type || '').toLowerCase();
      if (!actType.includes(type.toLowerCase())) return false;
    }

    if (actorName) {
      const resolvedActor = (act.actorName || act.user?.name || '').toLowerCase();
      if (resolvedActor !== actorName.toLowerCase()) return false;
    }

    if (searchLower) {
      const haystack = [
        act.actorName,
        act.user?.name,
        act.actionVerb,
        act.targetIdentifier,
        act.targetTitle,
        act.content,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }

    return true;
  });
}

/**
 * Filters and sorts activity events for the personal command center feed.
 */
export function filterAndSortActivities(
  activities: YourWorkActivityEvent[] = [],
  options: ActivityFilterOptions = {},
  direction: 'desc' | 'asc' = 'desc',
): YourWorkActivityEvent[] {
  return sortActivities(filterActivities(activities, options), direction);
}
