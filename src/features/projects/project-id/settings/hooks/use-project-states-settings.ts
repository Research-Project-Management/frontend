'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchProjectStates,
  fetchProjectCurrentState,
  createProjectStateApi,
  updateProjectStateItemApi,
  reorderProjectStatesApi,
  deleteProjectStateApi,
  resetProjectStatesApi,
  transitionProjectStateApi,
  type CreateProjectStateInput,
  type UpdateProjectStateItemInput,
} from '@/features/projects/shell/services/project.service';
import type { ProjectState } from '@/features/projects/shell/types/project.types';

export const projectStateKeys = {
  all: (projectId: string) => ['project-states-list', projectId] as const,
  current: (projectId: string) => ['project-current-state', projectId] as const,
};

export function useProjectStatesSettings(projectId: string) {
  const qc = useQueryClient();

  const statesQ = useQuery({
    queryKey: projectStateKeys.all(projectId),
    queryFn: () => fetchProjectStates(projectId),
    enabled: Boolean(projectId),
  });

  const currentQ = useQuery({
    queryKey: projectStateKeys.current(projectId),
    queryFn: () => fetchProjectCurrentState(projectId),
    enabled: Boolean(projectId),
  });

  const invalidateStatesCache = () => {
    qc.invalidateQueries({ queryKey: projectStateKeys.all(projectId) });
    qc.invalidateQueries({ queryKey: projectStateKeys.current(projectId) });
    qc.invalidateQueries({ queryKey: ['project-details', projectId] });
    qc.invalidateQueries({ queryKey: ['projects'] });
  };

  const createMut = useMutation({
    mutationFn: (data: CreateProjectStateInput) =>
      createProjectStateApi(projectId, data),
    onSuccess: () => {
      invalidateStatesCache();
      toast.success('Project state created', { id: 'settings-project-state' });
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Failed to create state', { id: 'settings-project-state' }),
  });

  const updateMut = useMutation({
    mutationFn: ({
      stateId,
      data,
    }: {
      stateId: string;
      data: UpdateProjectStateItemInput;
    }) => updateProjectStateItemApi(projectId, stateId, data),
    onSuccess: () => {
      invalidateStatesCache();
      toast.success('Project state updated', { id: 'settings-project-state' });
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Failed to update state', { id: 'settings-project-state' }),
  });

  const reorderMut = useMutation({
    mutationFn: (states: Array<{ id: string; sequence: number }>) =>
      reorderProjectStatesApi(projectId, states),
    onSuccess: () => {
      invalidateStatesCache();
      toast.success('Project states reordered', { id: 'settings-project-state' });
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Failed to reorder states', { id: 'settings-project-state' }),
  });

  const deleteMut = useMutation({
    mutationFn: ({
      stateId,
      fallbackStateId,
    }: {
      stateId: string;
      fallbackStateId?: string;
    }) => deleteProjectStateApi(projectId, stateId, fallbackStateId),
    onSuccess: () => {
      invalidateStatesCache();
      toast.success('Project state deleted', { id: 'settings-project-state' });
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Failed to delete state', { id: 'settings-project-state' }),
  });

  const resetMut = useMutation({
    mutationFn: () => resetProjectStatesApi(projectId),
    onSuccess: () => {
      invalidateStatesCache();
      toast.success('Project states reset to 8 research default states', {
        id: 'settings-project-state',
      });
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Failed to reset project states', {
        id: 'settings-project-state',
      }),
  });

  const transitionMut = useMutation({
    mutationFn: (stateId: string | null) =>
      transitionProjectStateApi(projectId, stateId),
    onSuccess: () => {
      invalidateStatesCache();
      toast.success('Project state updated', { id: 'project-state-transition' });
    },
    onError: (err: Error) =>
      toast.error(err.message || 'Failed to change project state', {
        id: 'project-state-transition',
      }),
  });

  const states: ProjectState[] = Array.isArray(statesQ.data)
    ? [...statesQ.data].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
    : [];

  return {
    states,
    currentState: currentQ.data?.state ?? null,
    currentStateLabel: currentQ.data?.stateLabel ?? 'Unassigned',
    isLoading: statesQ.isLoading || currentQ.isLoading,
    isError: statesQ.isError || currentQ.isError,
    error: statesQ.error || currentQ.error,
    isMutating:
      createMut.isPending ||
      updateMut.isPending ||
      reorderMut.isPending ||
      deleteMut.isPending ||
      resetMut.isPending ||
      transitionMut.isPending,
    createState: createMut.mutateAsync,
    updateState: updateMut.mutateAsync,
    reorderStates: reorderMut.mutateAsync,
    deleteState: deleteMut.mutateAsync,
    resetStates: resetMut.mutateAsync,
    transitionState: transitionMut.mutateAsync,
    refetch: () => {
      statesQ.refetch();
      currentQ.refetch();
    },
  };
}
