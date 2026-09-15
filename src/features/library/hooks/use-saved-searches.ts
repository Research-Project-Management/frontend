'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SavedSearchService, SavedSearchesService } from '../services/saved-searches.service';
import type {
  CreateSavedSearchInput,
  UpdateSavedSearchInput,
  SavedSearchConditionGroup,
} from '../types/library.types';

export const savedSearchKeys = {
  all: (workspaceId?: string) => ['saved-searches', workspaceId || 'user'] as const,
  byId: (workspaceId: string | undefined, id: string) => ['saved-searches', workspaceId || 'user', id] as const,
  results: (workspaceId: string | undefined, id: string, params?: Record<string, any>) =>
    ['saved-searches', workspaceId || 'user', id, 'results', params] as const,
};

export const invalidateSavedSearches = (qc: QueryClient, workspaceId?: string) => {
  qc.invalidateQueries({ queryKey: savedSearchKeys.all(workspaceId) });
};

export function useSavedSearches(workspaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = workspaceId || 'user';

  const savedSearchesQuery = useQuery({
    queryKey: savedSearchKeys.all(workspaceId),
    queryFn: () => SavedSearchService.getAll(workspaceId),
    enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateSavedSearchInput) =>
      SavedSearchService.create(effectiveScope, data),
    onSuccess: () => {
      invalidateSavedSearches(queryClient, workspaceId);
      toast.success('Smart collection created', { id: 'saved-search-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to create smart collection', {
        description: err?.message || 'Please check your conditions and try again.',
        id: 'saved-search-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedSearchInput }) =>
      SavedSearchService.update(effectiveScope, id, data),
    onSuccess: (_, variables) => {
      invalidateSavedSearches(queryClient, workspaceId);
      queryClient.invalidateQueries({
        queryKey: savedSearchKeys.byId(workspaceId, variables.id),
      });
      toast.success('Smart collection updated', { id: 'saved-search-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to update smart collection', {
        description: err?.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SavedSearchService.delete(effectiveScope, id),
    onSuccess: () => {
      invalidateSavedSearches(queryClient, workspaceId);
      toast.success('Smart collection deleted', { id: 'saved-search-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete smart collection', {
        description: err?.message,
        id: 'saved-search-mutation',
      });
    },
  });

  const previewMutation = useMutation({
    mutationFn: (conditions: SavedSearchConditionGroup) =>
      SavedSearchService.preview(effectiveScope, conditions),
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
  workspaceId: string | undefined,
  id: string | null,
  params?: {
    limit?: number;
    cursor?: string;
    sortBy?: string;
    sortOrder?: string;
  },
) {
  return useQuery({
    queryKey: savedSearchKeys.results(workspaceId, id || '', params),
    queryFn: () => SavedSearchService.getResults(workspaceId || 'user', id!, params),
    enabled: Boolean(id),
  });
}
