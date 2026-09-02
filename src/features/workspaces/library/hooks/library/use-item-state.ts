'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ItemStateService,
  itemStateKeys,
  ItemStateData,
} from '../../services/item-state.service';
import { paperKeys } from '../../services/paper.service';

export function useItemState(workspaceId: string, itemId?: string | null) {
  return useQuery({
    queryKey: itemStateKeys.byItem(workspaceId, itemId || ''),
    queryFn: async () => {
      if (!itemId) return null;
      const res = await ItemStateService.getState(workspaceId, itemId);
      return res?.data ?? null;
    },
    enabled: Boolean(workspaceId && itemId),
    staleTime: 30_000,
  });
}

export function useUpdateItemState(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: {
        readStatus?: 'unread' | 'reading' | 'completed';
        rating?: number;
      };
    }) => {
      const res = await ItemStateService.updateState(workspaceId, itemId, data);
      return res?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: itemStateKeys.byItem(workspaceId, variables.itemId),
      });
      queryClient.invalidateQueries({
        queryKey: paperKeys.all(workspaceId),
      });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
  });
}

export function useMarkAsRead(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const res = await ItemStateService.markAsRead(workspaceId, itemId);
      return res?.data;
    },
    onSuccess: (_, itemId) => {
      queryClient.invalidateQueries({
        queryKey: itemStateKeys.byItem(workspaceId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: paperKeys.all(workspaceId),
      });
      queryClient.invalidateQueries({ queryKey: ['papers'] });
    },
  });
}

// Backward compatibility aliases
export const useUserState = useItemState;
export const useUpdateUserState = useUpdateItemState;
export type { ItemStateData };
