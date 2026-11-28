'use client';

/**
 * useSuggestions.ts
 *
 * Reactive suggestion hooks wired to `/api/v1/pages/docs/:docId/suggestions`.
 */

import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';
import { pagesService } from '@/features/editor/sdk/pages.service';
import type { CreateSuggestionPayload } from '@/features/editor/sdk/pages/types';
import { lruDocumentCache, sessionCoordinator } from '@/features/editor/core';
import { useSafeQueryClient } from '@/features/editor/core/queries/safe-query-client';
import { reviewCoordinator } from '../coordinator/review.coordinator';
import { isYjsSynced } from '../coordinator/resolver';

export const suggestionKeys = {
  all: ['page-suggestions'] as const,
  byPage: (docId: string | null, status?: SuggestionStatus) =>
    ['page-suggestions', docId, status] as const,
};

const STALE_TIME = 30_000;
const GC_TIME = 5 * 60_000;

export const usePageSuggestions = (
  docId: string | null,
  status?: SuggestionStatus,
  queryClient?: QueryClient,
) => {
  const effectiveClient = useSafeQueryClient(queryClient);
  return useQuery(
    {
      queryKey: suggestionKeys.byPage(docId, status),
      queryFn: async (): Promise<PageSuggestion[]> => {
        if (!docId) return [];
        const list = await pagesService.suggestions.getSuggestions(docId, status);
        return list || [];
      },
      enabled: Boolean(docId),
      staleTime: STALE_TIME,
      gcTime: GC_TIME,
    },
    effectiveClient,
  );
};

export const useCreateSuggestion = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async (payload: CreateSuggestionPayload) => {
        return await pagesService.suggestions.createSuggestion(payload);
      },
      onSuccess: (_newSug, variables) => {
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
      },
      onError: (err: unknown) => {
        toast.error((err as Error)?.message || 'Failed to submit suggestion', { id: 'submit-suggestion' });
      },
    },
    queryClient,
  );
};

export const useAcceptSuggestion = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) => {
        sessionCoordinator.cancelPendingAutoSave(pageId);
        if (!isYjsSynced(pageId)) {
          reviewCoordinator.applySuggestionByIdLocally(suggestionId, 'accept', pageId);
        }
        return await pagesService.suggestions.acceptSuggestion(pageId, suggestionId);
      },
      onMutate: async ({ pageId, suggestionId }) => {
        await queryClient.cancelQueries({ queryKey: ['page-suggestions', pageId] });
        const previousData = queryClient.getQueriesData<PageSuggestion[]>({ queryKey: ['page-suggestions', pageId] });

        queryClient.setQueriesData<PageSuggestion[]>(
          { queryKey: ['page-suggestions', pageId] },
          (old) => (old ? old.map((s) => (s.id === suggestionId ? { ...s, status: 'accepted' as const } : s)) : old),
        );

        return { previousData, pageId };
      },
      onError: (_err, vars, context) => {
        reviewCoordinator.rollbackSuggestionLocally(vars.suggestionId);
        if (context?.previousData) {
          context.previousData.forEach(([key, val]) => {
            queryClient.setQueryData(key, val);
          });
        }
        toast.error('Failed to accept suggestion', { id: `sug-${vars.suggestionId}` });
      },
      onSettled: (_data, _err, vars) => {
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', vars.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', vars.pageId] });
      },
      onSuccess: (data, vars) => {
        const rev = (data as { page?: { rev?: number } } | undefined)?.page?.rev;
        if (typeof rev === 'number') {
          lruDocumentCache.setServerRev(vars.pageId, rev);
        }
      },
    },
    queryClient,
  );
};

