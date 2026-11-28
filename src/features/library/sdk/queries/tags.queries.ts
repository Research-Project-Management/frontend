'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TagsService } from '../clients/tags.client';
import {
  itemKeys,
  tagKeys,
  normalizeSpaceId,
  waitForBootstrapCache,
} from '@/features/library/sdk/query-keys';
import { invalidateLibraryCatalogDependencies } from './cache-patcher.queries';

export { tagKeys };


export function useTags(spaceId?: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

  const cacheKey = tagKeys.list(effectiveScope);
  const tagsQuery = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const seeded = await waitForBootstrapCache<Awaited<ReturnType<typeof TagsService.list>>>(
        queryClient,
        effectiveScope,
        cacheKey,
      );
      if (seeded !== undefined) return seeded;
      return TagsService.list(effectiveScope);
    },
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: ({
      name,
      color,
      type,
      shortcut,
    }: {
      name: string;
      color?: string;
      type?: string;
      shortcut?: number | null;
    }) => TagsService.create(effectiveScope, name, color, type, shortcut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag created', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to create tag', {
        description: err.message || 'Please check the name and try again.',
        id: 'tag-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      tagId,
      data,
    }: {
      tagId: string;
      data: { name?: string; color?: string; type?: string; shortcut?: number | null };
    }) => TagsService.update(effectiveScope, tagId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag updated', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to update tag', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tagId: string) => TagsService.delete(effectiveScope, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success('Tag deleted', { id: 'tag-mutation' });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete tag', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const deleteAutomaticMutation = useMutation({
    mutationFn: () => TagsService.deleteAutomatic(effectiveScope),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success(`Removed ${data?.count ?? 0} automatic tag(s)`, {
        id: 'tag-mutation',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to delete automatic tags', {
        description: err.message || 'Please try again.',
        id: 'tag-mutation',
      });
    },
  });

  const splitMutation = useMutation({
    mutationFn: ({ tagId, parts }: { tagId: string; parts: string[] }) =>
      TagsService.split(effectiveScope, tagId, parts),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.list(effectiveScope) });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success(`Split into ${data?.count ?? 2} tags`, {
        id: 'tag-mutation',
      });
    },
    onError: (err: Error) => {
      toast.error('Failed to split tag', {
        description: err.message || 'Please try again.',
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
    updateTag: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTag: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteAutomaticTags: deleteAutomaticMutation.mutateAsync,
    isDeletingAutomatic: deleteAutomaticMutation.isPending,
    splitTag: splitMutation.mutateAsync,
  };
}

// ── Notes Query Hooks ────────────────────────────────────────────────────────
