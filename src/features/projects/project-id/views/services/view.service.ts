import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type {
  WorkItemViewItem,
  CreateViewInput,
  UpdateViewInput,
  QueryViewInput,
} from '../types/view.types';

export const ViewService = {
  getViews: async (
    projectId: string,
    query?: QueryViewInput,
  ): Promise<WorkItemViewItem[]> => {
    const searchParams = new URLSearchParams();
    if (query?.access) {
      searchParams.set('access', query.access);
    }
    if (query?.isFavorite !== undefined) {
      searchParams.set('isFavorite', String(query.isFavorite));
    }
    if (query?.search) {
      searchParams.set('search', query.search);
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/projects/${projectId}/views${queryString ? `?${queryString}` : ''}`;
    const response = await apiGet<{ data?: WorkItemViewItem[]; views?: WorkItemViewItem[] } | WorkItemViewItem[]>(endpoint);

    if (Array.isArray(response)) {
      return response;
    }
    return response.data || response.views || [];
  },

  getView: async (
    projectId: string,
    viewId: string,
  ): Promise<WorkItemViewItem> => {
    const response = await apiGet<{ data?: WorkItemViewItem; view?: WorkItemViewItem } | WorkItemViewItem>(
      `/api/projects/${projectId}/views/${viewId}`,
    );
    if ('id' in response) {
      return response as WorkItemViewItem;
    }
    return (response.data || response.view) as WorkItemViewItem;
  },

  createView: async (
    projectId: string,
    data: CreateViewInput,
  ): Promise<WorkItemViewItem> => {
    const response = await apiPost<{ data?: WorkItemViewItem; view?: WorkItemViewItem } | WorkItemViewItem>(
      `/api/projects/${projectId}/views`,
      data,
    );
    if ('id' in response) {
      return response as WorkItemViewItem;
    }
    return (response.data || response.view) as WorkItemViewItem;
  },

  updateView: async (
    projectId: string,
    viewId: string,
    data: UpdateViewInput,
  ): Promise<WorkItemViewItem> => {
    const response = await apiPatch<{ data?: WorkItemViewItem; view?: WorkItemViewItem } | WorkItemViewItem>(
      `/api/projects/${projectId}/views/${viewId}`,
      data,
    );
    if ('id' in response) {
      return response as WorkItemViewItem;
    }
    return (response.data || response.view) as WorkItemViewItem;
  },

  deleteView: async (
    projectId: string,
    viewId: string,
  ): Promise<void> => {
    await apiDelete(`/api/projects/${projectId}/views/${viewId}`);
  },

  toggleFavorite: async (
    projectId: string,
    viewId: string,
  ): Promise<{ isFavorite: boolean }> => {
    return apiPost<{ isFavorite: boolean }>(
      `/api/projects/${projectId}/views/${viewId}/favorite`,
      {},
    );
  },
};
