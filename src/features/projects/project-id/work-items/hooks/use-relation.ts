'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RelationService } from '../services/relation.service';

export const relationKeys = {
  item: (id: string) => ['work-item-relations', id] as const,
  workItem: (id: string) => ['work-item-relations', id] as const,
};

export const useRelations = (id: string) =>
  useQuery({
    queryKey: relationKeys.item(id),
    queryFn: () => RelationService.getRelations(id),
    enabled: Boolean(id),
  });

export const useWorkItemRelations = useRelations;

export const useAddRelationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      targetId,
      targetWorkItemId,
      type,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      targetId?: string;
      targetWorkItemId?: string;
      type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
    }) => {
      const sourceId = (id || itemId || workItemId) ?? '';
      const target = (targetId || targetWorkItemId) ?? '';
      return RelationService.addRelation(sourceId, { targetWorkItemId: target, targetId: target, type });
    },
    onSuccess: (_, vars) => {
      const sourceId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      const target = (vars.targetId || vars.targetWorkItemId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add relation', { id: 'work-item-relation' }),
  });
};

export const useRemoveRelationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      relationId,
      targetId,
      targetWorkItemId,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
      relationId?: string;
      targetId?: string;
      targetWorkItemId?: string;
    }) => {
      const sourceId = (id || itemId || workItemId) ?? '';
      const target = (targetId || targetWorkItemId || relationId) ?? '';
      return RelationService.removeRelation(sourceId, target);
    },
    onSuccess: (_, vars) => {
      const sourceId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      const target = (vars.targetId || vars.targetWorkItemId || vars.relationId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove relation', { id: 'work-item-relation' }),
  });
};
