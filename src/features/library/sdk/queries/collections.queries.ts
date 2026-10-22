'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  libraryServices,
  CollectionsService,
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

function resolveCachedCollectionVersion(
  queryClient: QueryClient,
  effectiveScope: string,
  collectionId: string,
  explicitExpectedVersion?: number,
  explicitVersion?: number,
): number | undefined {
  if (typeof explicitExpectedVersion === 'number') return explicitExpectedVersion;
  if (typeof explicitVersion === 'number') return explicitVersion;

  const cached = queryClient.getQueryData<Collection>(
    collectionKeys.byId(effectiveScope, collectionId),
  );
  if (typeof cached?.version === 'number') {
    return cached.version;
  }

  const listData = queryClient.getQueryData<
    Collection[] | { collections: Collection[] }
  >(collectionKeys.all(effectiveScope));
  const collections = Array.isArray(listData) ? listData : listData?.collections;
  if (Array.isArray(collections)) {
    const found = collections.find((c) => c.id === collectionId);
    if (typeof found?.version === 'number') {
      return found.version;
    }
  }

  return undefined;
}

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
    queryFn: () => CollectionsService.getAll(scopeId),
    enabled: (explicitEnabled ?? true) && Boolean(scopeId),
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDTO & { scopeId?: string }) => {
      const targetScope = data.scopeId || scopeId;
      const rawParent = data.parentId ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const payload: CreateCollectionDTO = {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      };
      return CollectionsService.create(targetScope, payload);
    },
    onSuccess: (_res, variables) => {
      const targetScope = variables.scopeId || scopeId;
      invalidateCollections(queryClient, targetScope);
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
    mutationFn: (
      data: UpdateCollectionDTO & { collectionId: string; scopeId?: string },
    ) => {
      const { collectionId, scopeId: overrideScope, ...rest } = data;
      const targetScope = overrideScope || scopeId;
      const rawParent = rest.parentId;
      const cleanParentId = rawParent === 'root' ? null : rawParent;

      const resolvedVersion = resolveCachedCollectionVersion(
        queryClient,
        targetScope,
        collectionId,
        rest.expectedVersion,
        rest.version,
      );

      const payload: UpdateCollectionDTO = {
        name: rest.name !== undefined ? rest.name.trim() : undefined,
        description:
          rest.description !== undefined ? rest.description.trim() : undefined,
        color: rest.color,
        icon: rest.icon,
        expectedVersion: resolvedVersion,
        version: resolvedVersion,
      };
      if (rawParent !== undefined) {
        payload.parentId = cleanParentId;
      }
      return CollectionsService.update(targetScope, collectionId, payload);
    },
    onMutate: async (data) => {
      const targetScope = data.scopeId || scopeId;
      await queryClient.cancelQueries({ queryKey: collectionKeys.all(targetScope) });
      const previousCollections = queryClient.getQueryData<
        Collection[] | { collections: Collection[] }
      >(collectionKeys.all(targetScope));

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
            collectionKeys.all(targetScope),
            updateList(previousCollections),
          );
        } else if (previousCollections?.collections) {
          queryClient.setQueryData(collectionKeys.all(targetScope), {
            ...previousCollections,
            collections: updateList(previousCollections.collections),
          });
        }
      }

      return { previousCollections, targetScope };
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousCollections) {
        queryClient.setQueryData(
          collectionKeys.all(context.targetScope || scopeId),
          context.previousCollections,
        );
      }
      const isConflict =
        (err as { status?: number })?.status === 409 ||
        err.message?.includes('409') ||
        err.message?.toLowerCase().includes('conflict') ||
        err.message?.toLowerCase().includes('version');
      toast.error(
        isConflict ? 'Conflict: Collection modified concurrently' : 'Failed to update collection',
        {
          description: isConflict
            ? 'The collection was updated elsewhere. State refreshed to latest version.'
            : (err.message || 'Please try again.'),
          id: 'collection-mutation',
        },
      );
    },
    onSettled: (_res, _err, variables) => {
      const targetScope = variables.scopeId || scopeId;
      invalidateCollections(queryClient, targetScope);
    },
    onSuccess: () => {
      toast.success('Collection updated', { id: 'collection-mutation' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (
      input:
        | string
        | {
            collectionId: string;
            strategy?: 'cascade' | 'move-to-parent' | 'orphan';
            scopeId?: string;
          },
    ) => {
      const collectionId = typeof input === 'string' ? input : input.collectionId;
      const strategy = typeof input === 'string' ? undefined : input.strategy;
      const targetScope = (typeof input === 'object' ? input.scopeId : undefined) || scopeId;
      return CollectionsService.delete(targetScope, collectionId, strategy);
    },
    onSuccess: (_res, input) => {
      const strategy = typeof input === 'string' ? undefined : input.strategy;
      const targetScope = (typeof input === 'object' ? input.scopeId : undefined) || scopeId;
      invalidateCollections(queryClient, targetScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.counts(targetScope) });
      toast.success('Collection deleted', {
        description:
          strategy === 'cascade'
            ? 'Collection deleted and contained items moved to Trash.'
            : 'Contained items were unfiled to library, not deleted.',
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

  return {
    collections,
    isLoading: collectionsQuery.isLoading,
    isError: collectionsQuery.isError,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    create: createMutation.mutate,
    createAsync: createMutation.mutateAsync,
    createCollection: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateAsync: updateMutation.mutateAsync,
    updateCollection: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteAsync: deleteMutation.mutateAsync,
    deleteCollection: deleteMutation.mutateAsync,
    refetch: collectionsQuery.refetch,
  };
}

export function useCollectionsQuery(
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const targetScope = scopeId || 'user';
  return useQuery({
    queryKey: libraryKeys.collections(targetScope),
    queryFn: () => CollectionsService.getAll(targetScope),
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
    staleTime: 1000 * 60,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: (data: CreateCollectionDTO) => {
      const rawParent = data.parentId ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const payload: CreateCollectionDTO = {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      };
      return CollectionsService.create(effectiveScope, payload);
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

export function useMoveCollectionItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScopeId = scopeId || 'user';

  return useMutation({
    mutationFn: ({
      targetCollectionId,
      itemIds,
      scopeId: overrideScope,
    }: {
      targetCollectionId: string | null;
      itemIds: string[];
      sourceCollectionId?: string | null;
      scopeId?: string;
    }) => {
      const targetScope = overrideScope || effectiveScopeId;
      return libraryServices.collections.moveItems(
        targetScope,
        targetCollectionId || 'unfiled',
        itemIds,
      );
    },
    onSuccess: (_data, variables) => {
      const targetScope = variables.scopeId || effectiveScopeId;
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.all(targetScope) });
      if (variables.targetCollectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, variables.targetCollectionId),
        });
      }
      if (variables.sourceCollectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, variables.sourceCollectionId),
        });
      }
      invalidateCollections(queryClient, targetScope);
    },
  });
}

export function useAssignCollectionItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScopeId = scopeId || 'user';

  return useMutation({
    mutationFn: ({
      collectionId,
      itemIds,
    }: {
      collectionId: string;
      itemIds: string | string[];
    }) =>
      CollectionsService.assignItems(
        effectiveScopeId,
        collectionId,
        Array.isArray(itemIds) ? itemIds : [itemIds],
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScopeId) });
      queryClient.invalidateQueries({ queryKey: collectionKeys.all(effectiveScopeId) });
      queryClient.invalidateQueries({
        queryKey: itemKeys.byCollection(effectiveScopeId, variables.collectionId),
      });
      invalidateCollections(queryClient, effectiveScopeId);
    },
  });
}
