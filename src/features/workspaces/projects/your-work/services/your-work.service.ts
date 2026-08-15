// ── Your Work services ────────────────────────────────────────────────────────
// Fetchers for current user's assigned tasks, pages, and recent activity.
import { apiGet } from '@/shared/lib/api';

export const fetchYourWork = (workspaceId: string, signal?: AbortSignal) =>
  apiGet(`/api/dashboard/workspaces/${workspaceId}/your-work`, { signal });
