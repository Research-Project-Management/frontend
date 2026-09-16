import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  StateService,
  CreateStateInput,
  UpdateStateInput,
  ReorderStateItem,
} from "../services/state.service";
import type { WorkItemState } from "../types/state.types";
import { DEFAULT_WORK_ITEM_STATES } from "../types/state.types";

export const stateKeys = {
  all: (projectId: string) => ['project-states', projectId] as const,
  counts: (projectId: string) => ['project-state-counts', projectId] as const,
};

export function useStateSettings(projectId: string) {
  const qc = useQueryClient();

  const statesQ = useQuery({
    queryKey: stateKeys.all(projectId),
    queryFn: () => StateService.getStates(projectId),
    enabled: Boolean(projectId),
  });

  const countsQ = useQuery({
    queryKey: stateKeys.counts(projectId),
    queryFn: () => StateService.getStateCounts(projectId),
    enabled: Boolean(projectId),
  });

  const invalidateWorkflowCache = () => {
    qc.invalidateQueries({ queryKey: stateKeys.all(projectId) });
    qc.invalidateQueries({ queryKey: stateKeys.counts(projectId) });
    qc.invalidateQueries({ queryKey: ['work-items'] });
    qc.invalidateQueries({ queryKey: ['work-items'] });
    qc.invalidateQueries({ queryKey: ['project-details', projectId] });
    qc.invalidateQueries({ queryKey: ['projects'] });
  };

  const createMut = useMutation({
    mutationFn: (data: CreateStateInput) => StateService.createState(projectId, data),
    onSuccess: () => {
      invalidateWorkflowCache();
      toast.success('Workflow state created', { id: 'settings-state' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create state', { id: 'settings-state' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ stateId, data }: { stateId: string; data: UpdateStateInput }) =>
      StateService.updateState(projectId, stateId, data),
    onSuccess: () => {
      invalidateWorkflowCache();
      toast.success('Workflow state updated', { id: 'settings-state' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update state', { id: 'settings-state' }),
  });

  const reorderMut = useMutation({
    mutationFn: (states: ReorderStateItem[]) => StateService.reorderStates(projectId, states),
    onSuccess: () => {
      invalidateWorkflowCache();
      toast.success('Workflow states reordered', { id: 'settings-state' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reorder states', { id: 'settings-state' }),
  });

  const deleteMut = useMutation({
    mutationFn: ({ stateId, fallbackStateId }: { stateId: string; fallbackStateId?: string }) =>
      StateService.deleteState(projectId, stateId, fallbackStateId),
    onSuccess: () => {
      invalidateWorkflowCache();
      toast.success('Workflow state deleted', { id: 'settings-state' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete state', { id: 'settings-state' }),
  });

  const resetMut = useMutation({
    mutationFn: () => StateService.resetStates(projectId),
    onSuccess: () => {
      invalidateWorkflowCache();
      toast.success('Workflow states reset to default', { id: 'settings-state' });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reset states', { id: 'settings-state' }),
  });

  const states: WorkItemState[] =
    Array.isArray(statesQ.data) && statesQ.data.length > 0
      ? statesQ.data
      : DEFAULT_WORK_ITEM_STATES;

  const itemCounts: Record<string, number> = countsQ.data || {};

  return {
    states,
    itemCounts,
    workItemCounts: itemCounts,
    isLoading: statesQ.isLoading || countsQ.isLoading,
    isError: statesQ.isError || countsQ.isError,
    error: statesQ.error || countsQ.error,
    isMutating:
      createMut.isPending ||
      updateMut.isPending ||
      reorderMut.isPending ||
      deleteMut.isPending ||
      resetMut.isPending,
    createState: createMut.mutateAsync,
    updateState: updateMut.mutateAsync,
    reorderStates: reorderMut.mutateAsync,
    deleteState: deleteMut.mutateAsync,
    resetStates: resetMut.mutateAsync,
    refetch: () => {
      statesQ.refetch();
      countsQ.refetch();
    },
  };
}
