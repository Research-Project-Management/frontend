import type { YourWorkTask } from '../schemas/your-work.schema';

export interface ProjectInfo {
  id: string;
  name: string;
}

export type ProjectMap = Record<string, ProjectInfo>;

/**
 * Creates a lookup map from project ID to project metadata.
 */
export function createProjectMap(
  projects: Array<{ id: string; name: string }>,
): ProjectMap {
  const map: ProjectMap = {};
  projects.forEach((p) => {
    const pid = p.id;
    if (pid) {
      map[pid] = { id: pid, name: p.name };
    }
  });
  return map;
}

// Backward compatibility alias
export const createTaskProjectMap = createProjectMap;

/**
 * Safely extracts the project ID from a task or activity event.
 */
export function getTaskProjectId(task: any): string | null {
  if (!task) return null;
  if (typeof task.projectId === 'string' && task.projectId.trim().length > 0) {
    return task.projectId;
  }
  if (typeof task.projectId === 'object' && task.projectId !== null) {
    const pId = task.projectId.id;
    if (pId) return pId;
  }
  if (task.project) {
    if (typeof task.project === 'string') return task.project;
    const pId = task.project.id;
    if (pId) return pId;
  }
  return null;
}

/**
 * Resolves project name/info for a task using embedded task metadata or the workspace project map.
 */
export function getTaskProject(task: any, projectMap: ProjectMap = {}): ProjectInfo | null {
  if (!task) return null;

  // 1. Direct embedded project object with name
  if (task.project && typeof task.project === 'object' && task.project.name) {
    return {
      id: task.project.id || '',
      name: task.project.name,
    };
  }

  // 2. Embedded projectId object with name
  if (task.projectId && typeof task.projectId === 'object' && task.projectId.name) {
    return {
      id: task.projectId.id || '',
      name: task.projectId.name,
    };
  }

  // 3. Lookup in projectMap by extracted projectId
  const projectId = getTaskProjectId(task);
  if (projectId && projectMap[projectId]) {
    return projectMap[projectId];
  }

  return null;
}

export interface CategorizedTasksResult {
  assigned: YourWorkTask[];
  created: YourWorkTask[];
  subscribed: YourWorkTask[];
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
}

export function getDefaultStatusBreakdown(): Record<string, number> {
  return {
    backlog: 0,
    todo: 0,
    doing: 0,
    review: 0,
    done: 0,
    cancelled: 0,
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

/**
 * Categorizes a list of workspace tasks for a specific user into assigned, created, and subscribed,
 * alongside calculating status and priority distributions.
 */
export function categorizeTasks(
  tasks: any[] = [],
  currentUserId?: string | null,
): CategorizedTasksResult {
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

  const assigned: YourWorkTask[] = [];
  const created: YourWorkTask[] = [];
  const subscribed: YourWorkTask[] = [];

  tasks.forEach((t) => {
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
      const col = t.columnId || 'todo';
      statusBreakdown[col] = (statusBreakdown[col] || 0) + 1;

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
