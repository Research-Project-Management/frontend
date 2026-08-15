'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collectionKeys,
  getCollections,
  invalidateCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../../services/collection.services';

export function useCollections(workspaceId: string) {
  const qc = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(workspaceId),
    queryFn: () => getCollections(workspaceId),
    enabled: !!workspaceId,
    select: (d) => d.collections || [],
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createCollection>[1]) => createCollection(workspaceId, data),
    onSuccess: () => invalidateCollections(qc, workspaceId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateCollection>[2] & { collectionId: string }) => {
      const { collectionId, ...rest } = data as any;
      return updateCollection(workspaceId, collectionId, rest);
    },
    onSuccess: () => invalidateCollections(qc, workspaceId),
  });

  const deleteMutation = useMutation({
    mutationFn: (collectionId: string) => deleteCollection(workspaceId, collectionId),
    onSuccess: () => invalidateCollections(qc, workspaceId),
  });

  const collections = collectionsQuery.data ?? [];

  return {
    state: {
      collections,
      isLoading: collectionsQuery.isLoading,
      isError: collectionsQuery.isError,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
    actions: {
      create: createMutation.mutate,
      createAsync: createMutation.mutateAsync,
      update: updateMutation.mutate,
      updateAsync: updateMutation.mutateAsync,
      delete: deleteMutation.mutate,
      deleteAsync: deleteMutation.mutateAsync,
      refetch: collectionsQuery.refetch,
    },
  };
}
