'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ItemsService,
  SavedSearchesService,
  RelationsService,
  type CreateSavedSearchInput,
  type UpdateSavedSearchInput,
  type SavedSearchConditionGroup,
} from '../library.client';
import type { Item, SavedSearchScopeOptions } from '@/features/library/domain/types/library.types';
import { mapBackendItem } from '@/features/library/domain/metadata';
import {
  itemKeys,
  savedSearchKeys,
  relationKeys,
  normalizeScopeId,
} from '@/features/library/sdk/query-keys';
import {
  patchItemAcrossScopeCaches,
  invalidateLibraryCatalogDependencies,
} from './cache-patcher';

export { savedSearchKeys, relationKeys };

// SAVED SEARCHES QUERY HOOKS

export const invalidateSavedSearches = (qc: QueryClient, scopeId?: string) => {
  qc.invalidateQueries({ queryKey: savedSearchKeys.all(normalizeScopeId(scopeId)) });
};

export function useSavedSearches(
  scopeId?: string,
  options?: { enabled?: boolean },
) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  const savedSearchesQuery = useQuery({
    queryKey: savedSearchKeys.all(effectiveScope),
    queryFn: () => SavedSearchesService.getAll(effectiveScope),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSavedSearchInput) => {
      const targetScope = normalizeScopeId(data.targetScope || data.scope || effectiveScope);
      const created = await SavedSearchesService.create(targetScope, data);
      return { created, targetScope };
    },
    onSuccess: ({ targetScope }, variables) => {
      invalidateSavedSearches(queryClient, targetScope);
      if (targetScope !== effectiveScope) {
        invalidateSavedSearches(queryClient, effectiveScope);
      }
      const varScope = variables.targetScope ? normalizeScopeId(variables.targetScope) : undefined;
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
      const targetScope = normalizeScopeId(data.targetScope || data.scope || effectiveScope);
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
    isPreviewing: previewMutation.isPending,
    refetch: savedSearchesQuery.refetch,
  };
}

export function useSavedSearchResults(
  scopeId: string | undefined,
  id: string | null,
  params?: {
    limit?: number;
    page?: number;
    cursor?: string;
    sortBy?: string;
    sortOrder?: string;
  },
) {
  const effectiveScope = scopeId || null;

  return useQuery({
    queryKey: savedSearchKeys.results(effectiveScope ?? undefined, id || '', params),
    queryFn: () => {
      if (!id) return null;
      return SavedSearchesService.getResults(effectiveScope || 'user', id, params);
    },
    enabled: !!id && !!effectiveScope,
    gcTime: 5 * 60 * 1000,
  });
}

// RELATIONS QUERY HOOKS

export function useRelations(
  scopeIdOrOptions?:
    | string
    | { scopeId?: string; projectId?: string; enabled?: boolean },
  itemId?: string,
  options?: { enabled?: boolean },
) {
  const scopeId =
    typeof scopeIdOrOptions === 'string'
      ? scopeIdOrOptions
      : (scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || 'user');
  const explicitEnabled =
    (typeof scopeIdOrOptions === 'object' ? scopeIdOrOptions?.enabled : undefined) ??
    options?.enabled ??
    true;

  const queryClient = useQueryClient();
  const effectiveItemId = itemId || '';

  const relationsQuery = useQuery({
    queryKey: relationKeys.all(scopeId, effectiveItemId),
    queryFn: () => RelationsService.getRelated(scopeId || '', effectiveItemId),
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
        scopeId || '',
        effectiveItemId,
        targets.length === 1 ? targets[0] : targets,
        relationType,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
      const targets =
        variables.targetItemIds ||
        (variables.targetItemId ? [variables.targetItemId] : []);
      for (const tId of targets) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(scopeId, tId),
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
        scopeId || '',
        effectiveItemId,
        variables.targetItemId,
        variables.relationType,
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: relationKeys.all(scopeId, effectiveItemId),
      });
      if (variables.targetItemId) {
        queryClient.invalidateQueries({
          queryKey: relationKeys.all(scopeId, variables.targetItemId),
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
    isUnlinking: unlinkMutation.isPending,
  };
}

// CONVERSION QUERY HOOKS

import type {
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
  TypeConversionPreview,
} from '@/features/library/domain/types/library.types';

export type {
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
  TypeConversionPreview,
};

export function useItemTypeConversionPreviewQuery(
  scopeId: string,
  itemId: string | undefined,
  targetType: string | undefined,
  enabled = true,
) {
  const effectiveScopeId = normalizeScopeId(scopeId);

  return useQuery({
    queryKey: itemKeys.typeConversionPreview(effectiveScopeId, itemId, targetType),
    queryFn: () =>
      ItemsService.previewConvertType(
        effectiveScopeId,
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

export function useItemTypeConversion(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScopeId = scopeId || 'user';

  const previewMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      retainUnmappedInExtra = true,
    }: {
      itemId: string;
      targetType: string;
      retainUnmappedInExtra?: boolean;
    }) =>
      ItemsService.previewConvertType(
        effectiveScopeId,
        itemId,
        targetType,
        retainUnmappedInExtra,
      ).then(
        (res: unknown): TypeConversionPreview =>
          (res as { preview?: TypeConversionPreview; data?: TypeConversionPreview })
            ?.preview ??
          (res as { data?: TypeConversionPreview })?.data ??
          (res as TypeConversionPreview),
      ),
    onError: (err: Error) => {
      toast.error('Preview failed', {
        description: err.message || 'Failed to preview type conversion.',
        id: 'type-conversion-preview',
      });
    },
  });

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
    }) =>
      ItemsService.convertType(
        effectiveScopeId,
        itemId,
        targetType,
        expectedVersion,
        retainUnmappedInExtra,
      ),
    onSuccess: (data, variables) => {
      const rawUpdated =
        (data as { item?: unknown; data?: unknown })?.item ??
        (data as { data?: unknown })?.data ??
        data;
      if (rawUpdated && typeof rawUpdated === 'object' && 'id' in rawUpdated) {
        const mapped = mapBackendItem(rawUpdated as Record<string, unknown>) as Item;
        patchItemAcrossScopeCaches(queryClient, effectiveScopeId, variables.itemId, mapped);
      }
      void invalidateLibraryCatalogDependencies(queryClient, effectiveScopeId, {
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
        queryKey: itemKeys.byId(effectiveScopeId, variables.itemId),
      });
      toast.error('Conversion failed', {
        description: err.message || 'Could not convert item type.',
        id: 'type-conversion',
      });
    },
  });

  return {
    previewAsync: previewMutation.mutateAsync,
    convertAsync: convertMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    isConverting: convertMutation.isPending,
    previewData: previewMutation.data as TypeConversionPreview | undefined,
    conversionResult: convertMutation.data,
  };
}

