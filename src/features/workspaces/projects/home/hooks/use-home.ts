'use client';

// ── Home hooks ────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { fetchRecentItems, fetchActivityFeed } from '../services/home.service';
import type { RecentItem, Activity } from '../types/home.types';

export const useRecentItems = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return useQuery<RecentItem[]>({
    queryKey: ['home', workspaceId, 'recent'],
    queryFn: ({ signal }) => fetchRecentItems(workspaceId!, signal),
    enabled: !!workspaceId,
  });
};

export const useActivityFeed = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return useQuery<Activity[]>({
    queryKey: ['home', workspaceId, 'activity'],
    queryFn: ({ signal }) => fetchActivityFeed(workspaceId!, signal),
    enabled: !!workspaceId,
    refetchInterval: 30_000,
  });
};
