'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RelationService } from '../services/relation.service';

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
export function useRelations(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();
  const effectiveItemId = itemId || scopeId || '';

  const relationsQuery = useQuery({
    queryKey: relationKeys.all(scopeId, effectiveItemId),
    queryFn: () => RelationService.getRelated(scopeId || '', effectiveItemId),
    enabled: Boolean(effectiveItemId),
    select: (data) => ({
      items: data.relatedItems || (data as any).relatedPapers || [],
      total: data.total || 0,
    }),
  });

  const linkMutation = useMutation({
    mutationFn: ({
      targetItemId,
      relationType = 'related',
    }: {
      targetItemId: string;
      relationType?: string;
    }) => RelationService.link(scopeId || '', effectiveItemId, targetItemId, relationType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
      toast.success('Item linked', { id: 'relation-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to link items', {
        description: err?.message || 'Please try again.',
        id: 'relation-mutation',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: ({ targetItemId }: { targetItemId: string }) =>
      RelationService.unlink(scopeId || '', effectiveItemId, targetItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
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
