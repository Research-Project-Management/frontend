import { apiGet } from '@/shared/lib/api';
import type { OverviewData } from '../types/overview.types';

export const OverviewService = {
  get: (projectId: string) =>
    apiGet<OverviewData>(`/api/analytics/projects/${projectId}/overview`),
};
