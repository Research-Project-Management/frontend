'use client';

import { useQuery } from '@tanstack/react-query';
import { AnalyticsService } from '../services/analytics.service';

export const analyticsKeys = {
  all: ['analytics'] as const,
  workspace: () => [...analyticsKeys.all, 'workspace'] as const,
  projectDist: (projectId: string) => [...analyticsKeys.all, 'project', projectId, 'dist'] as const,
  projectOverview: (projectId: string) => [...analyticsKeys.all, 'project', projectId, 'overview'] as const,
  projectTimeSeries: (projectId: string, from?: string, to?: string) =>
    [...analyticsKeys.all, 'project', projectId, 'timeseries', { from, to }] as const,
  projectLabels: (projectId: string) => [...analyticsKeys.all, 'project', projectId, 'labels'] as const,
};

export function useWorkspaceAnalytics() {
  return useQuery({
    queryKey: analyticsKeys.workspace(),
    queryFn: () => AnalyticsService.getWorkspaceOverview(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectAnalytics(projectId?: string) {
  return useQuery({
    queryKey: analyticsKeys.projectDist(projectId || ''),
    queryFn: () => AnalyticsService.getProjectAnalytics(projectId!),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectOverviewStats(projectId?: string) {
  return useQuery({
    queryKey: analyticsKeys.projectOverview(projectId || ''),
    queryFn: () => AnalyticsService.getProjectOverview(projectId!),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectTimeSeries(projectId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: analyticsKeys.projectTimeSeries(projectId || '', from, to),
    queryFn: () => AnalyticsService.getProjectTimeSeries(projectId!, from, to),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
}
