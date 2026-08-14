'use client';

// ── Home hooks ────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { getRecentItems } from '../services/home.service';
import type { RecentItem } from '../types/home.types';
import { queryKeys } from '@/shared/constants/query-keys';

export const useRecentItems = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return useQuery<RecentItem[]>({
    queryKey: queryKeys.home.recent(workspaceId!),
    queryFn: ({ signal }) => getRecentItems(workspaceId!, signal),
    enabled: !!workspaceId,
  });
};
