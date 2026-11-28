'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RelationsService } from '../clients/items.client';
import {
  relationKeys,
  normalizeSpaceId,
  waitForBootstrapCache,
  getReaderBootstrapScope,
} from '@/features/library/sdk/query-keys';

export { relationKeys };


export function useRelations(
  spaceIdOrOptions?:
    | string
    | { spaceId?: string; projectId?: string; enabled?: boolean },
  itemId?: string,
  options?: { enabled?: boolean },
) {
  const spaceId =
    typeof spaceIdOrOptions === 'string'
      ? spaceIdOrOptions
      : (spaceIdOrOptions?.spaceId || spaceIdOrOptions?.projectId || 'user');
  const explicitEnabled =
    (typeof spaceIdOrOptions === 'object' ? spaceIdOrOptions?.enabled : undefined) ??
    options?.enabled ??
    true;

  const queryClient = useQueryClient();
  const effectiveItemId = itemId || '';
  const cacheKey = relationKeys.all(spaceId, effectiveItemId);

  const relationsQuery = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded = await waitForBootstrapCache<
        Awaited<ReturnType<typeof RelationsService.getRelated>>
      >(queryClient, getReaderBootstrapScope(spaceId), cacheKey);
      if (seeded !== undefined) return seeded;
      return RelationsService.getRelated(spaceId || '', effectiveItemId);
    },
    enabled: explicitEnabled && Boolean(effectiveItemId && effectiveItemId !== 'user'),
    select: (data) => ({
      items: data.relatedItems || [],
      total: data.total || 0,
    }),
  });

  const linkMutation = useMutation({
    mutationFn: ({
      targetItemId,
      targetItemIds,
      relationType = 'related',
    }: {
      targetItemId?: string;
      targetItemIds?: string[];
      relationType?: string;
    }) => {
      const targets =
        targetItemIds && targetItemIds.length > 0
          ? targetItemIds
          : (targetItemId ? [targetItemId] : []);
      return RelationsService.link(
        spaceId || '',
        effectiveItemId,
        targets.length === 1 ? targets[0] : targets,
        relationType,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(spaceId, effectiveItemId),
      });
      const targets =
        variables.targetItemIds ||
        (variables.targetItemId ? [variables.targetItemId] : []);
      for (const tId of targets) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(spaceId, tId),
        });
      }
      const count = targets.length;
      toast.success(
        count > 1 ? `Successfully linked ${count} references` : 'Reference linked',
        { id: 'relation-mutation' },
      );
    },
    onError: (err: Error) => {
      toast.error('Failed to link references', {
        description: err.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (variables: { targetItemId: string; relationType?: string }) =>
      RelationsService.unlink(
        spaceId || '',
        effectiveItemId,
        variables.targetItemId,
        variables.relationType,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(spaceId, effectiveItemId),
      });
      if (variables.targetItemId) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(spaceId, variables.targetItemId),
        });
      }
      toast.success('Reference unlinked', { id: 'relation-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to unlink reference', {
        description: err.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  return {
    relatedItems: relationsQuery.data?.items ?? [],
    total: relationsQuery.data?.total ?? 0,
    isLoading: relationsQuery.isLoading,
    error: relationsQuery.error,
    link: linkMutation.mutateAsync,
    unlink: unlinkMutation.mutateAsync,
    isLinking: linkMutation.isPending,
  };
}

// CONVERSION QUERY HOOKS
