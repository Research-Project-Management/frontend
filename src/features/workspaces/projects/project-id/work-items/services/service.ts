import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "@/shared/lib/api";
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  ReorderTaskInput,
  BulkUpdateTaskInput,
  CreateSubtaskInput,
  AttachPageInput,
  AttachPaperInput,
  AttachFileInput,
  AttachLinkInput,
  ProjectTasksData,
  Project,
  Cycle,
  Column,
  ActivityLog,
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
  ProjectMember,
} from "../types/types";

// ── Pure Task API Service ───────────────────────────────────────────────────

export const TaskService = {
  getProjectTasks: (projectId: string, cycleId?: string) =>
    apiGet<ProjectTasksData>(
      `/api/projects/${projectId}/work-items${cycleId ? `?cycleId=${cycleId}` : ""}`,
    ),

  getWorkspaceTasks: async (workspaceId: string) => {
    const response = await apiGet<{ data?: Task[]; tasks?: Task[] }>(
      `/api/workspaces/${workspaceId}/work-items`,
    );
    return response.data || response.tasks || [];
  },

  getWorkspaceProjects: (workspaceId: string) =>
    apiGet<{ data: Project[] } | Project[]>(`/api/workspace/${workspaceId}/projects`),

  getProjectDetails: (projectId: string) =>
    apiGet<{ project: Project }>(`/api/project/${projectId}`),

  create: ({ projectId, ...data }: CreateTaskInput & { projectId: string }) =>
    apiPost<{ task?: Task; workItem?: Task }>(`/api/projects/${projectId}/work-items`, data),

  update: ({ taskId, projectId: _projectId, ...data }: { taskId: string; projectId?: string } & UpdateTaskInput) =>
    apiPut<{ task?: Task; workItem?: Task }>(`/api/work-items/${taskId}`, data),

  delete: (taskId: string) =>
    apiDelete(`/api/work-items/${taskId}`),

  duplicate: ({ taskId, projectId }: { taskId: string; projectId: string }) =>
    apiPost<{ task?: Task; workItem?: Task }>(`/api/work-items/${taskId}/duplicate`, { projectId }),

  createSubtask: (taskId: string, data: CreateSubtaskInput) =>
    apiPost<{ task: Task }>(`/api/work-items/${taskId}/subtasks`, data),

  convertToRootTask: (taskId: string) =>
    apiPost<{ task: Task }>(`/api/work-items/${taskId}/convert-to-root`),

  reorderTask: ({ projectId, taskId, columnId, rank }: ReorderTaskInput) =>
    projectId
      ? apiPut<{ message: string }>(`/api/projects/${projectId}/work-items/reorder`, { taskId, columnId, rank })
      : apiPut<{ message: string }>(`/api/work-items/${taskId}/reorder`, { taskId, columnId, rank }),

  bulkUpdate: ({ taskIds, data, projectId }: BulkUpdateTaskInput) =>
    projectId
      ? apiPut<{ message: string; count: number }>(`/api/projects/${projectId}/work-items/bulk`, { taskIds, data, projectId })
      : apiPut<{ message: string; count: number }>(`/api/work-items/bulk`, { taskIds, data }),

  bulkDelete: ({ taskIds, projectId }: { taskIds: string[]; projectId?: string }) =>
    projectId
      ? apiPost(`/api/projects/${projectId}/work-items/bulk-delete`, { taskIds })
      : apiPost(`/api/work-items/bulk-delete`, { taskIds }),

  getProjectCycles: (projectId: string) =>
    apiGet<{ cycles: Cycle[] }>(`/api/projects/${projectId}/cycles`),

  uploadAttachment: (taskId: string, formData: FormData) =>
    apiPost(`/api/work-items/${taskId}/attachments`, formData),

  deleteAttachment: (taskId: string, attachmentId: string) =>
    apiDelete(`/api/work-items/${taskId}/attachments/${attachmentId}`),

  // ── Attach Center ─────────────────────────────────────────────────────────
  attachPage: (taskId: string, data: AttachPageInput) =>
    apiPost<{ message: string; task: Task; page: AttachPageItem }>(
      `/api/work-items/${taskId}/attach/pages`,
      data,
    ),

  detachPage: (taskId: string, pageId: string) =>
    apiDelete<{ message: string; task: Task }>(
      `/api/work-items/${taskId}/attach/pages/${pageId}`,
    ),

  attachPaper: (taskId: string, data: AttachPaperInput) =>
    apiPost<{ message: string; task: Task; paper: AttachPaperItem }>(
      `/api/work-items/${taskId}/attach/papers`,
      data,
    ),

  detachPaper: (taskId: string, paperId: string) =>
    apiDelete<{ message: string; task: Task }>(
      `/api/work-items/${taskId}/attach/papers/${paperId}`,
    ),

  attachFile: (taskId: string, data: AttachFileInput) =>
    apiPost<{ message: string; task: Task; file: AttachFileItem }>(
      `/api/work-items/${taskId}/attach/files`,
      data,
    ),

  detachFile: (taskId: string, fileId: string) =>
    apiDelete<{ message: string; task: Task }>(
      `/api/work-items/${taskId}/attach/files/${fileId}`,
    ),

  attachLink: (taskId: string, data: AttachLinkInput) =>
    apiPost<{ message: string; task: Task; link: AttachLinkItem }>(
      `/api/work-items/${taskId}/attach/links`,
      data,
    ),

  detachLink: (taskId: string, linkIndex: number) =>
    apiDelete<{ message: string; task: Task }>(
      `/api/work-items/${taskId}/attach/links/${linkIndex}`,
    ),

  getComments: (taskId: string) =>
    apiGet<ActivityLog[] | { comments?: ActivityLog[]; data?: ActivityLog[] }>(`/api/tasks/${taskId}/comments`),

  addComment: (taskId: string, content: string) =>
    apiPost<ActivityLog>(`/api/tasks/${taskId}/comments`, { content }),

  updateComment: (taskId: string, commentId: string, content: string) =>
    apiPut<{ comment: ActivityLog }>(`/api/tasks/comments/${commentId}`, { content }),

  reactComment: (taskId: string, commentId: string, emoji: string) =>
    apiPost<{ comment: ActivityLog }>(`/api/tasks/comments/${commentId}/reactions`, { emoji }),

  deleteComment: (taskId: string, commentId: string) =>
    apiDelete(`/api/tasks/comments/${commentId}`),

  getActivityLogs: (taskId: string) =>
    apiGet<ActivityLog[] | { activities?: ActivityLog[]; data?: ActivityLog[] }>(`/api/work-items/${taskId}/activity`),

  addColumn: (projectId: string, data: { title: string; accentColor?: string; id?: string }) =>
    apiPost<{ columns: Column[] }>(`/api/projects/${projectId}/columns`, data),

  updateColumn: (projectId: string, columnId: string, data: { title?: string; accentColor?: string }) =>
    apiPut<{ columns: Column[] }>(`/api/projects/${projectId}/columns/${columnId}`, data),

  deleteColumn: (projectId: string, columnId: string, targetColumnId?: string) =>
    apiDelete<{ columns: Column[]; fallbackColumnId?: string }>(
      `/api/projects/${projectId}/columns/${columnId}${targetColumnId ? `?targetColumnId=${targetColumnId}` : ''}`
    ),

  reorderColumns: (projectId: string, columns: Column[]) =>
    apiPut<{ columns: Column[] }>(`/api/projects/${projectId}/columns/reorder`, { columns }),

  resetColumns: (projectId: string) =>
    apiPost<{ columns: Column[] }>(`/api/projects/${projectId}/columns/reset`, {}),

  // ── Archive & Restore ──────────────────────────────────────────────────────
  archiveTask: (taskId: string) =>
    apiPost<{ message: string; task?: Task }>(`/api/work-items/${taskId}/archive`),

  restoreTask: (taskId: string) =>
    apiPost<{ message: string; task?: Task }>(`/api/work-items/${taskId}/restore`),

  bulkArchive: ({ taskIds, projectId }: { taskIds: string[]; projectId?: string }) =>
    apiPost<{ message: string; count: number }>(`/api/work-items/bulk-archive`, { taskIds, projectId }),

  bulkRestore: ({ taskIds, projectId }: { taskIds: string[]; projectId?: string }) =>
    apiPost<{ message: string; count: number }>(`/api/work-items/bulk-restore`, { taskIds, projectId }),

  getArchivedTasks: async (projectId: string): Promise<Task[]> => {
    const res = await apiGet<{ data?: Task[]; tasks?: Task[] } | Task[]>(
      `/api/work-items/projects/${projectId}/archived`,
    );
    if (Array.isArray(res)) return res;
    return res.data || res.tasks || [];
  },
};

