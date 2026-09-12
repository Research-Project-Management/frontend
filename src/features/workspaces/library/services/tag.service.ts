import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { TagWithCount } from '../types/library.types';
export type { TagWithCount };

export const TagService = {
  list: async (_workspaceId?: string): Promise<TagWithCount[]> => {
    const raw = await apiGet<any>(
      `/api/v1/library/tags`,
    );
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      return raw.data;
    }
    return [];
  },

  create: async (
    _workspaceId: string,
    name: string,
    color?: string,
    type: string = 'manual',
  ): Promise<TagWithCount> => {
    const raw = await apiPost<any>(
      `/api/v1/library/tags`,
      { name, color, type },
    );
    return raw?.data || raw;
  },

  delete: async (_workspaceId: string, tagId: string): Promise<void> => {
    await apiDelete<any>(
      `/api/v1/library/tags/${tagId}`,
    );
  },

  deleteAutomatic: async (
    _workspaceId?: string,
  ): Promise<{ count: number }> => {
    const raw = await apiDelete<any>(
      `/api/v1/library/tags/automatic`,
    );
    return raw?.data || raw || { count: 0 };
  },

  assignToItem: async (
    _workspaceId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    await apiPost<any>(
      `/api/v1/library/tags/${tagId}/items/${itemId}`,
      {},
    );
  },

  removeFromItem: async (
    _workspaceId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    await apiDelete<any>(
      `/api/v1/library/tags/${tagId}/items/${itemId}`,
    );
  },
};
