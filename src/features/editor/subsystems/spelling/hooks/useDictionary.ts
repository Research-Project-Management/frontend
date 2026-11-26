'use client';

/**
 * subsystems/spelling/hooks/useDictionary.ts
 *
 * TanStack Query hook for listing, learning, and unlearning project dictionary words.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { invalidateSpellingCache } from '../extensions/extension';

const dictionaryKeys = {
  project: (projectId?: string) => ['spelling-dictionary', projectId] as const,
};

export function useDictionary(projectId?: string, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dictionaryKeys.project(projectId),
    queryFn: () =>
      projectId ? pagesService.spelling.listDictionary(projectId) : Promise.resolve([]),
    enabled: enabled && !!projectId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
  });

  const addMutation = useMutation({
    mutationFn: async (word: string) => {
      const normalized = word.trim().toLowerCase();
      if (!normalized) throw new Error('Word cannot be empty');
      if (!projectId) throw new Error('No active project');
      await pagesService.spelling.learnWord(projectId, normalized);
      return normalized;
    },
    onSuccess: (word) => {
      invalidateSpellingCache();
      queryClient.invalidateQueries({ queryKey: dictionaryKeys.project(projectId) });
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
      if (!projectId) throw new Error('No active project');
      await pagesService.spelling.unlearnWord(projectId, word);
      return word;
    },
    onSuccess: (word) => {
      invalidateSpellingCache(word);
      queryClient.invalidateQueries({ queryKey: dictionaryKeys.project(projectId) });
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
