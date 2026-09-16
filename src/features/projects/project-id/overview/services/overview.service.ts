import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import type {
  ProjectOverviewData,
  ProjectLink,
  CreateLinkInput,
  UpdateLinkInput,
} from '../types/overview.types';

export const OverviewService = {
  getOverview: (projectId: string) =>
    apiGet<ProjectOverviewData>(`/api/v1/projects/${projectId}/overview`),

  getLinks: (projectId: string) =>
    apiGet<ProjectLink[]>(`/api/v1/projects/${projectId}/links`),

  createLink: (projectId: string, input: CreateLinkInput) =>
    apiPost<ProjectLink>(`/api/v1/projects/${projectId}/links`, input),

  updateLink: (projectId: string, linkId: string, input: UpdateLinkInput) =>
    apiPatch<ProjectLink>(`/api/v1/projects/${projectId}/links/${linkId}`, input),

  deleteLink: (projectId: string, linkId: string) =>
    apiDelete<void>(`/api/v1/projects/${projectId}/links/${linkId}`),

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
