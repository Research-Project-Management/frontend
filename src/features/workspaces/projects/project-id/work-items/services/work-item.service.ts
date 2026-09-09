import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type {
  WorkItem,
  WorkItemMutationInput,
  ProjectWorkItemsData,
  Project,
  Cycle,
  Task,
  TaskMutationInput,
  ProjectTasksData,
} from "../types/work-item.types";

// ── Pure Work Item API Service ───────────────────────────────────────────────

export const WorkItemService = {
  getProjectWorkItems: (projectId: string, cycleId?: string) =>
    apiGet<ProjectWorkItemsData>(
      `/api/projects/${projectId}/work-items${cycleId ? `?cycleId=${cycleId}` : ""}`,
    ),

  getWorkspaceWorkItems: async (workspaceId: string) => {
    const response = await apiGet<{ data?: WorkItem[]; tasks?: WorkItem[] }>(
      `/api/workspaces/${workspaceId}/work-items`,
    );
    return response.data || response.tasks || [];
  },

  getWorkspaceProjects: (workspaceId: string) =>
    apiGet<{ data: Project[] } | Project[]>(`/api/workspace/${workspaceId}/projects`),

  getProjectDetails: (projectId: string) =>
    apiGet<{ project: Project }>(`/api/project/${projectId}`),

  create: ({ projectId, ...data }: { projectId: string } & WorkItemMutationInput) =>
    apiPost<{ task?: WorkItem; workItem?: WorkItem }>(`/api/projects/${projectId}/work-items`, data),

  update: ({ taskId, projectId: _projectId, ...data }: { taskId: string; projectId?: string } & WorkItemMutationInput) =>
    apiPut<{ task?: WorkItem; workItem?: WorkItem }>(`/api/work-items/${taskId}`, data),

  delete: (taskId: string) =>
    apiDelete(`/api/work-items/${taskId}`),

  duplicate: ({ taskId, projectId }: { taskId: string; projectId: string }) =>
    apiPost<{ task?: WorkItem; workItem?: WorkItem }>(`/api/work-items/${taskId}/duplicate`, { projectId }),

  bulkUpdate: ({ taskIds, data, projectId }: { taskIds: string[]; data: any; projectId?: string }) =>
    projectId
      ? apiPut(`/api/projects/${projectId}/work-items/bulk`, { taskIds, data })
      : apiPut(`/api/work-items/bulk`, { taskIds, data }),

  getProjectCycles: (projectId: string) =>
    apiGet<{ cycles: Cycle[] }>(`/api/projects/${projectId}/cycles`),

  uploadAttachment: (taskId: string, formData: FormData) =>
    apiPost(`/api/work-items/${taskId}/attachments`, formData),

  deleteAttachment: (taskId: string, attachmentId: string) =>
    apiDelete(`/api/work-items/${taskId}/attachments/${attachmentId}`),

  getComments: (taskId: string) =>
    apiGet(`/api/tasks/${taskId}/comments`),

  addComment: (taskId: string, content: string) =>
    apiPost(`/api/tasks/${taskId}/comments`, { content }),

  updateComment: (taskId: string, commentId: string, content: string) =>
    apiPut<{ comment: any }>(`/api/tasks/comments/${commentId}`, { content }),

  reactComment: (taskId: string, commentId: string, emoji: string) =>
    apiPost<{ comment: any }>(`/api/tasks/comments/${commentId}/reactions`, { emoji }),

  deleteComment: (taskId: string, commentId: string) =>
    apiDelete(`/api/tasks/comments/${commentId}`),

  getActivityLogs: (taskId: string) =>
    apiGet(`/api/work-items/${taskId}/activity`),

  addColumn: (projectId: string, data: { title: string; accentColor?: string; id?: string }) =>
    apiPost<{ columns: any[] }>(`/api/projects/${projectId}/columns`, data),

  updateColumn: (projectId: string, columnId: string, data: { title?: string; accentColor?: string }) =>
    apiPut<{ columns: any[] }>(`/api/projects/${projectId}/columns/${columnId}`, data),

  deleteColumn: (projectId: string, columnId: string, targetColumnId?: string) =>
    apiDelete<{ columns: any[]; fallbackColumnId?: string }>(
      `/api/projects/${projectId}/columns/${columnId}${targetColumnId ? `?targetColumnId=${targetColumnId}` : ''}`
    ),

  reorderColumns: (projectId: string, columns: any[]) =>
    apiPut<{ columns: any[] }>(`/api/projects/${projectId}/columns/reorder`, { columns }),

  resetColumns: (projectId: string) =>
    apiPost<{ columns: any[] }>(`/api/projects/${projectId}/columns/reset`, {}),
};

// ── Backward-compatible Aliases ─────────────────────────────────────────────

export const TaskService = {
  ...WorkItemService,
  getProjectTasks: WorkItemService.getProjectWorkItems,
  getWorkspaceTasks: WorkItemService.getWorkspaceWorkItems,
};

export const fetchProjectWorkItems = WorkItemService.getProjectWorkItems;
export const fetchWorkspaceWorkItems = WorkItemService.getWorkspaceWorkItems;
export const fetchProjectTasks = TaskService.getProjectTasks;
export const fetchWorkspaceTasks = TaskService.getWorkspaceTasks;
