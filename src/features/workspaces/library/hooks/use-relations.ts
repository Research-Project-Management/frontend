'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RelationService } from '../services/relation.service';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const relationKeys = {
  all: (workspaceId: string, itemId: string) =>
    ['relations', workspaceId, itemId] as const,
};

// ── useRelations ──────────────────────────────────────────────────────────────
/**
 * Fetch and mutate item relations (related items).
 * Backed by GET /items/:id/relations, POST /items/:id/relations, DELETE /items/:id/relations/:targetId
 */
export function useRelations(workspaceId: string, itemId: string) {
  const queryClient = useQueryClient();

  const relationsQuery = useQuery({
    queryKey: relationKeys.all(workspaceId, itemId),
    queryFn: () => RelationService.getRelated(workspaceId, itemId),
    enabled: Boolean(workspaceId && itemId),
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
    }) => RelationService.link(workspaceId, itemId, targetItemId, relationType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(workspaceId, itemId),
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
      RelationService.unlink(workspaceId, itemId, targetItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(workspaceId, itemId),
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
