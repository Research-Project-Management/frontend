'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TagService, TagsService, type TagWithCount } from '../services/tags.service';

export const tagKeys = {
  all: ['tags'] as const,
  list: (scopeId?: string) => [...tagKeys.all, scopeId || 'user'] as const,
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
      queryClient.invalidateQueries({ queryKey: ['items'] });
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
      queryClient.invalidateQueries({ queryKey: ['items'] });
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
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success(`Removed ${data?.count ?? 0} automatic tag(s)`, { id: 'tag-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete automatic tags', {
        description: err?.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ tagId, itemId }: { tagId: string; itemId: string }) =>
      TagService.assignToItem(effectiveScope, tagId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (error) => {
      toast.error('Failed to assign tag');
      console.error(error);
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ tagId, itemId }: { tagId: string; itemId: string }) =>
      TagService.removeFromItem(effectiveScope, tagId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (error) => {
      toast.error('Failed to remove tag');
      console.error(error);
    },
  });

  const tags = (tagsQuery.data || []) as TagWithCount[];

  return {
    tags,
    isLoading: tagsQuery.isLoading,
    isError: tagsQuery.isError,
    error: tagsQuery.error,
    refetch: tagsQuery.refetch,
    createTag: createMutation.mutateAsync,
    deleteTag: deleteMutation.mutateAsync,
    deleteAutomaticTags: deleteAutomaticMutation.mutateAsync,
    isDeletingAutomatic: deleteAutomaticMutation.isPending,
    assignTag: assignMutation.mutateAsync,
    removeTag: removeMutation.mutateAsync,
  };
}