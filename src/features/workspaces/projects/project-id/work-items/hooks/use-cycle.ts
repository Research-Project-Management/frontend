'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CycleService } from '../services/cycle.service';
import { CoreService } from '../services/core.service';

export const cycleKeys = {
  all: ['cycles'] as const,
  project: (projectId: string) => ['cycles', projectId] as const,
};

export const useCycles = (projectId: string) =>
  useQuery({
    queryKey: cycleKeys.project(projectId),
    queryFn: () => CycleService.getCycles(projectId),
    enabled: Boolean(projectId),
  });

export const useTaskCycles = useCycles;
export const useWorkItemCycles = useCycles;

export const useTransferItems = (projectId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      selectedIds,
      targetCycleId,
    }: {
      selectedIds: string[];
      targetCycleId: string;
    }) =>
      CoreService.bulkUpdate({
        ids: selectedIds,
        data: { cycleId: targetCycleId === 'unassigned' ? null : targetCycleId },
        projectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['cycles', projectId] });
    },
  });

  const transferItems = useCallback(
    async ({
      selectedIds,
      targetCycleId,
      onSuccess,
    }: {
      selectedIds: string[];
      targetCycleId: string;
      onSuccess?: () => void;
    }) => {
      if (!targetCycleId) {
        toast.error('Please select a destination cycle');
        return false;
      }
      if (selectedIds.length === 0) {
        toast.error('Please select at least one item to transfer');
        return false;
      }
      try {
        await mutation.mutateAsync({ selectedIds, targetCycleId });
        toast.success(`Successfully transferred ${selectedIds.length} items`);
        onSuccess?.();
        return true;
      } catch {
        toast.error('Failed to transfer items');
        return false;
      }
    },
    [mutation]
  );

  return {
    transferItems,
    transferTasks: transferItems,
    isPending: mutation.isPending,
  };
};

export const useTransferTasks = useTransferItems;
export const useTransferWorkItems = useTransferItems;

export const useAddExistingItemsToCycle = (projectId: string, currentCycleId: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ selectedIds }: { selectedIds: string[] }) =>
      CoreService.bulkUpdate({
        ids: selectedIds,
        data: { cycleId: currentCycleId },
        projectId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['cycles', projectId] });
    },
  });

  const addItems = useCallback(
    async ({
      selectedIds,
      onSuccess,
    }: {
      selectedIds: string[];
      onSuccess?: () => void;
    }) => {
      if (selectedIds.length === 0) {
        toast.error('Please select at least one item');
        return false;
      }
      try {
        await mutation.mutateAsync({ selectedIds });
        toast.success(`Successfully added ${selectedIds.length} items to cycle`);
        onSuccess?.();
        return true;
      } catch {
        toast.error('Failed to add items to cycle');
        return false;
      }
    },
    [mutation]
  );

  return {
    addItems,
    addTasks: addItems,
    isPending: mutation.isPending,
  };
};

export const useAddExistingTasksToCycle = useAddExistingItemsToCycle;
export const useAddExistingWorkItemsToCycle = useAddExistingItemsToCycle;
