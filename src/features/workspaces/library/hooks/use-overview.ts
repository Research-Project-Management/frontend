'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LibraryOverviewService,
  type LibraryOverviewData,
} from '../services/overview.service';

export function useLibraryOverview(scopeId?: string) {
  return useQuery<LibraryOverviewData>({
    queryKey: ['library', 'overview', scopeId || 'user'],
    queryFn: () => LibraryOverviewService.getOverview(scopeId),
    staleTime: 1000 * 30, // 30s
    refetchOnWindowFocus: true,
  });
}

export type { LibraryOverviewData };