// ── Backward-compatible Aliases ─────────────────────────────────────────────

export const WorkItemService = {
  ...TaskService,
  getProjectWorkItems: TaskService.getProjectTasks,
  getWorkspaceWorkItems: TaskService.getWorkspaceTasks,
};

export const fetchProjectTasks = TaskService.getProjectTasks;
export const fetchWorkspaceTasks = TaskService.getWorkspaceTasks;
export const fetchProjectWorkItems = TaskService.getProjectTasks;
export const fetchWorkspaceWorkItems = TaskService.getWorkspaceTasks;

// ── User Property & Display Preferences API ─────────────────────────────────

export interface UserProjectProperty {
  id?: string;
  projectId: string;
  userId: string;
  filters?: Record<string, unknown>;
  displayFilters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  sortOrder?: string;
}

export const PropertyService = {
  getUserProperties: (projectId: string) =>
    apiGet<UserProjectProperty>(`/api/projects/${projectId}/user-properties`),

  updateUserProperties: (
    projectId: string,
    data: {
      filters?: Record<string, unknown>;
      displayFilters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      preferences?: Record<string, unknown>;
      sortOrder?: string;
    },
  ) =>
    apiPatch<UserProjectProperty>(`/api/projects/${projectId}/user-properties`, data),
};

// ── Saved Views API ─────────────────────────────────────────────────────────

