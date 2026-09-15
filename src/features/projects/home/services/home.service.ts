import { apiGet, apiPost } from "@/shared/lib/api";

import type { RecentItem } from '../types/home.types';

export const getRecentItems = (_scopeId?: string, signal?: AbortSignal) =>
  apiGet<RecentItem[]>('/api/activity/recent', { signal });

export const getStickies = async (_scopeId?: string) => {
  const data = await apiGet<{ stickies: any[] }>('/api/me/stickies');
  return data.stickies || [];
};

export const createSticky = async (variables: {
  scopeId?: string;
  workspaceId?: string;
  title?: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
}) => {
  const { workspaceId: _w, scopeId: _s, ...payload } = variables;
  return apiPost('/api/me/stickies', payload);
};
