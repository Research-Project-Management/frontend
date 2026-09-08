import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type { RelatedItem } from '../types/library.types';

export const RelationService = {
  getRelated: (workspaceId: string, itemId: string) =>
    apiGet<{ relatedPapers: RelatedItem[]; relatedItems?: RelatedItem[]; total: number }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations`,
    ).then((res) => ({
      relatedItems: res.relatedItems || res.relatedPapers || [],
      relatedPapers: res.relatedPapers || res.relatedItems || [],
      total: res.total || (res.relatedItems || res.relatedPapers || []).length,
    })),

  link: (
    workspaceId: string,
    itemId: string,
    targetItemId: string,
    relationType: string = 'related',
  ) =>
    apiPost<{ message: string; relationType: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations`,
      { targetItemId, targetPaperId: targetItemId, relationType },
    ),

  unlink: (workspaceId: string, itemId: string, targetItemId: string) =>
    apiDelete<{ message: string }>(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/relations/${encodeURIComponent(targetItemId)}`,
    ),
};
