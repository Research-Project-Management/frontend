'use client';

// ── Home hooks ────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { getRecentItems } from '../services/home.service';
import type { RecentItem } from '../types/home.types';
export const homeKeys = {
  all: ['home'] as const,
  recent: (scope: string = 'me') => [...homeKeys.all, 'recent', scope] as const,
};

export const useRecentItems = (scopeId?: string) => {
  return useQuery<RecentItem[]>({
    queryKey: homeKeys.recent(scopeId || 'me'),
    queryFn: ({ signal }) => getRecentItems(scopeId, signal),
  });
};
