import { apiGet } from '@/shared/lib/api';
import type {
  WorkspaceAnalyticsStats,
  ProjectAnalyticsDistribution,
  TimeSeriesPoint,
  ProjectOverviewData,
} from '../types/analytics.types';

export const AnalyticsService = {
  getWorkspaceOverview: (_scopeId?: string) =>
    apiGet<{ stats: WorkspaceAnalyticsStats }>(`/api/analytics/overview`),

  getProjectAnalytics: (projectId: string) =>
    apiGet<ProjectAnalyticsDistribution>(`/api/v1/projects/${projectId}/analytics`),

  getProjectTimeSeries: (projectId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiGet<TimeSeriesPoint[]>(`/api/v1/projects/${projectId}/analytics/timeseries${query}`);
  },

  getProjectOverview: (projectId: string) =>
    apiGet<ProjectOverviewData>(`/api/v1/projects/${projectId}/analytics/overview`),

  getProjectLabels: (projectId: string) =>
    apiGet<{ labels: Array<{ label: string; count: number }> }>(
      `/api/v1/projects/${projectId}/analytics/labels`
    ),
};
