'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RelationService } from '../services/relation.service';

export const relationKeys = {
  item: (id: string) => ['work-item-relations', id] as const,
  task: (id: string) => ['work-item-relations', id] as const,
};

export const useRelations = (id: string) =>
  useQuery({
    queryKey: relationKeys.item(id),
    queryFn: () => RelationService.getRelations(id),
    enabled: Boolean(id),
  });

export const useTaskRelations = useRelations;

export const useAddRelationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      taskId,
      targetId,
      targetTaskId,
      type,
    }: {
      id?: string;
      itemId?: string;
      taskId?: string;
      targetId?: string;
      targetTaskId?: string;
      type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
    }) => {
      const sourceId = (id || itemId || taskId) ?? '';
      const target = (targetId || targetTaskId) ?? '';
      return RelationService.addRelation(sourceId, { targetTaskId: target, targetId: target, type });
    },
    onSuccess: (_, vars) => {
      const sourceId = (vars.id || vars.itemId || vars.taskId) ?? '';
      const target = (vars.targetId || vars.targetTaskId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add relation'),
  });
};

export const useRemoveRelationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      taskId,
      relationId,
      targetId,
      targetTaskId,
    }: {
      id?: string;
      itemId?: string;
      taskId?: string;
      relationId?: string;
      targetId?: string;
      targetTaskId?: string;
    }) => {
      const sourceId = (id || itemId || taskId) ?? '';
      const target = (targetId || targetTaskId || relationId) ?? '';
      return RelationService.removeRelation(sourceId, target);
    },
    onSuccess: (_, vars) => {
      const sourceId = (vars.id || vars.itemId || vars.taskId) ?? '';
      const target = (vars.targetId || vars.targetTaskId || vars.relationId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove relation'),
  });
};