export interface SavedViewRecord {
  id: string;
  name: string;
  description?: string | null;
  layout: string;
  filters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  access: 'public' | 'private';
  isFavorite?: boolean;
}

export const ViewService = {
  getViews: async (projectId: string): Promise<SavedViewRecord[]> => {
    const res = await apiGet<{ data?: SavedViewRecord[]; views?: SavedViewRecord[] } | SavedViewRecord[]>(
      `/api/projects/${projectId}/views`,
    );
    if (Array.isArray(res)) return res;
    return res.data || res.views || [];
  },

  createView: (
    projectId: string,
    data: {
      name: string;
      description?: string;
      layout?: string;
      filters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      access?: 'public' | 'private';
    },
  ) => apiPost<SavedViewRecord>(`/api/projects/${projectId}/views`, data),
};

// ── Archive Service ─────────────────────────────────────────────────────────

export const ArchiveService = {
  archiveTask: TaskService.archiveTask,
  restoreTask: TaskService.restoreTask,
  bulkArchive: TaskService.bulkArchive,
  bulkRestore: TaskService.bulkRestore,
  getArchivedTasks: TaskService.getArchivedTasks,
};

// ── Draft Service ───────────────────────────────────────────────────────────

export interface WorkItemDraftRecord {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  content?: string | null;
  columnId?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  cycleId?: string | null;
  parentTaskId?: string | null;
  recurrence?: string | null;
  reminder?: string | null;
  labels?: string[];
  assigneeId?: string | null;
  attachments?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export const DraftService = {
  getDrafts: async (projectId?: string): Promise<WorkItemDraftRecord[]> => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const res = await apiGet<{ data?: WorkItemDraftRecord[]; drafts?: WorkItemDraftRecord[] } | WorkItemDraftRecord[]>(
      `/api/work-items/drafts${query}`,
    );
    if (Array.isArray(res)) return res;
    return res.data || res.drafts || [];
  },

  getDraft: (id: string) =>
    apiGet<WorkItemDraftRecord>(`/api/work-items/drafts/${id}`),

  createDraft: (data: Partial<CreateTaskInput> & { projectId: string }) =>
    apiPost<WorkItemDraftRecord>(`/api/work-items/drafts`, data),

  updateDraft: (id: string, data: Partial<CreateTaskInput>) =>
    apiPut<WorkItemDraftRecord>(`/api/work-items/drafts/${id}`, data),

  publishDraft: (id: string, options?: { columnId?: string }) =>
    apiPost<{ message: string; task: Task }>(`/api/work-items/drafts/${id}/publish`, options || {}),

  duplicateDraft: (id: string) =>
    apiPost<WorkItemDraftRecord>(`/api/work-items/drafts/${id}/duplicate`),

  deleteDraft: (id: string) =>
    apiDelete<{ message: string }>(`/api/work-items/drafts/${id}`),
};

// ── Template Service ────────────────────────────────────────────────────────

