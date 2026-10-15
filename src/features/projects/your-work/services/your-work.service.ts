import { apiGet } from "@/shared/lib/api";
import type { YourWorkSummaryResponse } from '../schemas/your-work.schema';

/**
 * Calls backend YourWorkController.getYourWork
 * Endpoint: GET /api/analytics/your-work
 */
export const getYourWork = (scopeId?: string, signal?: AbortSignal): Promise<YourWorkSummaryResponse> => {
  const query = scopeId ? `?projectId=${encodeURIComponent(scopeId)}` : '';
  return apiGet(`/api/analytics/your-work${query}`, { signal });
};

