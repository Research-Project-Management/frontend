import { apiGet } from "@/shared/lib/api";
import type { YourWorkSummaryResponse } from '../schemas/your-work.schema';

/**
 * Calls backend YourWorkController.getYourWork
 * Endpoint: GET /api/analytics/your-work
 */
export const getYourWork = (_scopeId?: string, signal?: AbortSignal): Promise<YourWorkSummaryResponse> =>
  apiGet('/api/analytics/your-work', { signal });

/**
 * Calls backend ActivityController.getWorkspaceActivityFeed
 * Endpoint: GET /api/activity/feed
 */
export const getActivityFeed = (_scopeId?: string, signal?: AbortSignal) =>
  apiGet('/api/activity/feed', { signal });
