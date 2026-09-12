'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LabelService } from '../services/label.service';
import type {
  CreateLabelInput,
  UpdateLabelInput,
  CreateProjectLabelInput,
  UpdateProjectLabelInput,
  ReorderLabelItem,
  LabelType,
  Label,
} from '../types/label.types';

// ── Query Keys ────────────────────────────────────────────────────────────────

export const labelKeys = {
  all: ['labels'] as const,
  list: (workspaceId: string, type?: LabelType) =>
    ['labels', workspaceId, type ?? 'all'] as const,
  project: (projectId: string) => ['project-labels', projectId] as const,
};

// ── Project-Scoped Hooks ─────────────────────────────────────────────────────

export function useProjectLabels(projectId: string) {
  return useQuery<Label[]>({
    queryKey: labelKeys.project(projectId),
    queryFn: () => LabelService.getProjectLabels(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateProjectLabel(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectLabelInput) =>
      LabelService.createProjectLabel(projectId, input),
    onSuccess: (newLabel) => {
      queryClient.invalidateQueries({ queryKey: labelKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-work-items', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(`Label "${newLabel.name}" created`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create label');
    },
  });
}

export function useUpdateProjectLabel(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      labelId,
      ...input
    }: UpdateProjectLabelInput & { labelId: string }) =>
      LabelService.updateProjectLabel(projectId, labelId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-work-items', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Label updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update label');
    },
  });
}

export function useDeleteProjectLabel(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labelId: string) =>
      LabelService.deleteProjectLabel(projectId, labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-work-items', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Label deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete label');
    },
  });
}

export function useReorderProjectLabels(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labels: ReorderLabelItem[]) =>
      LabelService.reorderProjectLabels(projectId, labels),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.project(projectId) });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to reorder labels');
    },
  });
}

// ── Legacy Hooks (Preserved for Backward Compatibility) ───────────────────────

export function useLabels(workspaceId: string, type?: LabelType) {
  return useQuery<Label[]>({
    queryKey: labelKeys.list(workspaceId, type),
    queryFn: () => LabelService.list(workspaceId, type),
    enabled: Boolean(workspaceId),
  });
}

export function useCreateLabel(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLabelInput) =>
      LabelService.create(workspaceId, input),
    onSuccess: (newLabel) => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all });
      toast.success(`Label "${newLabel.name}" created`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create label');
    },
  });
}

export function useUpdateLabel(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ labelId, ...input }: UpdateLabelInput & { labelId: string }) =>
      LabelService.update(labelId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all });
      toast.success('Label updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update label');
    },
  });
}

export function useDeleteLabel(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labelId: string) => LabelService.delete(labelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all });
      toast.success('Label deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete label');
    },
  });
}
