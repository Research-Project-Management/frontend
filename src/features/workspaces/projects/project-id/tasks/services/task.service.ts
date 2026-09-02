import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Task, TaskMutationInput, ProjectTasksData, Project, Cycle, Column } from "../types/task.types";

// ── Pure Task API Service (Self-contained) ──────────────────────────────────

export const TaskService = {
  getProjectTasks: (projectId: string, cycleId?: string) =>
    apiGet<ProjectTasksData>(`/api/project/${projectId}/tasks${cycleId ? `?cycle=${cycleId}` : ""}`),

  getWorkspaceTasks: async (workspaceId: string) => {
    const response = await apiGet<{ data: Task[] }>(`/api/workspace/${workspaceId}/tasks`);
    return response.data;
  },

  getWorkspaceProjects: (workspaceId: string) =>
    apiGet<{ data: Project[] } | Project[]>(`/api/workspace/${workspaceId}/projects`),

  getProjectDetails: (projectId: string) =>
    apiGet<{ project: Project }>(`/api/project/${projectId}`),

  create: ({ projectId, ...data }: { projectId: string } & TaskMutationInput) => {
    const allowed = [
      'title', 'content', 'description', 'columnId', 'assignee', 'assigneeId',
      'startDate', 'dueDate', 'priority', 'cycle', 'cycleId', 'parentTask',
      'parentTaskId', 'labels', 'checklists', 'issueType', 'storyPoints',
      'relations', 'recurrence', 'reminder', 'completed', 'rank',
    ];
    const cleanData: Record<string, any> = {};
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        cleanData[key] = (data as any)[key];
      }
    }
    return apiPost<{ task?: Task }>(`/api/project/${projectId}/tasks`, cleanData);
  },

  update: ({ taskId, projectId, ...data }: { taskId: string; projectId?: string } & TaskMutationInput) => {
    const allowed = [
      'title', 'content', 'description', 'columnId', 'assignee', 'assigneeId',
      'startDate', 'dueDate', 'priority', 'cycle', 'cycleId', 'parentTask',
      'parentTaskId', 'labels', 'checklists', 'issueType', 'storyPoints',
      'relations', 'recurrence', 'reminder', 'completed', 'rank',
    ];
    const cleanData: Record<string, any> = {};
    for (const key of allowed) {
      if ((data as any)[key] !== undefined) {
        cleanData[key] = (data as any)[key];
      }
    }
    const url = projectId ? `/api/project/${projectId}/tasks/${taskId}` : `/api/tasks/${taskId}`;
    return apiPut<{ task?: Task }>(url, cleanData);
  },

  delete: (taskId: string) =>
    apiDelete(`/api/tasks/${taskId}`),

  duplicate: ({ taskId, projectId }: { taskId: string; projectId: string }) =>
    apiPost<{ task?: Task }>(`/api/tasks/${taskId}/duplicate`, { projectId }),

  bulkUpdate: ({ taskIds, data, projectId }: { taskIds: string[]; data: any; projectId?: string }) =>
    projectId
      ? apiPut(`/api/project/${projectId}/tasks/bulk`, { taskIds, data })
      : apiPut(`/api/tasks/bulk`, { taskIds, data }),

  getProjectCycles: (projectId: string) =>
    apiGet<{ cycles: Cycle[] }>(`/api/project/${projectId}/cycles`),

  uploadAttachment: (taskId: string, formData: FormData) =>
    apiPost(`/api/tasks/${taskId}/attachments`, formData),

  deleteAttachment: (taskId: string, attachmentId: string) =>
    apiDelete(`/api/tasks/${taskId}/attachments/${attachmentId}`),

  getComments: (taskId: string) =>
    apiGet(`/api/tasks/${taskId}/comments`),

  addComment: (taskId: string, content: string) =>
    apiPost(`/api/tasks/${taskId}/comments`, { content }),

  deleteComment: (taskId: string, commentId: string) =>
    apiDelete(`/api/tasks/comments/${commentId}`),

  getActivityLogs: (taskId: string) =>
    apiGet(`/api/tasks/${taskId}/activity`),

  addColumn: (projectId: string, data: { title: string; accentColor?: string; id?: string }) =>
    apiPost<{ columns: Column[] }>(`/api/project/${projectId}/columns`, data),

  updateColumn: (projectId: string, columnId: string, data: { title?: string; accentColor?: string }) =>
    apiPut<{ columns: Column[] }>(`/api/project/${projectId}/columns/${columnId}`, data),

  deleteColumn: (projectId: string, columnId: string, targetColumnId?: string) =>
    apiDelete<{ columns: Column[]; fallbackColumnId?: string }>(
      `/api/project/${projectId}/columns/${columnId}${targetColumnId ? `?targetColumnId=${encodeURIComponent(targetColumnId)}` : ''}`,
    ),

  reorderColumns: (projectId: string, columns: Column[]) =>
    apiPut<{ columns: Column[] }>(`/api/project/${projectId}/columns`, { columns }),

  resetColumns: (projectId: string) =>
    apiPost<{ columns: Column[] }>(`/api/project/${projectId}/columns/reset`, {}),
};

// ── Backward-compatible Function Aliases ─────────────────────────────────────

export const fetchProjectTasks = TaskService.getProjectTasks;
export const fetchWorkspaceTasks = TaskService.getWorkspaceTasks;
