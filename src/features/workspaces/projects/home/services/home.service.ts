import { apiGet, apiPost } from '@/shared/lib/api';

import type { RecentItem } from '../types/home.types';

export const getRecentItems = (workspaceId: string, signal?: AbortSignal) =>
  apiGet<RecentItem[]>(`/api/activity/workspaces/${workspaceId}/recent`, { signal });


export const getStickies = async (workspaceId: string) => {
  const data = await apiGet<{ stickies: any[] }>(`/api/workspace/${workspaceId}/stickies`);
  return data.stickies;
};

export const createSticky = async (variables: {
  workspaceId: string;
  title?: string;
  content: string;
  color?: string;
  position?: { x: number; y: number };
}) => {
  return apiPost(`/api/workspace/${variables.workspaceId}/stickies`, variables);
};
