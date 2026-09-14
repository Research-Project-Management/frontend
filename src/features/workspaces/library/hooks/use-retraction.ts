'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RetractionService } from '../services/retraction.service';
import type { FlagRetractionInput } from '../types/library.types';

export const retractionKeys = {
  all: (workspaceId?: string) => ['retraction', workspaceId || 'user'] as const,
  stats: (workspaceId?: string) => ['retraction', workspaceId || 'user', 'stats'] as const,
  items: (workspaceId?: string) => ['retraction', workspaceId || 'user', 'items'] as const,
};

export const invalidateRetraction = (qc: QueryClient, workspaceId?: string) => {
  qc.invalidateQueries({ queryKey: retractionKeys.all(workspaceId) });
  qc.invalidateQueries({ queryKey: ['items', workspaceId || 'user'] });
};

export function useRetraction(workspaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = workspaceId || 'user';

  const statsQuery = useQuery({
    queryKey: retractionKeys.stats(workspaceId),
    queryFn: () => RetractionService.getStats(effectiveScope),
    enabled: true,
  });

  const itemsQuery = useQuery({
    queryKey: retractionKeys.items(workspaceId),
    queryFn: () => RetractionService.getRetractedItems(effectiveScope),
    enabled: true,
  });

  const checkItemMutation = useMutation({
    mutationFn: (itemId: string) => RetractionService.checkItem(effectiveScope, itemId),
    onSuccess: (data) => {
      invalidateRetraction(queryClient, workspaceId);
      if (data.isRetracted) {
        toast.error('Retraction detected!', {
          description: `This publication was flagged as ${data.nature || 'retracted'}.`,
        });
      } else {
        toast.success('Retraction check complete', {
          description: 'No retraction notices found for this item.',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Check failed', { description: err?.message });
    },
  });

  const checkWorkspaceMutation = useMutation({
    mutationFn: (itemIds?: string[]) => RetractionService.checkWorkspace(effectiveScope, itemIds),
    onSuccess: (res) => {
      invalidateRetraction(queryClient, workspaceId);
      if (res.newlyRetracted > 0) {
        toast.warning(`Scan completed: ${res.newlyRetracted} retracted item(s) found!`, {
          description: `Scanned ${res.scanned} publications in this workspace.`,
        });
      } else {
        toast.success(`Scan completed: All ${res.scanned} publications clear`, {
          description: 'No new retracted items detected.',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Workspace scan failed', { description: err?.message });
    },
  });

  const flagMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: FlagRetractionInput }) =>
      RetractionService.flagItem(effectiveScope, itemId, data),
    onSuccess: () => {
      invalidateRetraction(queryClient, workspaceId);
      toast.warning('Item flagged as retracted');
    },
    onError: (err: any) => {
      toast.error('Failed to flag item', { description: err?.message });
    },
  });

  const unflagMutation = useMutation({
    mutationFn: (itemId: string) => RetractionService.unflagItem(effectiveScope, itemId),
    onSuccess: () => {
      invalidateRetraction(queryClient, workspaceId);
      toast.success('Retraction flag removed');
    },
    onError: (err: any) => {
      toast.error('Failed to remove flag', { description: err?.message });
    },
  });

  return {
    stats: statsQuery.data,
    retractedItems: itemsQuery.data || [],
    isLoadingStats: statsQuery.isLoading,
    isLoadingItems: itemsQuery.isLoading,
    checkItem: checkItemMutation.mutateAsync,
    checkWorkspace: checkWorkspaceMutation.mutateAsync,
    flagItem: flagMutation.mutateAsync,
    unflagItem: unflagMutation.mutateAsync,
    isCheckingItem: checkItemMutation.isPending,
    isCheckingWorkspace: checkWorkspaceMutation.isPending,
    isFlagging: flagMutation.isPending,
    isUnflagging: unflagMutation.isPending,
  };
}
