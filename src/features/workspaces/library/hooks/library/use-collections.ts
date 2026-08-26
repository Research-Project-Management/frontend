'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collectionKeys,
  getCollections,
  invalidateCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../../services/collection.service';
import type {
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from '../../types/library.types';

export function useCollections(workspaceId: string) {
  const queryClient = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(workspaceId),
    queryFn: () => getCollections(workspaceId),
    enabled: Boolean(workspaceId),
    select: (data) => data.collections || [],
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDTO) => createCollection(workspaceId, data),
    onSuccess: () => invalidateCollections(queryClient, workspaceId),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCollectionDTO & { collectionId: string }) => {
      const { collectionId, ...rest } = data;
      return updateCollection(workspaceId, collectionId, rest);
    },
    onSuccess: () => invalidateCollections(queryClient, workspaceId),
  });

  const deleteMutation = useMutation({
    mutationFn: (collectionId: string) => deleteCollection(workspaceId, collectionId),
    onSuccess: () => invalidateCollections(queryClient, workspaceId),
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
