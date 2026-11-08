import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AnalyticsService,
  analyticsKeys,
} from '../services/analytics.service';

export function useProjectAnalytics(projectId: string, days = 14) {
  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { fromDate: from, toDate: to };
  }, [days]);

  const analyticsQuery = useQuery({
    queryKey: analyticsKeys.distribution(projectId),
    queryFn: ({ signal }) =>
      AnalyticsService.getProjectAnalytics(projectId, signal),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  const timeSeriesQuery = useQuery({
    queryKey: analyticsKeys.timeseries(projectId, fromDate, toDate),
    queryFn: ({ signal }) =>
      AnalyticsService.getTimeSeries(projectId, fromDate, toDate, signal),
    enabled: Boolean(projectId),
    staleTime: 60_000,
  });

  return {
    analytics: analyticsQuery.data,
    timeSeries: timeSeriesQuery.data?.series ?? [],
    isLoading: analyticsQuery.isLoading,
    isTimeSeriesLoading: timeSeriesQuery.isLoading,
    isError: analyticsQuery.isError,
    error: analyticsQuery.error as Error | null,
    refetch: () => {
      void analyticsQuery.refetch();
      void timeSeriesQuery.refetch();
    },
  };
}
