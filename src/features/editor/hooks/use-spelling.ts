'use client';

/**
 * use-spelling.ts
 *
 * Hooks for managing user & project custom spelling dictionaries.
 * Fully encapsulates mutation lifecycles, toasts, and query invalidation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { spellingService } from '../services/spelling.service';

export const spellingKeys = {
  all: ['spelling-dictionary'] as const,
  user: () => [...spellingKeys.all, 'user'] as const,
  project: (projectId?: string) => [...spellingKeys.all, 'project', projectId] as const,
};

export function useSpellingDictionary(projectId?: string, enabled = true) {
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: spellingKeys.user(),
    queryFn: () => spellingService.getUserDictionary(),
    enabled,
  });

  const projectQuery = useQuery({
    queryKey: spellingKeys.project(projectId),
    queryFn: () => (projectId ? spellingService.getProjectDictionary(projectId) : Promise.resolve([])),
    enabled: enabled && !!projectId,
  });

  const addWordMutation = useMutation({
    mutationFn: async ({ word, isProject }: { word: string; isProject?: boolean }) => {
      const trimmed = word.trim().toLowerCase();
      if (!trimmed) throw new Error('Word cannot be empty');
      if (isProject && projectId) {
        await spellingService.learnProjectWord(projectId, trimmed);
      } else {
        await spellingService.learnUserWord(trimmed);
      }
      return { word: trimmed, isProject: !!(isProject && projectId) };
    },
    onSuccess: ({ word, isProject }) => {
      if (isProject && projectId) {
        queryClient.invalidateQueries({ queryKey: spellingKeys.project(projectId) });
      } else {
        queryClient.invalidateQueries({ queryKey: spellingKeys.user() });
      }
      toast.success(`Added "${word}" to dictionary`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to add word to dictionary');
    },
  });

  const removeWordMutation = useMutation({
    mutationFn: async ({ word, isProject }: { word: string; isProject?: boolean }) => {
      if (isProject && projectId) {
        await spellingService.unlearnProjectWord(projectId, word);
      } else {
        await spellingService.unlearnUserWord(word);
      }
      return { word, isProject: !!(isProject && projectId) };
    },
    onSuccess: ({ word, isProject }) => {
      if (isProject && projectId) {
        queryClient.invalidateQueries({ queryKey: spellingKeys.project(projectId) });
      } else {
        queryClient.invalidateQueries({ queryKey: spellingKeys.user() });
      }
      toast.success(`Removed "${word}" from dictionary`);
    },
    onError: (_err: any, variables) => {
      toast.error(`Failed to remove "${variables.word}"`);
    },
  });

  return {
    userWords: userQuery.data || [],
    projectWords: projectQuery.data || [],
    isLoading: userQuery.isLoading || projectQuery.isLoading,
    refetchUserWords: userQuery.refetch,
    refetchProjectWords: projectQuery.refetch,
    addWord: addWordMutation.mutate,
    removeWord: removeWordMutation.mutate,
    isAddingWord: addWordMutation.isPending,
    isRemovingWord: removeWordMutation.isPending,
  };
}
