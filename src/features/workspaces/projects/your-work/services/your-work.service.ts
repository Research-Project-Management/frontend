import { apiGet } from "@/shared/lib/api";
import type { YourWorkSummaryResponse } from '../schemas/your-work.schema';

/**
 * Calls backend YourWorkController.getYourWork
 * Endpoint: GET /api/analytics/your-work (or /api/analytics/your-work/:workspaceId)
 */
export const getYourWork = (workspaceId?: string, signal?: AbortSignal): Promise<YourWorkSummaryResponse> =>
  apiGet(workspaceId ? `/api/analytics/your-work/${workspaceId}` : `/api/analytics/your-work`, { signal });

/**
 * Calls backend ActivityController.getWorkspaceActivityFeed
 * Endpoint: GET /api/activity/feed (or /api/activity/workspaces/:workspaceId/feed)
 */
export const getActivityFeed = (workspaceId?: string, signal?: AbortSignal) =>
  apiGet(workspaceId ? `/api/activity/workspaces/${workspaceId}/feed` : `/api/activity/feed`, { signal });
