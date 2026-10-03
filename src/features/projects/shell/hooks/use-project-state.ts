'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ProjectService,
  projectKeys,
  type CreateProjectStateInput,
  type UpdateProjectStateItemInput,
} from '../services/project.service';
import type { ProjectState } from '../types/project.types';

export function useProjectStates(projectId: string) {
  return useQuery({
    queryKey: projectKeys.states(projectId),
    queryFn: () => ProjectService.getStates(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useProjectCurrentState(projectId: string) {
  return useQuery({
    queryKey: projectKeys.currentState(projectId),
    queryFn: () => ProjectService.getCurrentState(projectId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });
}

export function useDefaultStatesTemplate() {
  return useQuery({
    queryKey: projectKeys.stateTemplate(),
    queryFn: () => ProjectService.getDefaultStatesTemplate(),
    staleTime: Infinity,
  });
}

export function useTransitionProjectState(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId: targetProjectId,
      stateId,
    }: {
      projectId: string;
      stateId: string | null;
    }) => ProjectService.transitionState(targetProjectId, stateId),
    onSuccess: (data, variables) => {
      const pId = variables.projectId || projectId;
      if (pId) {
        queryClient.invalidateQueries({ queryKey: projectKeys.currentState(pId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.byId(pId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.overview(pId) });
        queryClient.invalidateQueries({ queryKey: projectKeys.header(pId) });
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      toast.success(
        data.state
          ? `Status changed to: ${data.state.name}`
          : 'Project stage unassigned'
      );
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update project status');
    },
  });
}

export function useCreateProjectState(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectStateInput) =>
      ProjectService.createState(projectId, data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.states(projectId) });
      toast.success(`Stage added: ${created.name}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create stage');
    },
  });
}

export function useUpdateProjectStateItem(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stateId,
      data,
    }: {
      stateId: string;
      data: UpdateProjectStateItemInput;
    }) => ProjectService.updateStateItem(projectId, stateId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.states(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.currentState(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.byId(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      toast.success('Stage updated successfully');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update stage');
    },
  });
}

export function useReorderProjectStates(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (states: Array<{ id: string; sequence: number }>) =>
      ProjectService.reorderStates(projectId, states),
    onMutate: async (newStates) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.states(projectId) });
      const previous = queryClient.getQueryData<ProjectState[]>(
        projectKeys.states(projectId)
      );

      if (previous) {
        const orderMap = new Map(newStates.map((s) => [s.id, s.sequence]));
        const optimistic = [...previous].sort(
          (a, b) => (orderMap.get(a.id) ?? a.sequence) - (orderMap.get(b.id) ?? b.sequence)
        );
        queryClient.setQueryData(projectKeys.states(projectId), optimistic);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(projectKeys.states(projectId), context.previous);
      }
      toast.error('Failed to reorder stages');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.states(projectId) });
    },
  });
}

export function useDeleteProjectState(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stateId,
      fallbackStateId,
    }: {
      stateId: string;
      fallbackStateId?: string;
    }) => ProjectService.deleteState(projectId, stateId, fallbackStateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.states(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.currentState(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.byId(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      toast.success('Stage deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete stage');
    },
  });
}
