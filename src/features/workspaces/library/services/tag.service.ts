import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { TagWithCount } from '../types/library.types';
export type { TagWithCount };

export const TagService = {
  list: async (workspaceId?: string): Promise<TagWithCount[]> => {
    const isProject = workspaceId && workspaceId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(workspaceId)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await apiGet<any>(basePath);
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
    const isProject = workspaceId && workspaceId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(workspaceId)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await apiPost<any>(
      basePath,
      {
        name,
        color,
        type,
        ...(isProject ? { projectId: workspaceId } : {}),
      },
    );
    return raw?.data || raw;
  },

  delete: async (workspaceId: string, tagId: string): Promise<void> => {
    const isProject = workspaceId && workspaceId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(workspaceId)}/library/tags`
      : `/api/v1/library/tags`;
    await apiDelete<any>(
      `${basePath}/${encodeURIComponent(tagId)}`,
    );
  },

  deleteAutomatic: async (
    workspaceId?: string,
  ): Promise<{ count: number }> => {
    const isProject = workspaceId && workspaceId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(workspaceId)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await apiDelete<any>(
      `${basePath}/automatic`,
    );
    return raw?.data || raw || { count: 0 };
  },

  assignToItem: async (
    workspaceId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    const isProject = workspaceId && workspaceId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(workspaceId)}/library/tags`
      : `/api/v1/library/tags`;
    await apiPost<any>(
      `${basePath}/${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`,
      {},
    );
  },

  removeFromItem: async (
    workspaceId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    const isProject = workspaceId && workspaceId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(workspaceId)}/library/tags`
      : `/api/v1/library/tags`;
    await apiDelete<any>(
      `${basePath}/${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`,
    );
  },
};
