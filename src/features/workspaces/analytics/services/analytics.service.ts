import { apiGet } from '@/shared/lib/api';

export interface WorkspaceAnalyticsStats {
  members: number;
  projects: number;
  workItems: number;
  papers: number;
  pages: number;
  files: number;
  stickies: number;
}

export interface ProjectAnalyticsDistribution {
  state: Record<string, number>;
  priority: Record<string, number>;
  assignee: Array<{
    userId: string;
    name: string;
    avatar: string | null;
    count: number;
  }>;
}

export interface TimeSeriesPoint {
  date: string;
  created: number;
  completed: number;
}

export const AnalyticsService = {
  getWorkspaceOverview: (_scopeId?: string) =>
    apiGet<{ stats: WorkspaceAnalyticsStats }>(`/api/analytics/overview`),

  getProjectAnalytics: (projectId: string) =>
    apiGet<ProjectAnalyticsDistribution>(`/api/analytics/projects/${projectId}`),

  getProjectTimeSeries: (projectId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiGet<TimeSeriesPoint[]>(`/api/analytics/projects/${projectId}/timeseries${query}`);
  },

  getProjectOverview: (projectId: string) =>
    apiGet<any>(`/api/analytics/projects/${projectId}/overview`),
};
