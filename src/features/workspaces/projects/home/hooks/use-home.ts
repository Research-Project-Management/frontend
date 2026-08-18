'use client';

// ── Home hooks ────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { getRecentItems } from '../services/home.service';
import type { RecentItem } from '../types/home.types';
export const homeKeys = {
  all: ['home'] as const,
  recent: (workspaceId: string) => [...homeKeys.all, 'recent', workspaceId] as const,
};

export const useRecentItems = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return useQuery<RecentItem[]>({
    queryKey: homeKeys.recent(workspaceId!),
    queryFn: ({ signal }) => getRecentItems(workspaceId!, signal),
    enabled: !!workspaceId,
  });
};
