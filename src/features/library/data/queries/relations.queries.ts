'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RelationService, RelationsService } from '../services/relations.service';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const relationKeys = {
  all: (scopeId?: string, itemId?: string) =>
    ['relations', scopeId || 'global', itemId] as const,
};

// ── useRelations ──────────────────────────────────────────────────────────────
/**
 * Fetch and mutate item relations (related items).
 * Backed by GET /items/:id/relations, POST /items/:id/relations, DELETE /items/:id/relations/:targetId
 */
export function useRelations(
  scopeIdOrOptions?: string | { scopeId?: string; workspaceId?: string; projectId?: string },
  itemId?: string,
) {
  const scopeId = typeof scopeIdOrOptions === 'string'
    ? scopeIdOrOptions
    : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || scopeIdOrOptions?.workspaceId || 'global');

  const queryClient = useQueryClient();
  const effectiveItemId = itemId || '';

  const relationsQuery = useQuery({
    queryKey: relationKeys.all(scopeId, effectiveItemId),
    queryFn: () => RelationService.getRelated(scopeId || '', effectiveItemId),
    enabled: Boolean(effectiveItemId && effectiveItemId !== 'user'),
    select: (data) => ({
      items: data.relatedItems || (data as any).relatedPapers || [],
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
      const targets = targetItemIds && targetItemIds.length > 0
        ? targetItemIds
        : (targetItemId ? [targetItemId] : []);
      return RelationService.link(scopeId || '', effectiveItemId, targets.length === 1 ? targets[0] : targets, relationType);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
      const targets = variables.targetItemIds || (variables.targetItemId ? [variables.targetItemId] : []);
      for (const tId of targets) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(scopeId, tId),
        });
      }
      const count = targets.length;
      toast.success(count > 1 ? `Linked ${count} items` : 'Item linked', {
        id: 'relation-mutation',
      });
    },
    onError: (err: any) => {
      toast.error('Failed to link items', {
        description: err?.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (variables: { targetItemId: string; relationType?: string }) =>
      RelationService.unlink(scopeId || '', effectiveItemId, variables.targetItemId, variables.relationType),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
      if (variables.targetItemId) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(scopeId, variables.targetItemId),
        });
      }
      toast.success('Item unlinked', { id: 'relation-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to unlink items', {
        description: err?.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  return {
    // Data
    relatedItems: relationsQuery.data?.items ?? [],
    total: relationsQuery.data?.total ?? 0,
    isLoading: relationsQuery.isLoading,
    error: relationsQuery.error,
    // Mutations
    link: linkMutation.mutateAsync,
    unlink: unlinkMutation.mutateAsync,
    isLinking: linkMutation.isPending,
    isUnlinking: unlinkMutation.isPending,
  };
}

export const useRelationsQuery = useRelations;