export const useRejectSuggestion = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      mutationFn: async ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) => {
        sessionCoordinator.cancelPendingAutoSave(pageId);
        if (!isYjsSynced(pageId)) {
          reviewCoordinator.applySuggestionByIdLocally(suggestionId, 'reject', pageId);
        }
        return await pagesService.suggestions.rejectSuggestion(pageId, suggestionId);
      },
      onMutate: async ({ pageId, suggestionId }) => {
        await queryClient.cancelQueries({ queryKey: ['page-suggestions', pageId] });
        const previousData = queryClient.getQueriesData<PageSuggestion[]>({ queryKey: ['page-suggestions', pageId] });

        queryClient.setQueriesData<PageSuggestion[]>(
          { queryKey: ['page-suggestions', pageId] },
          (old) => (old ? old.map((s) => (s.id === suggestionId ? { ...s, status: 'rejected' as const } : s)) : old),
        );

        return { previousData, pageId };
      },
      onError: (_err, vars, context) => {
        reviewCoordinator.rollbackSuggestionLocally(vars.suggestionId);
        if (context?.previousData) {
          context.previousData.forEach(([key, val]) => {
            queryClient.setQueryData(key, val);
          });
        }
        toast.error('Failed to reject suggestion', { id: `sug-${vars.suggestionId}` });
      },
      onSettled: (_data, _err, vars) => {
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', vars.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
      },
      onSuccess: (data, vars) => {
        const rev = (data as { page?: { rev?: number } } | undefined)?.page?.rev;
        if (typeof rev === 'number') {
          lruDocumentCache.setServerRev(vars.pageId, rev);
        }
      },
    },
    queryClient,
  );
};

export const useAcceptAllSuggestions = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      onMutate: ({ pageId }: { pageId: string }) => {
        const snapshot = reviewCoordinator.getRollbackSnapshot(pageId);
        return { snapshot };
      },
      mutationFn: async ({ pageId }: { pageId: string }) => {
        sessionCoordinator.cancelPendingAutoSave(pageId);
        if (!isYjsSynced(pageId)) {
          reviewCoordinator.applyAllLocally('accept', pageId);
        }
        return await pagesService.suggestions.acceptAllSuggestions(pageId);
      },
      onSuccess: (data, variables) => {
        const rev = (data as { page?: { rev?: number } } | undefined)?.page?.rev;
        if (typeof rev === 'number') {
          lruDocumentCache.setServerRev(variables.pageId, rev);
        }
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        queryClient.invalidateQueries({ queryKey: ['pages', 'detail', variables.pageId] });
        toast.success('All suggestions accepted', { id: 'sug-bulk' });
      },
      onError: (err: unknown, variables, context) => {
        if (context?.snapshot && !isYjsSynced(variables.pageId)) {
          reviewCoordinator.restoreSnapshot(context.snapshot);
        }
        toast.error((err as Error)?.message || 'Failed to accept all suggestions', { id: 'sug-bulk' });
      },
    },
    queryClient,
  );
};

export const useRejectAllSuggestions = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation(
    {
      onMutate: ({ pageId }: { pageId: string }) => {
        const snapshot = reviewCoordinator.getRollbackSnapshot(pageId);
        return { snapshot };
      },
      mutationFn: async ({ pageId }: { pageId: string }) => {
        sessionCoordinator.cancelPendingAutoSave(pageId);
        if (!isYjsSynced(pageId)) {
          reviewCoordinator.applyAllLocally('reject', pageId);
        }
        return await pagesService.suggestions.rejectAllSuggestions(pageId);
      },
      onSuccess: (data, variables) => {
        const rev = (data as { page?: { rev?: number } } | undefined)?.page?.rev;
        if (typeof rev === 'number') {
          lruDocumentCache.setServerRev(variables.pageId, rev);
        }
        queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
        queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
        toast.info('All suggestions rejected', { id: 'sug-bulk' });
      },
      onError: (err: unknown, variables, context) => {
        if (context?.snapshot && !isYjsSynced(variables.pageId)) {
          reviewCoordinator.restoreSnapshot(context.snapshot);
        }
        toast.error((err as Error)?.message || 'Failed to reject all suggestions', { id: 'sug-bulk' });
      },
    },
    queryClient,
  );
};
