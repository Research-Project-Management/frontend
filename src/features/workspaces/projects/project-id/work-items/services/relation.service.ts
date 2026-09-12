import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { Relation, TaskRelation } from '../types/work-item.types';

export interface AddRelationInput {
  targetId?: string;
  targetTaskId?: string;
  type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
}

export interface RelationResponse {
  success: boolean;
  message: string;
  relations?: Relation[];
}

export const RelationService = {
  getRelations: (itemId: string) =>
    apiGet<{ relations: Relation[] }>(`/api/work-items/${itemId}/relations`),

  addRelation: (itemId: string, input: AddRelationInput) => {
    const target = input.targetId || input.targetTaskId || '';
    return apiPost<RelationResponse>(`/api/work-items/${itemId}/relations`, {
      ...input,
      targetTaskId: target,
    });
  },

  removeRelation: (itemId: string, targetId: string) =>
    apiDelete<RelationResponse>(`/api/work-items/${itemId}/relations/${targetId}`),

  getViolations: (itemId: string) =>
    apiGet<unknown[]>(`/api/work-items/${itemId}/relations/violations`),
};
