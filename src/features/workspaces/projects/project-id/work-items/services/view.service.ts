import { apiGet, apiPost, apiPatch, apiDelete } from "@/shared/lib/api";

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

  updateView: (
    projectId: string,
    viewId: string,
    data: Partial<{
      name: string;
      description?: string;
      layout?: string;
      filters?: Record<string, unknown>;
      displayProperties?: Record<string, unknown>;
      access?: 'public' | 'private';
    }>,
  ) => apiPatch<SavedViewRecord>(`/api/projects/${projectId}/views/${viewId}`, data),

  deleteView: (projectId: string, viewId: string) =>
    apiDelete<{ message: string }>(`/api/projects/${projectId}/views/${viewId}`),

  favorite: (projectId: string, viewId: string) =>
    apiPost<{ message: string }>(`/api/projects/${projectId}/views/${viewId}/favorite`),

  unfavorite: (projectId: string, viewId: string) =>
    apiDelete<{ message: string }>(`/api/projects/${projectId}/views/${viewId}/favorite`),

  getFavoriteViews: (projectId: string) =>
    apiGet<string[]>(`/api/projects/${projectId}/user-favorite-views`),

  getViewWorkItems: (projectId: string, viewId: string) =>
    apiGet<any[] | { data?: any[]; workItems?: any[] }>(
      `/api/projects/${projectId}/views/${viewId}/work-items`,
    ),
};
