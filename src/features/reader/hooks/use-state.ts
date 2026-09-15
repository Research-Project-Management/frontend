'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StateService, type UpdateReadingStatePayload } from '../services/state.service';

export const readerStateKeys = {
  all: ['reader', 'state'] as const,
  item: (scopeId?: string, itemId?: string) =>
    [...readerStateKeys.all, scopeId || 'default', itemId || 'none'] as const,
};

/**
 * Hook to retrieve and manage reading state in the Reader
 */
export function useReaderState(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const stateQuery = useQuery({
    queryKey: readerStateKeys.item(scopeId, itemId),
    queryFn: () => StateService.getState(scopeId, itemId || ''),
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateReadingStatePayload) =>
      StateService.updateState(scopeId, itemId || '', payload),
    onSuccess: (updated) => {
      if (itemId) {
        queryClient.setQueryData(readerStateKeys.item(scopeId, itemId), updated);
      }
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: () => StateService.markAsRead(scopeId || 'me', itemId || ''),
    onSuccess: (updated) => {
      if (itemId) {
        queryClient.setQueryData(readerStateKeys.item(scopeId, itemId), updated);
      }
    },
  });

  return {
    state: stateQuery.data,
    isLoading: stateQuery.isLoading,
    updateState: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    markAsRead: markAsReadMutation.mutateAsync,
  };
}

export const useReadingState = useReaderState;
