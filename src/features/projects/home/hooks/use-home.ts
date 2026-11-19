'use client';

// ── Home hooks ────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { getRecentItems } from '../services/home.service';
import type { RecentItem } from '../types/home.types';
export const homeKeys = {
  all: ['home'] as const,
  recent: (scope: string = 'me') => [...homeKeys.all, 'recent', scope] as const,
};

export const useRecentItems = (spaceId?: string) => {
  return useQuery<RecentItem[]>({
    queryKey: homeKeys.recent(spaceId || 'me'),
    queryFn: ({ signal }) => getRecentItems(spaceId, signal),
  });
};
