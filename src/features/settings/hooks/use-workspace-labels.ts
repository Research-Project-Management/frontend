'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import { toast } from 'sonner';
import type {
  Label,
  CreateLabelInput,
  UpdateLabelInput,
} from '@/features/projects/project-id/settings/types/label.types';

export const userLabelKeys = {
  all: ['labels'] as const,
  list: () => ['labels', 'user'] as const,
};

// Backward compatibility key alias
export const workspaceLabelKeys = userLabelKeys;

// ── 1. Fetch Labels (Flat Personal / User model) ──────────────────────────────

export function useUserLabels() {
  return useQuery({
    queryKey: userLabelKeys.list(),
    queryFn: async () => {
      const res = await apiGet<{ labels?: Label[] }>(
        '/api/labels',
      );
      return res.labels ?? [];
    },
    staleTime: 1000 * 60 * 3,
  });
}

export const useWorkspaceLabels = useUserLabels;

// ── 2. Create Label ────────────────────────────────────────────────────────────

export function useCreateWorkspaceLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLabelInput) => {
      const res = await apiPost<{ label?: Label }>('/api/labels', input);
      return res.label!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceLabelKeys.all });
      toast.success('Label created');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create label');
    },
  });
}

// ── 3. Update Label ────────────────────────────────────────────────────────────

export function useUpdateWorkspaceLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      labelId,
      ...input
    }: UpdateLabelInput & { labelId: string }) => {
      const res = await apiPatch<{ label?: Label }>(
        `/api/labels/${labelId}`,
        input,
      );
      return res.label!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceLabelKeys.all });
      toast.success('Label updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update label');
    },
  });
}

// ── 4. Delete Label ────────────────────────────────────────────────────────────

export function useDeleteWorkspaceLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (labelId: string) => {
      await apiDelete<{ message?: string }>(`/api/labels/${labelId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceLabelKeys.all });
      toast.success('Label deleted');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete label');
    },
  });
}

export const useCreateUserLabel = useCreateWorkspaceLabel;
export const useUpdateUserLabel = useUpdateWorkspaceLabel;
export const useDeleteUserLabel = useDeleteWorkspaceLabel;
