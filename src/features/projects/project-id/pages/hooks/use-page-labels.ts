'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPageLabels, replacePageLabels, removePageLabel } from '../services/page.service';

export const pageLabelKeys = {
  byPage: (pageId: string) => ['page-labels', pageId] as const,
};

export function usePageLabels(projectId: string, pageId: string) {
  return useQuery({
    queryKey: pageLabelKeys.byPage(pageId),
    queryFn: () => getPageLabels(projectId, pageId),
    select: (data) => (data as any)?.labels ?? [],
    enabled: !!pageId && !!projectId,
  });
}

export function useReplacePageLabels(projectId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelIds: string[]) => replacePageLabels(projectId, pageId, labelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageLabelKeys.byPage(pageId) });
    },
    onError: () => {
      toast.error('Failed to update labels');
    },
  });
}

export function useRemovePageLabel(projectId: string, pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => removePageLabel(projectId, pageId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageLabelKeys.byPage(pageId) });
    },
    onError: () => {
      toast.error('Failed to remove label');
    },
  });
}
