// ── Home services ─────────────────────────────────────────────────────────────
// Fetchers for home dashboard data (recent items, activity feed, etc.)
import { apiGet } from '@/shared/lib/api';

import type { RecentItem, Activity } from '../types/home.types';

export const fetchRecentItems = (workspaceId: string, signal?: AbortSignal) =>
  apiGet<RecentItem[]>(`/api/dashboard/workspaces/${workspaceId}/recent`, { signal });

export const fetchActivityFeed = (workspaceId: string, signal?: AbortSignal) =>
  apiGet<Activity[]>(`/api/dashboard/workspaces/${workspaceId}/activity`, { signal });
