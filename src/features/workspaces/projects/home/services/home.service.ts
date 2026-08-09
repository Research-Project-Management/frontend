// ── Home services ─────────────────────────────────────────────────────────────
// Fetchers for home dashboard data (recent items, activity feed, etc.)
import { apiGet } from '@/shared/lib/api';

export const fetchRecentItems = (workspaceId: string, signal?: AbortSignal) =>
  apiGet(`/api/dashboard/workspaces/${workspaceId}/recent`, { signal });

export const fetchActivityFeed = (workspaceId: string, signal?: AbortSignal) =>
  apiGet(`/api/dashboard/workspaces/${workspaceId}/activity`, { signal });
