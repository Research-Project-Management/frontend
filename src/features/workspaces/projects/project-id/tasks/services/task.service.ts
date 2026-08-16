import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Task, TaskMutationInput, ProjectTasksData, Project, Cycle } from "../types/task.types";

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
    apiDelete(`/api/tasks/${taskId}/comments/${commentId}`),

  getActivityLogs: (taskId: string) =>
    apiGet(`/api/tasks/${taskId}/activity`),
};

// ── Backward-compatible Function Aliases ─────────────────────────────────────

export const fetchProjectTasks = TaskService.getProjectTasks;
export const fetchWorkspaceTasks = TaskService.getWorkspaceTasks;
