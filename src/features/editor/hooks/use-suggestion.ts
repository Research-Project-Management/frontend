'use client';

/**
 * use-suggestion.ts
 *
 * Clean Presentational Suggestion Hooks (Track Changes):
 * - In-memory reactive suggestion management for UI preview
 * - Decoupled from legacy backend endpoints
 */

import { useState } from 'react';
import type { SuggestionStatus, PageSuggestion } from '../types';
import { toast } from 'sonner';

export const suggestionKeys = {
  all: ['page-suggestions'] as const,
  byPage: (pageId: string | null, status?: SuggestionStatus) =>
    ['page-suggestions', pageId, status] as const,
};

let sessionSuggestions: PageSuggestion[] = [];
const suggestionListeners = new Set<() => void>();

function notifySuggestionListeners() {
  suggestionListeners.forEach((fn) => fn());
}

export const usePageSuggestions = (_pageId: string | null, status?: SuggestionStatus) => {
  const [, setTick] = useState(0);

  useState(() => {
    const listener = () => setTick((t) => t + 1);
    suggestionListeners.add(listener);
    return () => {
      suggestionListeners.delete(listener);
    };
  });

  const filtered = status
    ? sessionSuggestions.filter((s) => s.status === status)
    : sessionSuggestions;

  return {
    data: filtered,
    isLoading: false,
    error: null,
  };
};

export const useCreateSuggestion = () => {
  return {
    mutate: (payload: any) => {
      const newSug: PageSuggestion = {
        id: `sug-${Date.now()}`,
        pageId: payload.pageId,
        authorId: 'me',
        type: payload.type,
        originalText: payload.originalText,
        suggestedText: payload.suggestedText,
        fromLine: payload.fromLine,
        toLine: payload.toLine,
        description: payload.description,
        status: 'pending',
        createdAt: new Date().toISOString(),
        author: {
          id: 'me',
          name: 'Researcher',
          email: 'researcher@flux.local',
        },
      } as any;
      sessionSuggestions = [newSug, ...sessionSuggestions];
      notifySuggestionListeners();
      toast.success('Suggestion proposed');
      return newSug;
    },
    mutateAsync: async (payload: any) => {
      const newSug: PageSuggestion = {
        id: `sug-${Date.now()}`,
        pageId: payload.pageId,
        authorId: 'me',
        type: payload.type,
        originalText: payload.originalText,
        suggestedText: payload.suggestedText,
        fromLine: payload.fromLine,
        toLine: payload.toLine,
        description: payload.description,
        status: 'pending',
        createdAt: new Date().toISOString(),
        author: {
          id: 'me',
          name: 'Researcher',
          email: 'researcher@flux.local',
        },
      } as any;
      sessionSuggestions = [newSug, ...sessionSuggestions];
      notifySuggestionListeners();
      toast.success('Suggestion proposed');
      return newSug;
    },
    isPending: false,
  };
};

export const useAcceptSuggestion = () => {
  return {
    mutate: ({ suggestionId }: { pageId: string; suggestionId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, status: 'accepted' as const } : s,
      );
      notifySuggestionListeners();
      toast.success('Suggestion accepted');
    },
    mutateAsync: async ({ suggestionId }: { pageId: string; suggestionId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, status: 'accepted' as const } : s,
      );
      notifySuggestionListeners();
      toast.success('Suggestion accepted');
      return { success: true };
    },
    isPending: false,
  };
};

export const useRejectSuggestion = () => {
  return {
    mutate: ({ suggestionId }: { pageId: string; suggestionId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, status: 'rejected' as const } : s,
      );
      notifySuggestionListeners();
      toast.info('Suggestion rejected');
    },
    mutateAsync: async ({ suggestionId }: { pageId: string; suggestionId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) =>
        s.id === suggestionId ? { ...s, status: 'rejected' as const } : s,
      );
      notifySuggestionListeners();
      toast.info('Suggestion rejected');
      return { success: true };
    },
    isPending: false,
  };
};

export const useAcceptAllSuggestions = () => {
  return {
    mutate: (_params: { pageId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) => ({
        ...s,
        status: 'accepted' as const,
      }));
      notifySuggestionListeners();
      toast.success('All suggestions accepted');
    },
    mutateAsync: async (_params: { pageId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) => ({
        ...s,
        status: 'accepted' as const,
      }));
      notifySuggestionListeners();
      toast.success('All suggestions accepted');
      return { success: true };
    },
    isPending: false,
  };
};

export const useRejectAllSuggestions = () => {
  return {
    mutate: (_params: { pageId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) => ({
        ...s,
        status: 'rejected' as const,
      }));
      notifySuggestionListeners();
      toast.info('All suggestions rejected');
    },
    mutateAsync: async (_params: { pageId: string }) => {
      sessionSuggestions = sessionSuggestions.map((s) => ({
        ...s,
        status: 'rejected' as const,
      }));
      notifySuggestionListeners();
      toast.info('All suggestions rejected');
      return { success: true };
    },
    isPending: false,
  };
};
