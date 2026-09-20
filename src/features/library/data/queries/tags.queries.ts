'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TagService, TagsService, type TagWithCount } from '../services/tags.service';
import { libraryKeys } from '../query-keys';

export type { TagWithCount };

export const tagKeys = {
  all: ['tags'] as const,
  list: (scopeId?: string) => libraryKeys.tags(scopeId),
};

export function useTags(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  const tagsQuery = useQuery({
    queryKey: tagKeys.list(effectiveScope),
    queryFn: () => TagService.list(effectiveScope),
    enabled: true,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({ name, color, type }: { name: string; color?: string; type?: string }) =>
      TagService.create(effectiveScope, name, color, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      toast.success('Tag created', { id: 'tag-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to create tag', {
        description: err?.message || 'Please check the name and try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => TagService.delete(effectiveScope, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      toast.success('Tag deleted', { id: 'tag-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete tag', {
        description: err?.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteAutomaticMutation = useMutation({
    mutationFn: () => TagService.deleteAutomatic(effectiveScope),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: libraryKeys.all });
      toast.success(`Removed ${data?.count ?? 0} automatic tag(s)`, { id: 'tag-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete automatic tags', {
        description: err?.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  return {
    tags: tagsQuery.data || [],
    isLoading: tagsQuery.isLoading,
    isError: tagsQuery.isError,
    error: tagsQuery.error,
    refetch: tagsQuery.refetch,
    createTag: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteTag: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteAutomaticTags: deleteAutomaticMutation.mutateAsync,
    isDeletingAutomatic: deleteAutomaticMutation.isPending,
  };
}

export const useTagsQuery = useTags;
