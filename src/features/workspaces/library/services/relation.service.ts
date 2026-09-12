import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { RelatedItem } from '../types/library.types';

export const RelationService = {
  getRelated: (workspaceId: string, itemId: string) =>
    apiGet<{ relatedItems: RelatedItem[]; total: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations`,
    ).then((res) => ({
      relatedItems: (res as any).relatedItems || (res as any).relatedPapers || [],
      total: (res as any).total || ((res as any).relatedItems || (res as any).relatedPapers || []).length,
    })),

  link: (
    workspaceId: string,
    itemId: string,
    targetItemId: string,
    relationType: string = 'related',
  ) =>
    apiPost<{ message: string; relationType: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations`,
      { targetItemId, relationType },
    ),

  unlink: (workspaceId: string, itemId: string, targetItemId: string) =>
    apiDelete<{ message: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`,
    ),
};
