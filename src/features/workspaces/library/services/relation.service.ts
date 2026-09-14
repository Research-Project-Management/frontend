import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { RelatedItem } from '../types/library.types';

export const RelationService = {
  getRelated: (scopeId: string, itemId: string) => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/items`
      : `/api/v1/library/items`;
    return apiGet<{ relatedItems: RelatedItem[]; total: number }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations`,
    ).then((res) => ({
      relatedItems: (res as any).relatedItems || (res as any).relatedPapers || [],
      total: (res as any).total || ((res as any).relatedItems || (res as any).relatedPapers || []).length,
    }));
  },

  link: (
    scopeId: string,
    itemId: string,
    targetItemId: string,
    relationType: string = 'related',
  ) => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/items`
      : `/api/v1/library/items`;
    return apiPost<{ message: string; relationType: string }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations`,
      { targetItemId, relationType },
    );
  },

  unlink: (scopeId: string, itemId: string, targetItemId: string) => {
    const isProject = scopeId && scopeId !== 'user';
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId)}/library/items`
      : `/api/v1/library/items`;
    return apiDelete<{ message: string }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`,
    );
  },
};
