'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CollectionsService } from '../clients/catalog-entities.client';

export function copyLibraryCollection(
  spaceId: string | undefined,
  collectionId: string,
  options?: { parentId?: string | null; name?: string },
) {
  return CollectionsService.copy(spaceId, collectionId, options);
}

export function exportCollectionBibtex(spaceId: string | undefined, collectionId: string) {
  return CollectionsService.exportBibtex(spaceId, collectionId);
}

export function exportCollectionBundle(spaceId: string | undefined, collectionId: string) {
  return CollectionsService.exportBundle(spaceId, collectionId);
}
import type {
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from '@/features/library/types/core.types';
import {
  itemKeys,
  libraryKeys,
  collectionKeys,
  invalidateCollections,
  normalizeSpaceId,
  waitForBootstrapCache,
} from '@/features/library/sdk/query-keys';
import { chunkUniqueIds } from './cache-patcher.queries';

export { collectionKeys, invalidateCollections };

type UseCollectionsScopeInput =
  | string
  | { spaceId?: string; projectId?: string; enabled?: boolean };

function resolveCachedCollectionVersion(
  queryClient: QueryClient,
  effectiveScope: string,
  collectionId: string,
  explicitExpectedVersion?: number,
  explicitVersion?: number,
): number | undefined {
  if (typeof explicitExpectedVersion === 'number') return explicitExpectedVersion;
  if (typeof explicitVersion === 'number') return explicitVersion;

  const targetScope = normalizeSpaceId(effectiveScope);
  const cached = queryClient.getQueryData<Collection>(
    collectionKeys.byId(targetScope, collectionId),
  );
  if (typeof cached?.version === 'number') {
    return cached.version;
  }

  const listData = queryClient.getQueryData<
    Collection[] | { collections: Collection[] }
  >(collectionKeys.all(targetScope));
  const collections = Array.isArray(listData) ? listData : listData?.collections;
  if (Array.isArray(collections)) {
    const found = collections.find((c) => c.id === collectionId);
    if (typeof found?.version === 'number') {
      return found.version;
    }
  }

  return undefined;
}

export function useCollections(spaceIdOrOptions?: UseCollectionsScopeInput) {
  const rawScope =
    typeof spaceIdOrOptions === 'string'
      ? spaceIdOrOptions
      : (spaceIdOrOptions?.spaceId || spaceIdOrOptions?.projectId);
  const spaceId = normalizeSpaceId(rawScope);
  const explicitEnabled =
    typeof spaceIdOrOptions === 'object' ? spaceIdOrOptions?.enabled : undefined;

  const queryClient = useQueryClient();
  const cacheKey = collectionKeys.all(spaceId);

  const collectionsQuery = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded = await waitForBootstrapCache<Collection[] | { collections: Collection[] }>(
        queryClient,
        spaceId,
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      return CollectionsService.getAll(spaceId);
    },
    enabled: (explicitEnabled ?? true) && Boolean(spaceId),
    staleTime: 1000 * 60,
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDTO & { spaceId?: string }) => {
      const targetScope = normalizeSpaceId(data.spaceId || spaceId);
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
      const targetScope = normalizeSpaceId(variables.spaceId || spaceId);
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
      data: UpdateCollectionDTO & { collectionId: string; spaceId?: string },
    ) => {
      const { collectionId, spaceId: overrideScope, ...rest } = data;
      const targetScope = normalizeSpaceId(overrideScope || spaceId);
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
      const targetScope = normalizeSpaceId(data.spaceId || spaceId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: collectionKeys.all(targetScope) }),
        queryClient.cancelQueries({ queryKey: collectionKeys.byId(targetScope, data.collectionId) }),
      ]);
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
          collectionKeys.all(context.targetScope || spaceId),
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
      const targetScope = normalizeSpaceId(variables.spaceId || spaceId);
      invalidateCollections(queryClient, targetScope);
    },
    onSuccess: (updatedCollection, variables) => {
      const targetScope = normalizeSpaceId(variables.spaceId || spaceId);
      const serverCollection =
        updatedCollection &&
        typeof updatedCollection === 'object' &&
        'collection' in updatedCollection &&
        (updatedCollection as { collection?: Collection }).collection
          ? (updatedCollection as { collection: Collection }).collection
          : (updatedCollection as Partial<Collection> | undefined);

      if (serverCollection && typeof serverCollection === 'object') {
        queryClient.setQueryData(
          collectionKeys.byId(targetScope, variables.collectionId),
          (old: Collection | undefined) =>
            old ? { ...old, ...serverCollection } : (serverCollection as Collection),
        );
        queryClient.setQueryData<Collection[] | { collections: Collection[] }>(
          collectionKeys.all(targetScope),
          (old) => {
            if (!old) return old;
            const patchList = (cols: Collection[]) =>
              cols.map((col) =>
                col.id === variables.collectionId ? { ...col, ...serverCollection } : col,
              );
            if (Array.isArray(old)) return patchList(old);
            if (Array.isArray(old.collections)) {
              return { ...old, collections: patchList(old.collections) };
            }
            return old;
          },
        );
      }
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
            spaceId?: string;
          },
    ) => {
      const collectionId = typeof input === 'string' ? input : input.collectionId;
      const strategy = typeof input === 'string' ? undefined : input.strategy;
      const targetScope = normalizeSpaceId(typeof input === 'object' ? input.spaceId : spaceId);
      return CollectionsService.delete(targetScope, collectionId, strategy);
    },
    onSuccess: (_res, input) => {
      const collectionId = typeof input === 'string' ? input : input.collectionId;
      const strategy = typeof input === 'string' ? undefined : input.strategy;
      const targetScope = normalizeSpaceId(typeof input === 'object' ? input.spaceId : spaceId);
      queryClient.removeQueries({ queryKey: collectionKeys.byId(targetScope, collectionId) });
      invalidateCollections(queryClient, targetScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
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
    createCollection: createMutation.mutateAsync,
    update: updateMutation.mutate,
    updateCollection: updateMutation.mutateAsync,
    delete: deleteMutation.mutate,
    deleteCollection: deleteMutation.mutateAsync,
    refetch: collectionsQuery.refetch,
  };
}

