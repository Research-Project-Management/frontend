import { apiGet } from '@/shared/lib/api';

/**
 * Calls backend AnalyticsController.getYourWork
 * Endpoint: GET /api/analytics/your-work/:workspaceId
 */
export const getYourWork = (workspaceId: string, signal?: AbortSignal) =>
  apiGet(`/api/analytics/your-work/${workspaceId}`, { signal });

/**
 * Calls backend ActivityController.getWorkspaceActivityFeed
 * Endpoint: GET /api/activity/workspaces/:workspaceId/feed
 */
export const getActivityFeed = (workspaceId: string, signal?: AbortSignal) =>
  apiGet(`/api/activity/workspaces/${workspaceId}/feed`, { signal });

/**
 * Calls backend TaskController.getWorkspaceTasks
 * Endpoint: GET /api/workspace/:workspaceId/tasks
 */
export const getWorkspaceTasks = (workspaceId: string, signal?: AbortSignal) =>
  apiGet(`/api/workspace/${workspaceId}/tasks`, { signal });

