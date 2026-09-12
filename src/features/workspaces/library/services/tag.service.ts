import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { TagWithCount } from '../types/library.types';
export type { TagWithCount };

export const TagService = {
  list: async (workspaceId: string): Promise<TagWithCount[]> => {
    const raw = await apiGet<any>(
      `/api/v1/workspaces/${workspaceId}/library/tags`,
    );
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      return raw.data;
    }
    return [];
  },

  create: async (
    workspaceId: string,
    name: string,
    color?: string,
    type: string = 'manual',
  ): Promise<TagWithCount> => {
    const raw = await apiPost<any>(
      `/api/v1/workspaces/${workspaceId}/library/tags`,
      { name, color, type },
    );
    return raw?.data || raw;
  },

  delete: async (workspaceId: string, tagId: string): Promise<void> => {
    await apiDelete<any>(
      `/api/v1/workspaces/${workspaceId}/library/tags/${tagId}`,
    );
  },

  deleteAutomatic: async (
    workspaceId: string,
  ): Promise<{ count: number }> => {
    const raw = await apiDelete<any>(
      `/api/v1/workspaces/${workspaceId}/library/tags/automatic`,
    );
    return raw?.data || raw || { count: 0 };
  },

  assignToItem: async (
    workspaceId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    await apiPost<any>(
      `/api/v1/workspaces/${workspaceId}/library/tags/${tagId}/items/${itemId}`,
      {},
    );
  },

  removeFromItem: async (
    workspaceId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    await apiDelete<any>(
      `/api/v1/workspaces/${workspaceId}/library/tags/${tagId}/items/${itemId}`,
    );
  },
};
