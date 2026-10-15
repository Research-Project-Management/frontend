import type { YourWorkItem } from '../schemas/your-work.schema';
import { inferStateGroup } from './workload.util';

export interface ProjectInfo {
  id: string;
  name: string;
  avatar?: string | null;
}

export type ProjectMap = Record<string, ProjectInfo>;

/**
 * Creates a lookup map from project ID to project metadata.
 */
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

/**
 * Safely extracts the project ID from a work item or activity event.
 */
export function getWorkItemProjectId(workItem: YourWorkItem | { projectId?: string | { id?: string } | null; project?: string | { id?: string } | null } | null | undefined): string | null {
  if (!workItem) return null;
  if (typeof workItem.projectId === 'string' && workItem.projectId.trim().length > 0) {
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

/**
 * Resolves project name/info for a work item using embedded metadata or the workspace project map.
 */
export function getWorkItemProject(workItem: YourWorkItem | Record<string, unknown> | null | undefined, projectMap: ProjectMap = {}): ProjectInfo | null {
  if (!workItem) return null;

  // 1. Direct embedded project object with name
  const projEmbed = (workItem as { project?: { id?: string; name?: string; avatar?: string | null } }).project;
  if (projEmbed && typeof projEmbed === 'object' && projEmbed.name) {
    return {
      id: projEmbed.id || '',
      name: projEmbed.name,
      avatar: projEmbed.avatar || null,
    };
  }

  // 2. Embedded projectId object with name
  if (workItem.projectId && typeof workItem.projectId === 'object' && 'name' in workItem.projectId && workItem.projectId.name) {
    const projObj = workItem.projectId as Record<string, unknown>;
    return {
      id: typeof projObj.id === 'string' ? projObj.id : '',
      name: String(projObj.name),
      avatar: typeof projObj.avatar === 'string' ? projObj.avatar : null,
    };
  }

  // 3. Lookup in projectMap by extracted projectId
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

export function calculateStatusBreakdown(workItems: YourWorkItem[] = []): Record<string, number> {
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
    const explicitGroup = (t as Record<string, unknown>).stateGroup as string | undefined;
    const group =
      explicitGroup || rawStateObj?.group || inferStateGroup(rawCol, rawStateObj?.name || rawCol);
    breakdown[group] = (breakdown[group] || 0) + 1;
    if (rawCol !== group) {
      breakdown[rawCol] = (breakdown[rawCol] || 0) + 1;
    }
  });
  return breakdown;
}

export const calculateStateBreakdown = calculateStatusBreakdown;

export function calculatePriorityBreakdown(workItems: YourWorkItem[] = []): Record<string, number> {
  const breakdown = getDefaultPriorityBreakdown();
  workItems.forEach((t) => {
    const prio = (t.priority || 'none').toLowerCase();
    breakdown[prio] = (breakdown[prio] || 0) + 1;
  });
  return breakdown;
}

export type TriageItemCandidate = YourWorkItem & {
  assigneeIds?: string[];
  assignees?: Array<{ id?: string; userId?: string } | string>;
  subscriberIds?: string[];
  subscribers?: Array<{ id?: string; userId?: string } | string>;
  createdBy?: string | { id?: string };
  stateGroup?: string;
  state?: { id?: string; name?: string; group?: string } | string | null;
};

/**
 * Checks if a work item is assigned to the target user across all supported schema shapes:
 * - assigneeId (string or object)
 * - assignee.id
 * - assigneeIds[]
 * - assignees[]
 */
export function isAssignedToUser(item: TriageItemCandidate | null | undefined, userId?: string | null): boolean {
  if (!item || !userId) return false;
  if (item.assigneeId === userId) return true;
  if (typeof item.assignee === 'string' && item.assignee === userId) return true;
  if (item.assignee && typeof item.assignee === 'object' && item.assignee.id === userId) return true;
  if (Array.isArray(item.assigneeIds) && item.assigneeIds.includes(userId)) return true;
  if (Array.isArray(item.assignees)) {
    for (const a of item.assignees) {
      if (typeof a === 'string' && a === userId) return true;
      if (a && typeof a === 'object' && (a.id === userId || a.userId === userId)) return true;
    }
  }
  return false;
}

/**
 * Checks if a work item was created by the target user.
 */
export function isCreatedByUser(item: TriageItemCandidate | null | undefined, userId?: string | null): boolean {
  if (!item || !userId) return false;
  if (item.authorId === userId) return true;
  if (typeof item.author === 'string' && item.author === userId) return true;
  if (item.author && typeof item.author === 'object' && item.author.id === userId) return true;
  if (typeof item.createdBy === 'string' && item.createdBy === userId) return true;
  if (item.createdBy && typeof item.createdBy === 'object' && item.createdBy.id === userId) return true;
  return false;
}

/**
 * Checks if the target user is subscribed to a work item via subscriberIds[] or subscribers[].
 */
export function isSubscribedByUser(item: TriageItemCandidate | null | undefined, userId?: string | null): boolean {
  if (!item || !userId) return false;
  if (Array.isArray(item.subscriberIds) && item.subscriberIds.includes(userId)) return true;
  if (Array.isArray(item.subscribers)) {
    for (const s of item.subscribers) {
      if (typeof s === 'string' && s === userId) return true;
      if (s && typeof s === 'object' && (s.id === userId || s.userId === userId)) return true;
    }
  }
  return false;
}

/**
 * Categorizes a raw list of work items into assigned, created, and subscribed buckets for a user.
 */
export function categorizeWorkItemsForUser<T extends TriageItemCandidate>(
  items: T[] = [],
  userId?: string | null,
): {
  assigned: T[];
  created: T[];
  subscribed: T[];
} {
  if (!userId || !Array.isArray(items)) {
    return { assigned: [], created: [], subscribed: [] };
  }
  const assigned: T[] = [];
  const created: T[] = [];
  const subscribed: T[] = [];

  for (const item of items) {
    if (!item) continue;
    if (isAssignedToUser(item, userId)) assigned.push(item);
    if (isCreatedByUser(item, userId)) created.push(item);
    if (isSubscribedByUser(item, userId)) subscribed.push(item);
  }

  return { assigned, created, subscribed };
}

export interface YourWorkSummaryStats {
  total: number;
  completed: number;
  cancelled: number;
  inProgress: number;
  unstarted: number;
  backlog: number;
  overdue: number;
  dueSoon: number;
  completionRate: number;
}

/**
 * Computes personal triage summary metrics including Overdue, Due Soon (7-day window), and Completed counts.
 * Explicitly excludes DONE (completed) and CANCELLED items from overdue and dueSoon counts.
 */
export function calculateSummaryStats(
  workItems: TriageItemCandidate[] = [],
  referenceDate: Date = new Date(),
  dueSoonDaysWindow = 7,
): YourWorkSummaryStats {
  const todayStart = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
  const dueSoonEnd =
    todayStart + (dueSoonDaysWindow + 1) * 24 * 60 * 60 * 1000 - 1;

  let completed = 0;
  let cancelled = 0;
  let inProgress = 0;
  let unstarted = 0;
  let backlog = 0;
  let overdue = 0;
  let dueSoon = 0;

  for (const item of workItems) {
    if (!item) continue;
    const stateObj = item.state && typeof item.state === 'object' ? item.state : null;
    const legacyState = typeof item.state === 'string' ? item.state : undefined;
    const rawCol = (item.columnId || stateObj?.id || legacyState || 'todo').toLowerCase();
    const rawName = stateObj?.name || rawCol;
    const group =
      item.stateGroup ||
      stateObj?.group ||
      (item.completed ? 'completed' : inferStateGroup(rawCol, rawName));

    const isDone = Boolean(item.completed || group === 'completed');
    const isCancelled = Boolean(group === 'cancelled');

    if (isDone) {
      completed++;
    } else if (isCancelled) {
      cancelled++;
    } else if (group === 'started') {
      inProgress++;
    } else if (group === 'backlog') {
      backlog++;
    } else {
      unstarted++;
    }

    // DONE and CANCELLED items must never be counted as overdue or dueSoon
    if (!isDone && !isCancelled && item.dueDate) {
      const dueMs = Date.parse(String(item.dueDate));
      if (!Number.isNaN(dueMs)) {
        if (dueMs < todayStart) {
          overdue++;
        } else if (dueMs >= todayStart && dueMs <= dueSoonEnd) {
          dueSoon++;
        }
      }
    }
  }

  const total = workItems.length;
  const activeDenominator = total - cancelled;
  const completionRate =
    activeDenominator > 0 ? Math.round((completed / activeDenominator) * 100) : 0;

  return {
    total,
    completed,
    cancelled,
    inProgress,
    unstarted,
    backlog,
    overdue,
    dueSoon,
    completionRate,
  };
}

