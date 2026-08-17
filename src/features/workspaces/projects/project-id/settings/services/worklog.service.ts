import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type { WorklogEntry } from '../types/worklog.types';

export interface WorklogListResponse {
  items: Array<{
    id: string;
    hours: number;
    description: string;
    date: string;
    userId: string;
    projectId: string;
    workspaceId: string;
    taskId?: string | null;
    taskTitle?: string | null;
    createdAt: string;
    updatedAt: string;
    user?: {
      id: string;
      name: string;
      avatar: string | null;
      email: string | null;
    };
  }>;
  total: number;
  summary?: {
    totalHours: number;
    count: number;
  };
}

export interface CreateWorklogInput {
  taskTitle: string;
  hours: number;
  date?: string;
  description?: string;
  taskId?: string;
}

export const WorklogService = {
  getProjectWorklogs: async (
    projectId: string,
    params?: { userId?: string; startDate?: string; endDate?: string; page?: number; limit?: number }
  ): Promise<WorklogEntry[]> => {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiGet<WorklogListResponse>(`/api/project/${projectId}/worklogs${qs}`);
    
    return (res.items || []).map((item) => ({
      id: item.id,
      userId: item.userId,
      user: {
        id: item.user?.id || item.userId,
        name: item.user?.name || 'Unknown User',
        avatar: item.user?.avatar || undefined,
        email: item.user?.email || undefined,
      },
      taskTitle: item.taskTitle || 'Research Activity',
      hours: Number(item.hours) || 0,
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: item.description || '',
    }));
  },

  createWorklog: async (projectId: string, input: CreateWorklogInput) => {
    return apiPost<{ log: any; message?: string }>(`/api/project/${projectId}/worklogs`, input);
  },

  deleteWorklog: async (worklogId: string) => {
    return apiDelete<{ message?: string; success?: boolean }>(`/api/worklogs/${worklogId}`);
  },
};

export const fetchProjectWorklogs = WorklogService.getProjectWorklogs;
export const createProjectWorklog = WorklogService.createWorklog;
export const deleteProjectWorklog = WorklogService.deleteWorklog;
