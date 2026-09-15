'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from '../services/collections.service';
import type {
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from '../types/library.types';

export const collectionKeys = {
  all: (scopeId?: string) => ['collections', scopeId || 'user'] as const,
  byId: (scopeId?: string, collectionId?: string) => ['collections', scopeId || 'user', collectionId] as const,
};

export const invalidateCollections = (qc: QueryClient, scopeId?: string) => {
  qc.invalidateQueries({ queryKey: collectionKeys.all(scopeId) });
};

export function useCollections(scopeId?: string) {
  const queryClient = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: collectionKeys.all(scopeId),
    queryFn: () => getCollections(scopeId),
    enabled: true,
    select: (data) => data.collections || [],
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCollectionDTO) => {
      const rawParent = (data as any).parentId ?? (data as any).parent ?? null;
      const cleanParentId = rawParent === 'root' || !rawParent ? null : rawParent;
      const payload = {
        name: data.name?.trim() || 'Untitled',
        description: data.description?.trim() || '',
        color: data.color || '#2563eb',
        icon: data.icon || '',
        parentId: cleanParentId,
      };
      return createCollection(scopeId, payload as any);
    },
    onSuccess: () => {
      invalidateCollections(queryClient, scopeId);
      toast.success('Collection created', { id: 'collection-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to create collection', {
        description: err?.message || 'Please check the name and try again.',
        id: 'collection-mutation',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCollectionDTO & { collectionId: string }) => {
      const { collectionId, ...rest } = data;
      const rawParent = rest.parentId ?? (rest as { parent?: string | null }).parent ?? undefined;
      const cleanParentId = rawParent === 'root' ? null : rawParent;
      const payload: UpdateCollectionDTO = {
        name: rest.name !== undefined ? rest.name.trim() : undefined,
        description: rest.description !== undefined ? rest.description.trim() : undefined,
        color: rest.color,
        icon: rest.icon,
      };
      if (rawParent !== undefined) {
        payload.parentId = cleanParentId;
      }
      return updateCollection(scopeId, collectionId, payload);
    },
    onSuccess: () => {
      invalidateCollections(queryClient, scopeId);
      toast.success('Collection updated', { id: 'collection-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to update collection', {
        description: err?.message || 'Please try again.',
        id: 'collection-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (collectionId: string) => deleteCollection(scopeId, collectionId),
    onSuccess: () => {
      invalidateCollections(queryClient, scopeId);
      toast.success('Collection deleted', {
        description: 'Contained papers were unfiled to library, not deleted.',
        id: 'collection-mutation',
      });
    },
    onError: (err: any) => {
      toast.error('Failed to delete collection', {
        description: err?.message || 'Please try again.',
        id: 'collection-mutation',
      });
    },
  });

  const collections = collectionsQuery.data ?? [];

  return {
    state: {
      collections,
      isLoading: collectionsQuery.isLoading,
      isError: collectionsQuery.isError,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    },
    actions: {
      create: createMutation.mutate,
      createAsync: createMutation.mutateAsync,
      update: updateMutation.mutate,
      updateAsync: updateMutation.mutateAsync,
      delete: deleteMutation.mutate,
      deleteAsync: deleteMutation.mutateAsync,
      refetch: collectionsQuery.refetch,
    },
  };
}
