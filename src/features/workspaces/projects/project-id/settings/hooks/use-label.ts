'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LabelService } from '../services/label.service';
import type { CreateLabelInput, UpdateLabelInput, LabelType, Label } from '../types/label.types';

// ── Query Keys ────────────────────────────────────────────────────────────────

export const labelKeys = {
  all: ['labels'] as const,
  list: (workspaceId: string, type?: LabelType) =>
    ['labels', workspaceId, type ?? 'all'] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

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
