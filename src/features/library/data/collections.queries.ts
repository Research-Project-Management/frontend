'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CollectionsService } from '../services/collections.service';
import { libraryKeys } from './query-keys';
import type {
  Collection,
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from '../types/library.types';

/**
 * Hook to query collection tree for Sidebar
 */
export function useLibraryCollectionTreeQuery(scopeId?: string) {
  const targetScope = scopeId || 'user';

  return useQuery({
    queryKey: libraryKeys.collections(targetScope),
    queryFn: async () => {
      const res = await CollectionsService.getTree(targetScope);
      return res?.tree || [];
    },
    staleTime: 1000 * 60, // 1 min
  });
}

/**
 * Hook to create a new collection
 */
export function useCreateCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const targetScope = scopeId || 'user';

  return useMutation({
    mutationFn: async (data: CreateCollectionDTO) => {
      return CollectionsService.create(targetScope, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.collections(targetScope),
      });
      toast.success('Đã tạo thư mục mới');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể tạo thư mục');
    },
  });
}

/**
 * Hook to update an existing collection
 */
export function useUpdateCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const targetScope = scopeId || 'user';

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCollectionDTO;
    }) => {
      return CollectionsService.update(targetScope, id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.collections(targetScope),
      });
      toast.success('Đã cập nhật thư mục');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể cập nhật thư mục');
    },
  });
}

/**
 * Hook to delete a collection
 */
export function useDeleteCollectionMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const targetScope = scopeId || 'user';

  return useMutation({
    mutationFn: async ({
      id,
      strategy,
    }: {
      id: string;
      strategy?: 'cascade' | 'move-to-parent' | 'orphan';
    }) => {
      return CollectionsService.delete(targetScope, id, strategy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.collections(targetScope),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.all,
      });
      toast.success('Đã xóa thư mục');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể xóa thư mục');
    },
  });
}
