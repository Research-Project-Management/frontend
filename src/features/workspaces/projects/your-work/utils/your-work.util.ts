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
export function getWorkItemProjectId(workItem: any): string | null {
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
export function getWorkItemProject(workItem: any, projectMap: ProjectMap = {}): ProjectInfo | null {
  if (!workItem) return null;

  // 1. Direct embedded project object with name
  if (workItem.project && typeof workItem.project === 'object' && workItem.project.name) {
    return {
      id: workItem.project.id || '',
      name: workItem.project.name,
      avatar: workItem.project.avatar || null,
    };
  }

  // 2. Embedded projectId object with name
  if (workItem.projectId && typeof workItem.projectId === 'object' && workItem.projectId.name) {
    return {
      id: workItem.projectId.id || '',
      name: workItem.projectId.name,
      avatar: (workItem.projectId as any).avatar || null,
    };
  }

  // 3. Lookup in projectMap by extracted projectId
  const projectId = getWorkItemProjectId(workItem);
  if (projectId && projectMap[projectId]) {
    return projectMap[projectId];
  }

  return null;
}

export interface CategorizedWorkItemsResult {
  assigned: YourWorkItem[];
  created: YourWorkItem[];
  subscribed: YourWorkItem[];
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
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

export function calculateStatusBreakdown(workItems: any[] = []): Record<string, number> {
  const breakdown = getDefaultStatusBreakdown();
  workItems.forEach((t) => {
    const rawCol = (t.columnId || 'todo').toLowerCase();
    const group = inferStateGroup(rawCol, rawCol);
    breakdown[group] = (breakdown[group] || 0) + 1;
    breakdown[rawCol] = (breakdown[rawCol] || 0) + 1;
  });
  return breakdown;
}

export function calculatePriorityBreakdown(workItems: any[] = []): Record<string, number> {
  const breakdown = getDefaultPriorityBreakdown();
  workItems.forEach((t) => {
    const prio = (t.priority || 'none').toLowerCase();
    breakdown[prio] = (breakdown[prio] || 0) + 1;
  });
  return breakdown;
}

/**
 * Categorizes a list of workspace work items for a specific user into assigned, created, and subscribed,
 * alongside calculating status and priority distributions.
 */
export function categorizeWorkItems(
  workItems: any[] = [],
  currentUserId?: string | null,
): CategorizedWorkItemsResult {
  const statusBreakdown = getDefaultStatusBreakdown();
  const priorityBreakdown = getDefaultPriorityBreakdown();

  if (!currentUserId) {
    return {
      assigned: [],
      created: [],
      subscribed: [],
      statusBreakdown,
      priorityBreakdown,
    };
  }

  const assigned: YourWorkItem[] = [];
  const created: YourWorkItem[] = [];
  const subscribed: YourWorkItem[] = [];

  workItems.forEach((t) => {
    const assigneeId =
      typeof t.assignee === 'object' && t.assignee !== null
        ? t.assignee?.id
        : t.assigneeId || t.assignee;

    const authorId =
      typeof t.author === 'object' && t.author !== null
        ? t.author?.id
        : t.authorId || t.author;

    const isAssignee = assigneeId === currentUserId;
    const isAuthor = authorId === currentUserId;
    const commentCount = t.commentCount ?? (Array.isArray(t.comments) ? t.comments.length : 0);

    if (isAssignee) {
      assigned.push(t);
      const rawCol = (t.columnId || 'todo').toLowerCase();
      const group = inferStateGroup(rawCol, rawCol);
      statusBreakdown[group] = (statusBreakdown[group] || 0) + 1;
      statusBreakdown[rawCol] = (statusBreakdown[rawCol] || 0) + 1;

      const prio = t.priority || 'none';
      priorityBreakdown[prio] = (priorityBreakdown[prio] || 0) + 1;
    }

    if (isAuthor) {
      created.push(t);
    }

    if (!isAssignee && !isAuthor && commentCount > 0) {
      subscribed.push(t);
    }
  });

  return {
    assigned,
    created,
    subscribed,
    statusBreakdown,
    priorityBreakdown,
  };
}



