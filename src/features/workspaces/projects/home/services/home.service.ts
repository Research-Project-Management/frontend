import { apiGet, apiPost } from "@/shared/lib/api";

import type { RecentItem } from '../types/home.types';

export const getRecentItems = (workspaceId?: string, signal?: AbortSignal) =>
  apiGet<RecentItem[]>(workspaceId ? `/api/activity/workspaces/${workspaceId}/recent` : `/api/activity/recent`, { signal });

export const getStickies = async (workspaceId?: string) => {
  const endpoint = workspaceId ? `/api/workspace/${workspaceId}/stickies` : `/api/me/stickies`;
  const data = await apiGet<{ stickies: any[] }>(endpoint);
  return data.stickies || [];
};

export const createSticky = async (variables: {
  workspaceId?: string;
  title?: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
}) => {
  const { workspaceId, ...payload } = variables;
  const endpoint = workspaceId ? `/api/workspace/${workspaceId}/stickies` : `/api/me/stickies`;
  return apiPost(endpoint, payload);
};
