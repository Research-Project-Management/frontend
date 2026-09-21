'use client';

/**
 * use-suggestion.ts
 *
 * Frontend hooks mirroring Backend `modules/document/suggestion/`:
 *  - usePageSuggestions
 *  - useCreateSuggestion
 *  - useAcceptSuggestion
 *  - useRejectSuggestion
 *  - useAcceptAllSuggestions
 *  - useRejectAllSuggestions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SuggestionStatus } from '../types';
import {
  suggestionService,
  type CreateSuggestionPayload,
} from '../services/suggestion.service';
import { EditorEventBus } from '../utils/editor.util';

export const suggestionKeys = {
  all: ['page-suggestions'] as const,
  byPage: (pageId: string | null, status?: SuggestionStatus) =>
    ['page-suggestions', pageId, status] as const,
};

export const usePageSuggestions = (pageId: string | null, status?: SuggestionStatus) => {
  return useQuery({
    queryKey: suggestionKeys.byPage(pageId, status),
    queryFn: () => (pageId ? suggestionService.getSuggestions(pageId, status) : Promise.resolve([])),
    enabled: !!pageId,
  });
};

export const useCreateSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSuggestionPayload) => suggestionService.createSuggestion(payload),
    onSuccess: (data, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
      EditorEventBus.emit('flux:review-event', {
        pageId,
        event: 'suggestion:created',
        payload: { suggestion: data },
      });
    },
  });
};

export const useAcceptSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) =>
      suggestionService.acceptSuggestion(pageId, suggestionId),
    onSuccess: (data, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', pageId] });
      if (data?.page) {
        queryClient.setQueryData(['pages', 'detail', pageId], data.page);
      }
      EditorEventBus.emit('flux:review-event', {
        pageId,
        event: 'suggestion:accepted',
        payload: data,
      });
    },
  });
};

export const useRejectSuggestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, suggestionId }: { pageId: string; suggestionId: string }) =>
      suggestionService.rejectSuggestion(pageId, suggestionId),
    onSuccess: (data, { pageId, suggestionId }) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
      EditorEventBus.emit('flux:review-event', {
        pageId,
        event: 'suggestion:rejected',
        payload: { ...data, suggestionId },
      });
    },
  });
};

export const useAcceptAllSuggestions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId }: { pageId: string }) =>
      suggestionService.acceptAllSuggestions(pageId),
    onSuccess: (data, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
      queryClient.invalidateQueries({ queryKey: ['pages', 'detail', pageId] });
      if (data?.page) {
        queryClient.setQueryData(['pages', 'detail', pageId], data.page);
      }
      EditorEventBus.emit('flux:review-event', {
        pageId,
        event: 'suggestions:accepted-all',
        payload: data,
      });
    },
  });
};

export const useRejectAllSuggestions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId }: { pageId: string }) =>
      suggestionService.rejectAllSuggestions(pageId),
    onSuccess: (data, { pageId }) => {
      queryClient.invalidateQueries({ queryKey: ['page-suggestions', pageId] });
      EditorEventBus.emit('flux:review-event', {
        pageId,
        event: 'suggestions:rejected-all',
        payload: data,
      });
    },
  });
};
