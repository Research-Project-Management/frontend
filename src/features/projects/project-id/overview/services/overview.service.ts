import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type {
  ProjectOverviewData,
} from '../types/overview.types';

export const OverviewService = {
  getOverview: (projectId: string) =>
    apiGet<ProjectOverviewData>(`/api/v1/projects/${projectId}/overview`),

  getStatusUpdates: (projectId: string) =>
    apiGet<import('../types/overview.types').ProjectStatusUpdate[]>(
      `/api/v1/projects/${projectId}/updates`,
    ),

  createStatusUpdate: (
    projectId: string,
    input: import('../types/overview.types').CreateProjectStatusUpdateInput,
  ) =>
    apiPost<import('../types/overview.types').ProjectStatusUpdate>(
      `/api/v1/projects/${projectId}/updates`,
      input,
    ),

  deleteStatusUpdate: (projectId: string, updateId: string) =>
    apiDelete<void>(`/api/v1/projects/${projectId}/updates/${updateId}`),
};
