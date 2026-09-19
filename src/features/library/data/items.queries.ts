'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ItemService } from '../services/items.service';
import { libraryKeys } from './query-keys';
import type { Item, ItemQueryParams, UpdateItemDTO } from '../types/library.types';

/**
 * Hook to query items with parameters (view, search, collectionId, tags, pagination)
 */
export function useLibraryItemsQuery(
  scopeId?: string,
  params: ItemQueryParams = {},
) {
  const targetScope = scopeId || 'user';

  return useQuery({
    queryKey: libraryKeys.items(targetScope, params),
    queryFn: async () => {
      const data = await ItemService.getAll(targetScope, params as any);
      return data;
    },
    select: (data) => {
      const items: Item[] = data?.items || [];
      const meta = data?.meta || data?.pagination || null;
      const total: number =
        meta?.totalCount ?? data?.total ?? items.length;
      return {
        items,
        meta,
        total,
        hasNextPage: meta?.hasNextPage ?? false,
        nextCursor: meta?.cursor,
      };
    },
    staleTime: 1000 * 30, // 30s
  });
}

/**
 * Hook to query a single item by ID
 */
export function useLibraryItemDetailQuery(scopeId?: string, itemId?: string) {
  const targetScope = scopeId || 'user';

  return useQuery({
    queryKey: libraryKeys.item(targetScope, itemId),
    queryFn: async () => {
      if (!itemId) return null;
      return ItemService.getById(targetScope, itemId);
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60, // 1 min
  });
}

/**
 * Hook to update an item with optimistic cache invalidation
 */
export function useUpdateLibraryItemMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const targetScope = scopeId || 'user';

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateItemDTO;
    }) => {
      return ItemService.update(targetScope, id, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.item(targetScope, variables.id),
      });
      queryClient.invalidateQueries({
        queryKey: libraryKeys.all,
      });
      toast.success('Đã cập nhật tài liệu');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể cập nhật tài liệu');
    },
  });
}

/**
 * Hook to delete multiple items (bulk delete)
 */
export function useDeleteLibraryItemsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const targetScope = scopeId || 'user';

  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      if (itemIds.length === 1) {
        return ItemService.delete(targetScope, itemIds[0]);
      }
      return Promise.all(itemIds.map((id) => ItemService.delete(targetScope, id)));
    },
    onSuccess: (_, itemIds) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.all,
      });
      toast.success(`Đã xóa ${itemIds.length} tài liệu`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Không thể xóa tài liệu');
    },
  });
}
