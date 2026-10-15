'use client';

/**
 * use-suggestion.ts
 *
 * Real-time reactive suggestion hooks wired directly to:
 * Manuscript Suggestions / Track Changes Service (`/api/v1/manuscripts/docs/:docId/suggestions`)
 */

import { useQuery, useMutation, type QueryClient } from '@tanstack/react-query';
import type { SuggestionStatus, PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import { suggestionService } from '@/features/editor/sdk/manuscript.service';
import { type CreateSuggestionPayload } from '@/features/editor/sdk/manuscript/types';
import { toast } from 'sonner';
import { useSafeQueryClient } from './safeQueryClient';

export const suggestionKeys = {
  all: ['page-suggestions'] as const,
  byPage: (pageId: string | null, status?: SuggestionStatus) =>
    ['page-suggestions', pageId, status] as const,
};

export const usePageSuggestions = (
  pageId: string | null,
  status?: SuggestionStatus,
  queryClient?: QueryClient
) => {
  const effectiveClient = useSafeQueryClient(queryClient);
  return useQuery(
    {
      queryKey: suggestionKeys.byPage(pageId, status),
      queryFn: async (): Promise<PageSuggestion[]> => {
        if (!pageId) return [];
        const suggestions = await suggestionService.getSuggestions(pageId, status);
        return suggestions || [];
      },
      enabled: Boolean(pageId),
    },
    effectiveClient
  );
};

export const useCreateSuggestion = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation({
    mutationFn: async (payload: CreateSuggestionPayload) => {
      return await suggestionService.createSuggestion(payload);
    },
    onSuccess: (_newSug, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      if (!variables?.silent) {
        toast.success('Suggestion submitted', { id: 'submit-suggestion' });
      }
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to submit suggestion', { id: 'submit-suggestion' });
    },
  }, queryClient);
};

export const useAcceptSuggestion = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation({
    mutationFn: async ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) => {
      return await suggestionService.acceptSuggestion(pageId, suggestionId);
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
      if (context?.previousData) {
        context.previousData.forEach(([key, val]) => {
          queryClient.setQueryData(key, val);
        });
      }
      toast.error('Failed to accept suggestion', { id: `sug-${vars.suggestionId}` });
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', vars.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', vars.pageId] });
    },
    onSuccess: (_data, vars) => {
      toast.success('Suggestion accepted', { id: `sug-${vars.suggestionId}` });
    },
  }, queryClient);
};

export const useRejectSuggestion = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation({
    mutationFn: async ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) => {
      return await suggestionService.rejectSuggestion(pageId, suggestionId);
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
      if (context?.previousData) {
        context.previousData.forEach(([key, val]) => {
          queryClient.setQueryData(key, val);
        });
      }
      toast.error('Failed to reject suggestion', { id: `sug-${vars.suggestionId}` });
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', vars.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
    },
    onSuccess: (_data, vars) => {
      toast.info('Suggestion rejected', { id: `sug-${vars.suggestionId}` });
    },
  }, queryClient);
};

export const useAcceptAllSuggestions = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation({
    mutationFn: async ({ pageId }: { pageId: string }) => {
      return await suggestionService.acceptAllSuggestions(pageId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', variables.pageId] });
      toast.success('All suggestions accepted', { id: 'sug-bulk' });
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to accept all suggestions', { id: 'sug-bulk' });
    },
  }, queryClient);
};

export const useRejectAllSuggestions = (customClient?: QueryClient) => {
  const queryClient = useSafeQueryClient(customClient);
  return useMutation({
    mutationFn: async ({ pageId }: { pageId: string }) => {
      return await suggestionService.rejectAllSuggestions(pageId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      toast.info('All suggestions rejected', { id: 'sug-bulk' });
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to reject all suggestions', { id: 'sug-bulk' });
    },
  }, queryClient);
};
