'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OverviewService } from '../services/overview.service';
import type {
  CreateLinkInput,
  UpdateLinkInput,
} from '../types/overview.types';

export const overviewKeys = {
  all: ['project-overview'] as const,
  detail: (projectId: string) => ['project-overview', projectId] as const,
  links: (projectId: string) => ['project-links', projectId] as const,
  updates: (projectId: string) => ['project-status-updates', projectId] as const,
};

export function useProjectOverview(projectId: string) {
  return useQuery({
    queryKey: overviewKeys.detail(projectId),
    queryFn: () => OverviewService.getOverview(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useProjectStatusUpdates(projectId: string) {
  return useQuery({
    queryKey: overviewKeys.updates(projectId),
    queryFn: () => OverviewService.getStatusUpdates(projectId),
    enabled: !!projectId,
  });
}

export function useCreateProjectStatusUpdate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: import('../types/overview.types').CreateProjectStatusUpdateInput) =>
      OverviewService.createStatusUpdate(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: overviewKeys.updates(projectId) });
    },
  });
}

export function useDeleteProjectStatusUpdate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updateId: string) =>
      OverviewService.deleteStatusUpdate(projectId, updateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: overviewKeys.updates(projectId) });
    },
  });
}

export function useCreateProjectLink(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLinkInput) =>
      OverviewService.createLink(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: overviewKeys.links(projectId) });
    },
  });
}

export function useUpdateProjectLink(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId, input }: { linkId: string; input: UpdateLinkInput }) =>
      OverviewService.updateLink(projectId, linkId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: overviewKeys.links(projectId) });
    },
  });
}

export function useDeleteProjectLink(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) =>
      OverviewService.deleteLink(projectId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: overviewKeys.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: overviewKeys.links(projectId) });
    },
  });
}
