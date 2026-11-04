'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '@/features/projects/project-id/work-items/api/work-item.api';
import type { Item, RelationType } from '@/features/projects/project-id/work-items/types/work-item.types';
import { extractNormalizedEdges, wouldCauseCycle } from '@/features/projects/project-id/work-items/utils/cpm-graph.utils';
import { itemToast } from './use-crud';

export const relationKeys = {
  item: (id: string) => ['work-item-relations', id] as const,
  cpm: (projectId: string) => ['work-item-cpm', projectId] as const,
};

export const useRelations = (id: string) =>
  useQuery({
    queryKey: relationKeys.item(id),
    queryFn: () => workItemApi.relations.getRelations(id),
    enabled: Boolean(id),
  });

export const useProjectCpmQuery = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: relationKeys.cpm(projectId),
    queryFn: () => workItemApi.relations.getProjectCpm(projectId),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30_000,
  });

export interface AddRelationVariables {
  id?: string;
  itemId?: string;
  workItemId?: string;
  targetId?: string;
  targetWorkItemId?: string;
  type: RelationType;
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
      queryClient.invalidateQueries({ queryKey: ['work-item-cpm'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      queryClient.invalidateQueries({ queryKey: ['work-item-activity', sourceId] });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
        queryClient.invalidateQueries({ queryKey: ['work-item-activity', target] });
      }
      if (!vars.silent) {
        itemToast.success(vars.successMessage || 'Created dependency relation', 'relation');
      }
    },
    onError: (error: Error) => itemToast.error(error, 'Failed to add relation', 'relation'),
  });

  const { mutate } = mutation;

  const createDependencyWithCycleCheck = useCallback(
    (
      fromId: string,
      toId: string,
      items: Item[],
      options?: {
        type?: RelationType;
        onSuccess?: () => void;
      },
    ) => {
      const currentEdges = extractNormalizedEdges(items);
      if (wouldCauseCycle(fromId, toId, currentEdges)) {
        itemToast.error(
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
      queryClient.invalidateQueries({ queryKey: ['work-item-cpm'] });
      queryClient.invalidateQueries({ queryKey: relationKeys.item(sourceId) });
      queryClient.invalidateQueries({ queryKey: ['work-item-activity', sourceId] });
      if (target) {
        queryClient.invalidateQueries({ queryKey: relationKeys.item(target) });
        queryClient.invalidateQueries({ queryKey: ['work-item-activity', target] });
      }
    },
    onError: (error: Error) => itemToast.error(error, 'Failed to remove relation', 'relation'),
  });
};