export function useCollectionsQuery(
  spaceId?: string,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const targetScope = normalizeSpaceId(spaceId);
  const cacheKey = libraryKeys.collections(targetScope);
  return useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded = await waitForBootstrapCache<Collection[] | { collections: Collection[] }>(
        queryClient,
        targetScope,
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      return CollectionsService.getAll(targetScope);
    },
    select: (data) => (Array.isArray(data) ? data : (data?.collections || [])),
    staleTime: 1000 * 60,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateCollectionMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

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

export function useDetachItemFromCollectionMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

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

export function useBatchDetachItemsMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: async ({
      collectionId,
      itemIds,
    }: {
      collectionId: string;
      itemIds: string[];
    }) => {
      const chunks = chunkUniqueIds(itemIds, 500);
      await Promise.all(
        chunks.map((chunk) =>
          CollectionsService.bulkDetachItems(effectiveScope, collectionId, chunk),
        ),
      );
    },
    onSuccess: (_data, variables) => {
      toast.success(`Removed ${variables.itemIds.length} item(s) from collection`, {
        description:
          'Items remain safely in your library (now in Unfiled Items if not in other collections).',
        id: 'batch-detach-items',
      });
    },
    onSettled: () => {
      invalidateCollections(queryClient, effectiveScope);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
    },
    onError: (err: Error) => {
      toast.error('Failed to remove items from collection', {
        description: err.message || 'Please try again.',
      });
    },
  });
}

export function useMoveCollectionItemsMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveSpaceId = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: async ({
      targetCollectionId,
      itemIds,
      sourceCollectionId,
      spaceId: overrideScope,
    }: {
      targetCollectionId: string | null;
      itemIds: string[];
      sourceCollectionId?: string | null;
      spaceId?: string;
    }) => {
      const targetScope = normalizeSpaceId(overrideScope || effectiveSpaceId);
      const chunks = chunkUniqueIds(itemIds, 500);
      await Promise.all(
        chunks.map((chunk) =>
          CollectionsService.moveItems(
            targetScope,
            targetCollectionId || 'unfiled',
            chunk,
            sourceCollectionId,
          ),
        ),
      );
    },
    onSettled: (_data, _err, variables) => {
      const targetScope = normalizeSpaceId(variables?.spaceId || effectiveSpaceId);
      queryClient.invalidateQueries({ queryKey: itemKeys.all(targetScope) });
      if (variables?.targetCollectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, variables.targetCollectionId),
        });
      }
      if (variables?.sourceCollectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(targetScope, variables.sourceCollectionId),
        });
      }
      invalidateCollections(queryClient, targetScope);
    },
  });
}

export function useAssignCollectionItemsMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveSpaceId = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: async ({
      collectionId,
      itemIds,
    }: {
      collectionId: string;
      itemIds: string | string[];
    }) => {
      const rawIds = Array.isArray(itemIds) ? itemIds : [itemIds];
      const chunks = chunkUniqueIds(rawIds, 500);
      await Promise.all(
        chunks.map((chunk) =>
          CollectionsService.assignItems(effectiveSpaceId, collectionId, chunk),
        ),
      );
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveSpaceId) });
      if (variables?.collectionId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byCollection(effectiveSpaceId, variables.collectionId),
        });
      }
      invalidateCollections(queryClient, effectiveSpaceId);
    },
  });
}
