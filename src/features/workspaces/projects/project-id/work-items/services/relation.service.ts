import { apiGet, apiPost, apiDelete } from "@/shared/lib/api";
import type { TaskRelation } from '../types/types';

export interface AddRelationInput {
  targetTaskId: string;
  type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
}

export interface RelationResponse {
  success: boolean;
  message: string;
  relations?: TaskRelation[];
}

export const RelationService = {
  getRelations: (taskId: string) =>
    apiGet<{ relations: TaskRelation[] }>(`/api/work-items/${taskId}/relations`),

  addRelation: (taskId: string, input: AddRelationInput) =>
    apiPost<RelationResponse>(`/api/work-items/${taskId}/relations`, input),

  removeRelation: (taskId: string, targetTaskId: string) =>
    apiDelete<RelationResponse>(`/api/work-items/${taskId}/relations/${targetTaskId}`),
};
