import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { TagWithCount } from '../types/library.types';
export type { TagWithCount };

export const TagsService = {
  list: async (scopeId?: string): Promise<TagWithCount[]> => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await apiGet<any>(basePath);
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      return raw.data;
    }
    return [];
  },

  create: async (
    scopeId: string,
    name: string,
    color?: string,
    type: string = 'manual',
  ): Promise<TagWithCount> => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await apiPost<any>(
      basePath,
      {
        name,
        color,
        type,
        ...(isProject ? { projectId: scopeId } : {}),
      },
    );
    return raw?.data || raw;
  },

  delete: async (scopeId: string, tagId: string): Promise<void> => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/tags`
      : `/api/v1/library/tags`;
    await apiDelete<any>(
      `${basePath}/${encodeURIComponent(tagId)}`,
    );
  },

  deleteAutomatic: async (
    scopeId?: string,
  ): Promise<{ count: number }> => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/tags`
      : `/api/v1/library/tags`;
    const raw = await apiDelete<any>(
      `${basePath}/automatic`,
    );
    return raw?.data || raw || { count: 0 };
  },

  assignToItem: async (
    scopeId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/tags`
      : `/api/v1/library/tags`;
    await apiPost<any>(
      `${basePath}/${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`,
      {},
    );
  },

  removeFromItem: async (
    scopeId: string,
    tagId: string,
    itemId: string,
  ): Promise<void> => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/tags`
      : `/api/v1/library/tags`;
    await apiDelete<any>(
      `${basePath}/${encodeURIComponent(tagId)}/items/${encodeURIComponent(itemId)}`,
    );
  },
};

export const TagService = TagsService;
