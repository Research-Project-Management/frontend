'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '@/features/projects/project-id/work-items/api/work-item.api';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';
import { extractNormalizedEdges, wouldCauseCycle } from '@/features/projects/project-id/work-items/utils/cpm-graph';
import { workItemToast } from './use-work-item-toast';

export const relationKeys = {
  item: (id: string) => ['work-item-relations', id] as const,
};

export const useRelations = (id: string) =>
  useQuery({
    queryKey: relationKeys.item(id),
    queryFn: () => workItemApi.relations.getRelations(id),
    enabled: Boolean(id),
  });

export interface AddRelationVariables {
  id?: string;
  itemId?: string;
  workItemId?: string;
  targetId?: string;
  targetWorkItemId?: string;
  type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
  successMessage?: string;
  silent?: boolean;
}

export const useAddRelationMutation = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      targetId,
      targetWorkItemId,
      type,
    }: AddRelationVariables) => {
      const sourceId = (id || itemId || workItemId) ?? '';
      const target = (targetId || targetWorkItemId) ?? '';
      return workItemApi.relations.addRelation(sourceId, { targetWorkItemId: target, targetId: target, type });
    },
    onSuccess: (_, vars) => {
      const sourceId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      const target = (vars.targetId || vars.targetWorkItemId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      queryClient.invalidateQueries({ queryKey: ['work-item-activity', sourceId] });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
        queryClient.invalidateQueries({ queryKey: ['work-item-activity', target] });
      }
      if (!vars.silent) {
        workItemToast.success(vars.successMessage || 'Created dependency relation', 'relation');
      }
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to add relation', 'relation'),
  });

  const { mutate } = mutation;

  const createDependencyWithCycleCheck = useCallback(
    (
      fromId: string,
      toId: string,
      items: Item[],
      options?: {
        type?: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
        onSuccess?: () => void;
      },
    ) => {
      const currentEdges = extractNormalizedEdges(items);
      if (wouldCauseCycle(fromId, toId, currentEdges)) {
        workItemToast.error(
          'Cannot create dependency: circular dependency detected',
          'Cannot create dependency: circular dependency detected',
          'relation',
        );
        return;
      }

      mutate(
        {
          id: fromId,
          workItemId: fromId,
          targetId: toId,
          targetWorkItemId: toId,
          type: options?.type ?? 'blocks',
          successMessage: 'Created dependency relation',
        },
        {
          onSuccess: () => options?.onSuccess?.(),
        },
      );
    },
    [mutate],
  );

  return {
    ...mutation,
    createDependencyWithCycleCheck,
  };
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
      return workItemApi.relations.removeRelation(sourceId, target);
    },
    onSuccess: (_, vars) => {
      const sourceId = (vars.id || vars.itemId || vars.workItemId) ?? '';
      const target = (vars.targetId || vars.targetWorkItemId || vars.relationId) ?? '';
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      queryClient.invalidateQueries({ queryKey: ['work-item-activity', sourceId] });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
        queryClient.invalidateQueries({ queryKey: ['work-item-activity', target] });
      }
    },
    onError: (error: Error) => workItemToast.error(error, 'Failed to remove relation', 'relation'),
  });
};

