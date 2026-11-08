import { apiGet } from '@/shared/lib/api';
import type {
  ProjectAnalyticsData,
  TimeSeriesPoint,
  LabelBreakdownItem,
} from '../types/analytics.types';

export const analyticsKeys = {
  all: (projectId: string) => ['project-analytics', projectId] as const,
  distribution: (projectId: string) =>
    ['project-analytics-dist', projectId] as const,
  timeseries: (projectId: string, from: string, to: string) =>
    ['project-analytics-timeseries', projectId, from, to] as const,
  labels: (projectId: string) =>
    ['project-analytics-labels', projectId] as const,
};

export const AnalyticsService = {
  getProjectAnalytics: (
    projectId: string,
    signal?: AbortSignal,
  ): Promise<ProjectAnalyticsData> =>
    apiGet<ProjectAnalyticsData>(`/api/v1/projects/${projectId}/analytics`, {
      signal,
    }),

  getTimeSeries: (
    projectId: string,
    from?: string,
    to?: string,
    signal?: AbortSignal,
  ): Promise<{ series: TimeSeriesPoint[] }> => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return apiGet<{ series: TimeSeriesPoint[] }>(
      `/api/v1/projects/${projectId}/analytics/timeseries`,
      { params, signal },
    );
  },

  getLabels: (
    projectId: string,
    signal?: AbortSignal,
  ): Promise<{ labels: LabelBreakdownItem[] }> =>
    apiGet<{ labels: LabelBreakdownItem[] }>(
      `/api/v1/projects/${projectId}/analytics/labels`,
      { signal },
    ),
};
