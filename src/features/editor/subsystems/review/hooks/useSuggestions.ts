'use client';

/**
 * useSuggestions.ts
 *
 * Reactive suggestion hooks wired to `/api/v1/pages/docs/:docId/suggestions`
 * and delegating optimistic buffer mutations, groupId pairing, Yjs sync checks,
 * server revision tracking, and rollback to the deep `reviewCoordinator` module.
 */

import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query';
import type { PageSuggestion, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { useSafeQueryClient } from '@/features/editor/core/queries/safe-query-client';
import { reviewCoordinator } from '../coordinator/review.coordinator';

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

function createSingleResolutionHook(action: 'accept' | 'reject') {
  const nextStatus = action === 'accept' ? ('accepted' as const) : ('rejected' as const);
  return (customClient?: QueryClient) => {
    const queryClient = useSafeQueryClient(customClient);
    return useMutation(
      {
        mutationFn: async ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) => {
          const ok =
            action === 'accept'
              ? await reviewCoordinator.acceptSuggestion(pageId, suggestionId)
              : await reviewCoordinator.rejectSuggestion(pageId, suggestionId);
          if (!ok) {
            throw new Error(`Failed to ${action} suggestion`);
          }
          return ok;
        },
        onMutate: async ({ pageId, suggestionId }) => {
          await queryClient.cancelQueries({ queryKey: ['page-suggestions', pageId] });
          const previousData = queryClient.getQueriesData<PageSuggestion[]>({
            queryKey: ['page-suggestions', pageId],
          });

          queryClient.setQueriesData<PageSuggestion[]>(
            { queryKey: ['page-suggestions', pageId] },
            (old) =>
              old ? old.map((s) => (s.id === suggestionId ? { ...s, status: nextStatus } : s)) : old,
          );

          return { previousData, pageId };
        },
        onError: (_err, _vars, context) => {
          if (context?.previousData) {
            context.previousData.forEach(([key, val]) => {
              queryClient.setQueryData(key, val);
            });
          }
        },
        onSettled: (_data, _err, vars) => {
          queryClient.invalidateQueries({ queryKey: ['page-suggestions', vars.pageId] });
          queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
          queryClient.invalidateQueries({ queryKey: ['pages', 'detail', vars.pageId] });
        },
      },
      queryClient,
    );
  };
}

function createBulkResolutionHook(action: 'accept' | 'reject') {
  return (customClient?: QueryClient) => {
    const queryClient = useSafeQueryClient(customClient);
    return useMutation(
      {
        mutationFn: async ({ pageId }: { pageId: string }) => {
          const ok =
            action === 'accept'
              ? await reviewCoordinator.acceptAll(pageId)
              : await reviewCoordinator.rejectAll(pageId);
          if (!ok) {
            throw new Error(`Failed to ${action} all suggestions`);
          }
          return ok;
        },
        onSettled: (_data, _err, variables) => {
          queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
          queryClient.invalidateQueries({ queryKey: ['project-review-overview'] });
          queryClient.invalidateQueries({ queryKey: ['pages', 'detail', variables.pageId] });
        },
      },
      queryClient,
    );
  };
}

export const useAcceptSuggestion = createSingleResolutionHook('accept');
export const useRejectSuggestion = createSingleResolutionHook('reject');
export const useAcceptAllSuggestions = createBulkResolutionHook('accept');
export const useRejectAllSuggestions = createBulkResolutionHook('reject');