export interface WorkItemTemplateRecord {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  title?: string | null;
  content?: string | null;
  priority?: string | null;
  labels?: string[];
  defaultCycleId?: string | null;
  defaultColumnId?: string | null;
  isShared?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const TemplateService = {
  getTemplates: async (projectId: string): Promise<WorkItemTemplateRecord[]> => {
    const res = await apiGet<{ data?: WorkItemTemplateRecord[]; templates?: WorkItemTemplateRecord[] } | WorkItemTemplateRecord[]>(
      `/api/work-items/projects/${projectId}/templates`,
    );
    if (Array.isArray(res)) return res;
    return res.data || res.templates || [];
  },

  getTemplate: (projectId: string, templateId: string) =>
    apiGet<WorkItemTemplateRecord>(`/api/work-items/projects/${projectId}/templates/${templateId}`),

  createTemplate: (
    projectId: string,
    data: {
      name: string;
      description?: string;
      title?: string;
      content?: string;
      priority?: string;
      labels?: string[];
      defaultCycleId?: string;
      defaultColumnId?: string;
      isShared?: boolean;
    },
  ) =>
    apiPost<WorkItemTemplateRecord>(`/api/work-items/projects/${projectId}/templates`, data),

  updateTemplate: (
    projectId: string,
    templateId: string,
    data: Partial<{
      name: string;
      description?: string;
      title?: string;
      content?: string;
      priority?: string;
      labels?: string[];
      defaultCycleId?: string;
      defaultColumnId?: string;
      isShared?: boolean;
    }>,
  ) =>
    apiPut<WorkItemTemplateRecord>(`/api/work-items/projects/${projectId}/templates/${templateId}`, data),

  deleteTemplate: (projectId: string, templateId: string) =>
    apiDelete<{ message: string }>(`/api/work-items/projects/${projectId}/templates/${templateId}`),

  instantiateTemplate: (
    projectId: string,
    templateId: string,
    data?: { title?: string; overrides?: Record<string, unknown> },
  ) =>
    apiPost<{ message: string; task: Task }>(
      `/api/work-items/projects/${projectId}/templates/${templateId}/instantiate`,
      data || {},
    ),
};

// ── Update Service (Progress Briefing) ──────────────────────────────────────

export interface WorkItemUpdateRecord {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  status?: string | null;
  percent?: number | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

export const UpdateService = {
  getUpdates: async (taskId: string, projectId?: string): Promise<WorkItemUpdateRecord[]> => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${taskId}/updates`
      : `/api/work-items/${taskId}/updates`;
    const res = await apiGet<{ data?: WorkItemUpdateRecord[]; updates?: WorkItemUpdateRecord[] } | WorkItemUpdateRecord[]>(url);
    if (Array.isArray(res)) return res;
    return res.data || res.updates || [];
  },

  getLatestUpdate: async (taskId: string, projectId?: string): Promise<WorkItemUpdateRecord | null> => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${taskId}/updates/latest`
      : `/api/work-items/${taskId}/updates/latest`;
    const res = await apiGet<{ data?: WorkItemUpdateRecord } | WorkItemUpdateRecord | null>(url);
    if (!res) return null;
    if ('data' in res) return (res as { data?: WorkItemUpdateRecord }).data || null;
    return res as WorkItemUpdateRecord;
  },

  createUpdate: (
    taskId: string,
    data: { content: string; status?: string; percent?: number },
    projectId?: string,
  ) => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${taskId}/updates`
      : `/api/work-items/${taskId}/updates`;
    return apiPost<WorkItemUpdateRecord>(url, data);
  },

  deleteUpdate: (taskId: string, updateId: string, projectId?: string) => {
    const url = projectId
      ? `/api/projects/${projectId}/work-items/${taskId}/updates/${updateId}`
      : `/api/work-items/${taskId}/updates/${updateId}`;
    return apiDelete<{ message: string }>(url);
  },
};

// ── Assignment Service ──────────────────────────────────────────────────────

export const AssignmentService = {
  getEligibleAssignees: (projectId: string) =>
    apiGet<ProjectMember[]>(`/api/projects/${projectId}/work-items/assignees`),

  assignTask: (projectId: string, taskId: string, assigneeId: string | null) =>
    apiPost<{ message: string; task: Task }>(`/api/projects/${projectId}/work-items/${taskId}/assign`, {
      assigneeId,
    }),

  unassignTask: (projectId: string, taskId: string) =>
    apiPost<{ message: string; task: Task }>(`/api/projects/${projectId}/work-items/${taskId}/unassign`),

  joinTask: (projectId: string, taskId: string) =>
    apiPost<{ message: string; task: Task }>(`/api/projects/${projectId}/work-items/${taskId}/join`),

  leaveTask: (projectId: string, taskId: string) =>
    apiPost<{ message: string; task: Task }>(`/api/projects/${projectId}/work-items/${taskId}/leave`),

  setAssignees: (projectId: string, taskId: string, assigneeIds: string[]) =>
    apiPut<{ message: string; task: Task }>(`/api/projects/${projectId}/work-items/${taskId}/assignees`, {
      assigneeIds,
    }),
};

