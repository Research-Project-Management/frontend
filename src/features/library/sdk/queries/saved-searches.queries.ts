'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  SavedSearchesService,
  type CreateSavedSearchInput,
  type UpdateSavedSearchInput,
  type SavedSearchConditionGroup,
} from '../clients/saved-searches.client';
import type { SavedSearchScopeOptions } from '@/features/library/types/core.types';
import {
  savedSearchKeys,
  normalizeSpaceId,
  waitForBootstrapCache,
} from '@/features/library/sdk/query-keys';

export { savedSearchKeys };

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
