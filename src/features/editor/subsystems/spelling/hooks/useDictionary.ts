'use client';

/**
 * subsystems/spelling/hooks/useDictionary.ts
 *
 * TanStack Query hook for listing, learning, and unlearning space-scoped dictionary words
 * (Personal Space `'personal'` vs Project Space UUID).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { resolveEditorScopeFromState } from '@/features/editor/core/coordinator/editor-scope';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { spellingCache } from '../model/cache';

const dictionaryKeys = {
  space: (spaceId?: string) => ['spelling-dictionary', spaceId] as const,
};

export function useDictionary(spaceId?: string, enabled = true) {
  const queryClient = useQueryClient();
  const storeSpaceId = usePageStore((s) => {
    const scope = resolveEditorScopeFromState(s);
    return scope.spaceId || (scope.rootPageId ? scope.routeSpaceParam : '');
  });
  const resolvedSpaceId = spaceId?.trim() || storeSpaceId || undefined;

  const query = useQuery({
    queryKey: dictionaryKeys.space(resolvedSpaceId),
    queryFn: () =>
      resolvedSpaceId ? pagesService.spelling.listDictionary(resolvedSpaceId) : Promise.resolve([]),
    enabled: enabled && Boolean(resolvedSpaceId),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
  });

  const addMutation = useMutation({
    mutationFn: async (word: string) => {
      const normalized = word.trim().toLowerCase();
      if (!normalized) throw new Error('Word cannot be empty');
      if (!resolvedSpaceId) throw new Error('No active space');
      await pagesService.spelling.learnWord(resolvedSpaceId, normalized);
      return normalized;
    },
    onSuccess: (word) => {
      spellingCache.invalidate(undefined, resolvedSpaceId);
      queryClient.invalidateQueries({ queryKey: dictionaryKeys.space(resolvedSpaceId) });
      toast.success(`Added "${word}" to dictionary`, { id: `spelling-${word}` });
    },
    onError: (err: unknown, word) => {
      toast.error((err as Error)?.message || 'Failed to add word to dictionary', {
        id: `spelling-${word}`,
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (word: string) => {
      if (!resolvedSpaceId) throw new Error('No active space');
      await pagesService.spelling.unlearnWord(resolvedSpaceId, word);
      return word;
    },
    onSuccess: (word) => {
      spellingCache.invalidate(word, resolvedSpaceId);
      queryClient.invalidateQueries({ queryKey: dictionaryKeys.space(resolvedSpaceId) });
      toast.success(`Removed "${word}" from dictionary`, { id: `spelling-${word}` });
    },
    onError: (_err: unknown, word) => {
      toast.error(`Failed to remove "${word}"`, { id: `spelling-${word}` });
    },
  });

  return {
    words: query.data || [],
    isError: query.isError,
    addWord: addMutation.mutate,
    removeWord: removeMutation.mutate,
    isAddingWord: addMutation.isPending,
  };
}
