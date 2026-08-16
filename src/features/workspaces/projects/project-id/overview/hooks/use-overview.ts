import { useQuery, queryOptions } from '@tanstack/react-query';
import { OverviewService } from '../services/overview.service';

export const overviewKeys = {
  all: ['overview'] as const,
  detail: (projectId: string) => [...overviewKeys.all, projectId] as const,
};

export const overviewQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: overviewKeys.detail(projectId),
    queryFn: () => OverviewService.get(projectId),
    enabled: !!projectId,
  });

export const useOverview = (projectId: string) =>
  useQuery(overviewQueryOptions(projectId));
