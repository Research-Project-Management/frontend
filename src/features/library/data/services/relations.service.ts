import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { RelatedItem } from '../../types/library.types';
import { isProjectScope } from './items.service';

export const RelationsService = {
  getRelated: (scopeId: string | undefined, itemId: string) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    return apiGet<{ relatedItems: RelatedItem[]; total: number }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations`,
    ).then((res) => ({
      relatedItems: (res as any).relatedItems || (res as any).relatedPapers || [],
      total: (res as any).total || ((res as any).relatedItems || (res as any).relatedPapers || []).length,
    }));
  },

  link: (
    scopeId: string | undefined,
    itemId: string,
    targetItemId: string | string[],
    relationType: string = 'related',
  ) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    const payload = Array.isArray(targetItemId)
      ? { targetItemIds: targetItemId, relationType }
      : { targetItemId, relationType };
    return apiPost<{ message: string; relationType?: string; totalLinked?: number }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations`,
      payload,
    );
  },

  unlink: (scopeId: string | undefined, itemId: string, targetItemId: string, _relationType?: string) => {
    const isProject = isProjectScope(scopeId);
    const basePath = isProject
      ? `/api/v1/projects/${encodeURIComponent(scopeId!)}/library/items`
      : `/api/v1/library/items`;
    return apiDelete<{ message: string }>(
      `${basePath}/${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`,
    );
  },
};

export const RelationService = RelationsService;
