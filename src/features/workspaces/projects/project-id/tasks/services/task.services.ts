import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Task, Column, TaskMutationInput, ProjectTasksData } from "../types/task.types";

// ── Pure Task API Service ────────────────────────────────────────────────────

export const TaskService = {
  getProjectTasks: (projectId: string, cycleId?: string) =>
    apiGet<ProjectTasksData>(`/api/project/${projectId}/tasks${cycleId ? `?cycle=${cycleId}` : ""}`),

  getWorkspaceTasks: async (workspaceId: string) => {
    const response = await apiGet<{ data: Task[] }>(`/api/workspace/${workspaceId}/tasks`);
    return response.data;
  },

  create: ({ projectId, ...data }: { projectId: string } & TaskMutationInput) =>
    apiPost<{ task?: Task }>(`/api/project/${projectId}/tasks`, data),

  update: ({ taskId, ...data }: { taskId: string; projectId?: string } & TaskMutationInput) =>
    apiPut<{ task?: Task }>(`/api/tasks/${taskId}`, data),

  delete: (taskId: string) =>
    apiDelete(`/api/tasks/${taskId}`),

  duplicate: ({ taskId, projectId }: { taskId: string; projectId: string }) =>
    apiPost<{ task?: Task }>(`/api/tasks/${taskId}/duplicate`, { projectId }),

  bulkUpdate: ({ taskIds, data, projectId }: { taskIds: string[]; data: any; projectId?: string }) =>
    projectId
      ? apiPut(`/api/project/${projectId}/tasks/bulk`, { taskIds, data })
      : apiPut(`/api/tasks/bulk`, { taskIds, data }),

  getProjectCycles: (projectId: string) =>
    apiGet<{ cycles: any[] }>(`/api/project/${projectId}/cycles`),

  createColumn: ({ projectId, title, color, accentColor }: { projectId: string; title: string; color?: string; accentColor?: string }) =>
    apiPost(`/api/project/${projectId}/columns`, { title, color: color ?? accentColor }),

  updateColumn: ({ columnId, title, color, accentColor, projectId }: { columnId: string; title?: string; color?: string; accentColor?: string; projectId?: string }) =>
    projectId
      ? apiPut(`/api/project/${projectId}/columns/${columnId}`, { title, color: color ?? accentColor })
      : apiPut(`/api/columns/${columnId}`, { title, color: color ?? accentColor }),

  deleteColumn: (columnId: string, projectId?: string) =>
    projectId
      ? apiDelete(`/api/project/${projectId}/columns/${columnId}`)
      : apiDelete(`/api/columns/${columnId}`),

  uploadAttachment: (taskId: string, formData: FormData) =>
    apiPost(`/api/tasks/${taskId}/attachments`, formData),

  deleteAttachment: (taskId: string, attachmentId: string) =>
    apiDelete(`/api/tasks/${taskId}/attachments/${attachmentId}`),

  getComments: (taskId: string) =>
    apiGet(`/api/tasks/${taskId}/comments`),

  addComment: (taskId: string, content: string) =>
    apiPost(`/api/tasks/${taskId}/comments`, { content }),

  deleteComment: (taskId: string, commentId: string) =>
    apiDelete(`/api/tasks/${taskId}/comments/${commentId}`),

  getActivityLogs: (taskId: string) =>
    apiGet(`/api/tasks/${taskId}/activity`),
};

// ── Backward-compatible Function Aliases ─────────────────────────────────────

export const fetchProjectTasks = TaskService.getProjectTasks;
export const fetchWorkspaceTasks = TaskService.getWorkspaceTasks;
