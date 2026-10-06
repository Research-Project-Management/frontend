'use client';

/**
 * use-suggestion.ts
 *
 * Real-time reactive suggestion hooks wired directly to:
 * Manuscript Suggestions / Track Changes Service (`/api/v1/manuscripts/docs/:docId/suggestions`)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SuggestionStatus, PageSuggestion } from '../types';
import { suggestionService, type CreateSuggestionPayload } from '../services/suggestion.service';
import { toast } from 'sonner';

export const suggestionKeys = {
  all: ['page-suggestions'] as const,
  byPage: (pageId: string | null, status?: SuggestionStatus) =>
    ['page-suggestions', pageId, status] as const,
};

export const usePageSuggestions = (pageId: string | null, status?: SuggestionStatus) => {
  return useQuery({
    queryKey: suggestionKeys.byPage(pageId, status),
    queryFn: async (): Promise<PageSuggestion[]> => {
      if (!pageId) return [];
      try {
        const suggestions = await suggestionService.getSuggestions(pageId, status);
        return suggestions || [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(pageId),
  });
};

export const useCreateSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSuggestionPayload) => {
      return await suggestionService.createSuggestion(payload);
    },
    onSuccess: (_newSug, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      toast.success('Suggestion submitted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to submit suggestion');
    },
  });
};

export const useAcceptSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) => {
      return await suggestionService.acceptSuggestion(pageId, suggestionId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', variables.pageId] });
      toast.success('Suggestion accepted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to accept suggestion');
    },
  });
};

export const useRejectSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) => {
      return await suggestionService.rejectSuggestion(pageId, suggestionId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      toast.info('Suggestion rejected');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to reject suggestion');
    },
  });
};

export const useAcceptAllSuggestions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId }: { pageId: string }) => {
      return await suggestionService.acceptAllSuggestions(pageId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', variables.pageId] });
      toast.success('All suggestions accepted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to accept all suggestions');
    },
  });
};

export const useRejectAllSuggestions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId }: { pageId: string }) => {
      return await suggestionService.rejectAllSuggestions(pageId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', variables.pageId] });
      queryClient.invalidateQueries({ queryKey: ['page-suggestions'] });
      toast.info('All suggestions rejected');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to reject all suggestions');
    },
  });
};
