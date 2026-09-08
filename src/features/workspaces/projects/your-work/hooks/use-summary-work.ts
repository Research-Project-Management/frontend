'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getYourWork } from '../services/your-work.service';
import { yourWorkSummaryResponseSchema, type YourWorkSummaryResponse } from '../schemas/your-work.schema';
import { useYourWorkBase } from './use-your-work-base';

export function useSummaryWork() {
  const base = useYourWorkBase();

  const {
    data: rawYourWork,
    isLoading: isLoadingYourWork,
    refetch: refetchYourWork,
  } = useQuery({
    queryKey: ['your-work', 'summary', base.workspaceId],
    queryFn: async ({ signal }) => {
      const res = await getYourWork(base.workspaceId, signal);
      const parsed = yourWorkSummaryResponseSchema.safeParse(res);
      return parsed.success ? parsed.data : (res as YourWorkSummaryResponse);
    },
    enabled: !!base.workspaceId,
    staleTime: 30_000,
  });

  const activities = useMemo(
    () => (rawYourWork as any)?.activity || [],
    [rawYourWork],
  );

  const state = useMemo(
    () => ({
      workspaceId: base.workspaceId,
      tasks: base.allTasks,
      activities,
      categorizedTasks: base.categories,
      taskProjectMap: base.taskProjectMap,
      isLoading: isLoadingYourWork || base.isLoading,
      isLoadingYourWork,
      isLoadingTasks: base.isLoadingTasks,
      isLoadingProjects: base.isLoadingProjects,
    }),
    [
      base.workspaceId,
      base.allTasks,
      activities,
      base.categories,
      base.taskProjectMap,
      isLoadingYourWork,
      base.isLoading,
      base.isLoadingTasks,
      base.isLoadingProjects,
    ],
  );

  const baseRefetch = base.refetch;
  const actions = useMemo(
    () => ({
      refetch: () => {
        refetchYourWork();
        baseRefetch();
      },
    }),
    [refetchYourWork, baseRefetch],
  );

  return useMemo(
    () => ({
      state,
      actions,
    }),
    [state, actions],
  );
}

export default useSummaryWork;
