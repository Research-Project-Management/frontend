import { apiGet } from "@/shared/lib/api";

import type { RecentItem } from '../types/home.types';

export const getRecentItems = (_scopeId?: string, signal?: AbortSignal) =>
  apiGet<RecentItem[]>('/api/activity/recent', { signal });

export { getStickies, createSticky } from '@/features/projects/stickies/services/sticky.service';
