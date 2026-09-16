'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StateService, type ItemStateData } from '../services/state.service';

export const stateKeys = {
  all: ['library', 'state'] as const,
  item: (workspaceId?: string, itemId?: string) =>
    [...stateKeys.all, workspaceId || 'default', itemId || 'none'] as const,
  batch: (workspaceId?: string, itemIds: string[] = []) =>
    [...stateKeys.all, 'batch', workspaceId || 'default', itemIds.join(',')] as const,
};

/**
 * Hook to retrieve reading state for a specific library item
 */
export function useItemState(workspaceId?: string, itemId?: string) {
  return useQuery({
    queryKey: stateKeys.item(workspaceId, itemId),
    queryFn: async () => {
      const res = await StateService.getState(workspaceId || 'default', itemId || '');
      return (res as any)?.data ?? res ?? null;
    },
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 5,
  });
}

export const useLibraryState = useItemState;

/**
 * Hook to update reading state for a specific library item
 */
export function useUpdateItemState(workspaceId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      readStatus?: 'unread' | 'reading' | 'completed';
      rating?: number;
    }) => {
      return StateService.updateState(workspaceId || 'default', itemId || '', data);
    },
    onSuccess: () => {
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: stateKeys.item(workspaceId, itemId) });
        queryClient.invalidateQueries({ queryKey: stateKeys.all });
      }
    },
  });
}
