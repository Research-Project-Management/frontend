import { apiGet } from '@/shared/lib/api';

export interface ProjectAnalyticsDistribution {
  totalItems?: number;
  completedItems?: number;
  completionRate?: number;
  state: Record<string, number>;
  priority: Record<string, number>;
  assignee: Array<{
    userId: string;
    name: string;
    avatar: string | null;
    count: number;
  }>;
}

export const AnalyticsService = {
  getProjectAnalytics: (projectId: string) =>
    apiGet<ProjectAnalyticsDistribution>(`/api/v1/projects/${projectId}/analytics`),
};

export default AnalyticsService;
