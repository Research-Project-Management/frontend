'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ItemsService,
  RelationsService,
} from '../clients/items.client';
import {
  SavedSearchesService,
  type CreateSavedSearchInput,
  type UpdateSavedSearchInput,
  type SavedSearchConditionGroup,
} from '../clients/catalog-entities.client';
import type {
  Item,
  SavedSearchScopeOptions,
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
  TypeConversionPreview,
} from '@/features/library/types/core.types';
import { mapBackendItem } from '@/features/library/domain/metadata/mapper';
import {
  itemKeys,
  savedSearchKeys,
  relationKeys,
  normalizeSpaceId,
  waitForBootstrapCache,
  getReaderBootstrapScope,
} from '@/features/library/sdk/query-keys';
import {
  patchItemAcrossScopeCaches,
  invalidateLibraryCatalogDependencies,
  resolveCachedItemFromScope,
} from './cache-patcher.queries';

export { savedSearchKeys, relationKeys };
export type {
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
  TypeConversionPreview,
};

// SAVED SEARCHES QUERY HOOKS

const invalidateSavedSearches = (qc: QueryClient, spaceId?: string) => {
  qc.invalidateQueries({ queryKey: savedSearchKeys.all(normalizeSpaceId(spaceId)) });
};

export function useSavedSearches(
  spaceId?: string,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);
  const cacheKey = savedSearchKeys.all(effectiveScope);

  const savedSearchesQuery = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded = await waitForBootstrapCache<Awaited<ReturnType<typeof SavedSearchesService.getAll>>>(
        queryClient,
        effectiveScope,
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      return SavedSearchesService.getAll(effectiveScope);
    },
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSavedSearchInput) => {
      const targetScope = normalizeSpaceId(data.targetScope || data.scope || effectiveScope);
      const created = await SavedSearchesService.create(targetScope, data);
      return { created, targetScope };
    },
    onSuccess: ({ targetScope }, variables) => {
      invalidateSavedSearches(queryClient, targetScope);
      if (targetScope !== effectiveScope) {
        invalidateSavedSearches(queryClient, effectiveScope);
      }
      const varScope = variables.targetScope ? normalizeSpaceId(variables.targetScope) : undefined;
      if (varScope && varScope !== effectiveScope && varScope !== targetScope) {
        invalidateSavedSearches(queryClient, varScope);
      }
      toast.success('Smart collection created', { id: 'saved-search-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create smart collection', {
        description: err.message || 'Please check your conditions and try again.',
        id: 'saved-search-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSavedSearchInput }) => {
      const targetScope = normalizeSpaceId(data.targetScope || data.scope || effectiveScope);
      const updated = await SavedSearchesService.update(targetScope, id, data);
      return { updated, targetScope };
    },
    onSuccess: ({ targetScope }, variables) => {
      invalidateSavedSearches(queryClient, effectiveScope);
      queryClient.invalidateQueries({
        queryKey: savedSearchKeys.byId(effectiveScope, variables.id),
      });
      if (targetScope && targetScope !== effectiveScope) {
        invalidateSavedSearches(queryClient, targetScope);
        queryClient.invalidateQueries({
          queryKey: savedSearchKeys.byId(targetScope, variables.id),
        });
      }
      const varTargetScope = variables.data.targetScope || variables.data.scope;
      if (varTargetScope && varTargetScope !== effectiveScope && varTargetScope !== targetScope) {
        invalidateSavedSearches(queryClient, varTargetScope);
        queryClient.invalidateQueries({
          queryKey: savedSearchKeys.byId(varTargetScope, variables.id),
        });
      }
      toast.success('Smart collection updated', { id: 'saved-search-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to update smart collection', {
        description: err.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SavedSearchesService.delete(effectiveScope, id),
    onSuccess: () => {
      invalidateSavedSearches(queryClient, effectiveScope);
      toast.success('Smart collection deleted', { id: 'saved-search-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete smart collection', {
        description: err.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (args: SavedSearchConditionGroup | { conditions: SavedSearchConditionGroup; sortBy?: string; sortOrder?: 'asc' | 'desc'; scopeOptions?: SavedSearchScopeOptions }) => {
      const isWrapped = 'conditions' in args && !Array.isArray(args.conditions);
      if (isWrapped) {
        const wrapped = args as { conditions: SavedSearchConditionGroup; sortBy?: string; sortOrder?: 'asc' | 'desc'; scopeOptions?: SavedSearchScopeOptions };
        return SavedSearchesService.preview(effectiveScope, wrapped.conditions, {
          sortBy: wrapped.sortBy,
          sortOrder: wrapped.sortOrder,
          scopeOptions: wrapped.scopeOptions,
        });
      }
      return SavedSearchesService.preview(effectiveScope, args as SavedSearchConditionGroup);
    },
  });

  return {
    savedSearches: savedSearchesQuery.data || [],
    isLoading: savedSearchesQuery.isLoading,
    isError: savedSearchesQuery.isError,
    error: savedSearchesQuery.error,
    createSavedSearch: createMutation.mutateAsync,
    updateSavedSearch: updateMutation.mutateAsync,
    deleteSavedSearch: deleteMutation.mutateAsync,
    previewConditions: previewMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    refetch: savedSearchesQuery.refetch,
  };
}

export function useSavedSearchResults(
  spaceId: string | undefined,
  id: string | null,
  params?: {
    limit?: number;
    page?: number;
    cursor?: string;
    sortBy?: string;
    sortOrder?: string;
  },
) {
  const effectiveScope = normalizeSpaceId(spaceId);

  return useQuery({
    queryKey: savedSearchKeys.results(effectiveScope, id || '', params),
    queryFn: () => {
      if (!id) return null;
      return SavedSearchesService.getResults(effectiveScope, id, params);
    },
    enabled: Boolean(id && effectiveScope),
    placeholderData: (previousData) => previousData,
    gcTime: 5 * 60 * 1000,
  });
}

// RELATIONS QUERY HOOKS

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

export function useItemTypeConversionPreviewQuery(
  spaceId: string,
  itemId: string | undefined,
  targetType: string | undefined,
  enabled = true,
) {
  const effectiveSpaceId = normalizeSpaceId(spaceId);

  return useQuery({
    queryKey: itemKeys.typeConversionPreview(effectiveSpaceId, itemId, targetType),
    queryFn: () =>
      ItemsService.previewConvertType(
        effectiveSpaceId,
        itemId!,
        targetType!,
        true,
      ).then(
        (res: unknown): TypeConversionPreview =>
          (res as { preview?: TypeConversionPreview; data?: TypeConversionPreview })
            ?.preview ??
          (res as { data?: TypeConversionPreview })?.data ??
          (res as TypeConversionPreview),
      ),
    enabled: Boolean(enabled && itemId && targetType),
  });
}

export function useItemTypeConversion(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveSpaceId = normalizeSpaceId(spaceId);

  const convertMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      expectedVersion,
      retainUnmappedInExtra = true,
      silent = false,
    }: {
      itemId: string;
      targetType: string;
      expectedVersion?: number;
      retainUnmappedInExtra?: boolean;
      silent?: boolean;
    }) => {
      const resolvedExpectedVersion =
        expectedVersion ??
        resolveCachedItemFromScope(queryClient, effectiveSpaceId, itemId)?.version;
      return ItemsService.convertType(
        effectiveSpaceId,
        itemId,
        targetType,
        resolvedExpectedVersion,
        retainUnmappedInExtra,
      );
    },
    onSuccess: (data, variables) => {
      const rawUpdated =
        (data as { item?: unknown; data?: unknown })?.item ??
        (data as { data?: unknown })?.data ??
        data;
      if (rawUpdated && typeof rawUpdated === 'object' && 'id' in rawUpdated) {
        const mapped = mapBackendItem(rawUpdated as Record<string, unknown>) as Item;
        patchItemAcrossScopeCaches(queryClient, effectiveSpaceId, variables.itemId, mapped);
      }
      void invalidateLibraryCatalogDependencies(queryClient, effectiveSpaceId, {
        itemId: variables.itemId,
        itemsList: true,
        counts: true,
        smartCollections: true,
      });
      if (!variables.silent) {
        toast.success('Item type converted', {
          description: variables.retainUnmappedInExtra
            ? 'Unmapped fields have been preserved in Extra.'
            : undefined,
          id: 'type-conversion',
        });
      }
    },
    onError: (err: Error, variables) => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.byId(effectiveSpaceId, variables.itemId),
      });
      toast.error('Conversion failed', {
        description: err.message || 'Could not convert item type.',
        id: 'type-conversion',
      });
    },
  });

  return {
    convertAsync: convertMutation.mutateAsync,
    isConverting: convertMutation.isPending,
  };
}

