'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CollectionsService,
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../library.client';
import type {
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from '@/features/library/domain/types/library.types';
import {
  itemKeys,
  libraryKeys,
  collectionKeys,
  invalidateCollections,
} from '@/features/library/sdk/query-keys';

export { collectionKeys, invalidateCollections };

export type UseCollectionsScopeInput =
  | string
  | { scopeId?: string; projectId?: string; enabled?: boolean };

export function useCollections(scopeIdOrOptions?: UseCollectionsScopeInput) {
  const scopeId =
    typeof scopeIdOrOptions === 'string'
      ? scopeIdOrOptions
      : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');
  const explicitEnabled =
    typeof scopeIdOrOptions === 'object' ? scopeIdOrOptions?.enabled : undefined;

  const queryClient = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(scopeId),
    queryFn: () => getCollections(scopeId),
    enabled: (explicitEnabled ?? true) && Boolean(scopeId),
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDTO) => {
      const rawParent = data.parentId ?? data.parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const payload: CreateCollectionDTO = {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      };
      return createCollection(scopeId, payload);
    },
    onSuccess: () => {
      invalidateCollections(queryClient, scopeId);
      toast.success('Collection created', { id: 'collection-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create collection', {
        description: err.message || 'Please check the name and try again.',
        id: 'collection-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCollectionDTO & { collectionId: string }) => {
      const { collectionId, ...rest } = data;
      const rawParent =
        rest.parentId ?? (rest as { parent?: string | null }).parent ?? undefined;
      const cleanParentId = rawParent === 'root' ? null : rawParent;
      const payload: UpdateCollectionDTO = {
        name: rest.name !== undefined ? rest.name.trim() : undefined,
        description:
          rest.description !== undefined ? rest.description.trim() : undefined,
        color: rest.color,
        icon: rest.icon,
      };
      if (rawParent !== undefined) {
        payload.parentId = cleanParentId;
      }
      return updateCollection(scopeId, collectionId, payload);
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: collectionKeys.all(scopeId) });
      const previousCollections = queryClient.getQueryData<
        Collection[] | { collections: Collection[] }
      >(collectionKeys.all(scopeId));

      if (previousCollections) {
        const updateList = (cols: Collection[]) =>
          cols.map((col) =>
            col.id === data.collectionId
              ? {
                  ...col,
                  ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                  ...(data.color !== undefined ? { color: data.color } : {}),
                  ...(data.icon !== undefined ? { icon: data.icon } : {}),
                  ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
                }
              : col,
          );

        if (Array.isArray(previousCollections)) {
          queryClient.setQueryData(
            collectionKeys.all(scopeId),
            updateList(previousCollections),
          );
        } else if (previousCollections?.collections) {
          queryClient.setQueryData(collectionKeys.all(scopeId), {
            ...previousCollections,
            collections: updateList(previousCollections.collections),
          });
        }
      }

      return { previousCollections };
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(
          collectionKeys.all(scopeId),
          context.previousCollections,
        );
      }
      toast.error('Failed to update collection', {
        description: err.message || 'Please try again.',
        id: 'collection-mutation',
      });
    },
    onSettled: () => {
      invalidateCollections(queryClient, scopeId);
    },
    onSuccess: () => {
      toast.success('Collection updated', { id: 'collection-mutation' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (collectionId: string) => deleteCollection(scopeId, collectionId),
    onSuccess: () => {
      invalidateCollections(queryClient, scopeId);
      toast.success('Collection deleted', {
        description: 'Contained items were unfiled to library, not deleted.',
        id: 'collection-mutation',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete collection', {
        description: err.message || 'Please try again.',
        id: 'collection-mutation',
      });
    },
  });

  const collections = collectionsQuery.data ?? [];

  const state = {
    collections,
    isLoading: collectionsQuery.isLoading,
    isError: collectionsQuery.isError,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };

  const actions = {
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    refetch: collectionsQuery.refetch,
  };

  return {
    state,
    actions,
    collections,
    isLoading: collectionsQuery.isLoading,
    isError: collectionsQuery.isError,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createCollection: createMutation.mutateAsync,
    updateCollection: updateMutation.mutateAsync,
    deleteCollection: deleteMutation.mutateAsync,
    refetch: collectionsQuery.refetch,
  };
}

export function useCollectionsQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.collections(targetScope),
    queryFn: () => getCollections(targetScope),
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
    staleTime: 1000 * 60,
  });
}

export function useCreateCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: (data: CreateCollectionDTO) => {
      const rawParent = data.parentId ?? data.parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const payload: CreateCollectionDTO = {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      };
      return createCollection(effectiveScope, payload);
    },
    onSuccess: () => {
      invalidateCollections(queryClient, effectiveScope);
      toast.success('Collection created', { id: 'collection-create' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create collection', {
        description: err.message || 'Please try again.',
        id: 'collection-create',
      });
    },
  });
}

export function useDetachItemFromCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: ({ collectionId, itemId }: { collectionId: string; itemId: string }) =>
      CollectionsService.detachItem(effectiveScope, collectionId, itemId),
    onSuccess: () => {
      invalidateCollections(queryClient, effectiveScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Removed item from collection', {
        description:
          'Item remains safely in your library (now in Unfiled Items if not in other collections).',
        id: 'detach-item',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to remove item from collection', {
        description: err.message || 'Please try again.',
      });
    },
  });
}

export function useBatchDetachItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: async ({
      collectionId,
      itemIds,
    }: {
      collectionId: string;
      itemIds: string[];
    }) => {
      await CollectionsService.bulkDetachItems(effectiveScope, collectionId, itemIds);
    },
    onSuccess: (_data, variables) => {
      invalidateCollections(queryClient, effectiveScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success(`Removed ${variables.itemIds.length} item(s) from collection`, {
        description:
          'Items remain safely in your library (now in Unfiled Items if not in other collections).',
        id: 'batch-detach-items',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to remove items from collection', {
        description: err.message || 'Please try again.',
      });
    },
  });
}
