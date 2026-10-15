'use client';

import { useMemo } from 'react';
import { useYourWorkContext } from '../context/your-work.context';

export function useSummaryWork() {
  const context = useYourWorkContext();

  const state = useMemo(
    () => ({
      workItems: context.allWorkItems,
      activities: context.activities,
      categorizedWorkItems: {
        assigned: context.assigned,
        created: context.created,
        subscribed: context.subscribed,
        statusBreakdown: context.statusBreakdown,
        priorityBreakdown: context.priorityBreakdown,
      },
      statusBreakdown: context.statusBreakdown,
      subscribedStatusBreakdown: context.subscribedStatusBreakdown,
      priorityBreakdown: context.priorityBreakdown,
      projectBreakdown: context.projectBreakdown,
      workItemProjectMap: context.workItemProjectMap,
      userData: context.userData,
      selectedProjectId: context.selectedProjectId,
      selectedProject: context.selectedProject,
      totalCounts: context.totalCounts,
      isLoading: context.isLoading,
      isLoadingYourWork: context.isLoadingYourWork,
      isLoadingWorkItems: context.isLoadingWorkItems,
      isLoadingProjects: context.isLoadingProjects,
      isRefetching: context.isRefetching,
      isError: context.isError,
      error: context.error,
      isEmpty: context.isEmpty,
    }),
    [
      context.allWorkItems,
      context.activities,
      context.assigned,
      context.created,
      context.subscribed,
      context.statusBreakdown,
      context.subscribedStatusBreakdown,
      context.priorityBreakdown,
      context.projectBreakdown,
      context.workItemProjectMap,
      context.userData,
      context.selectedProjectId,
      context.selectedProject,
      context.totalCounts,
      context.isLoading,
      context.isLoadingYourWork,
      context.isLoadingWorkItems,
      context.isLoadingProjects,
      context.isRefetching,
      context.isError,
      context.error,
      context.isEmpty,
    ],
  );

  const actions = useMemo(
    () => ({
      refetch: context.refetch,
      invalidate: context.invalidate,
      selectProject: context.setSelectedProjectId,
      openWorkItem: context.openWorkItem,
      closeWorkItem: context.closeWorkItem,
    }),
    [
      context.refetch,
      context.invalidate,
      context.setSelectedProjectId,
      context.openWorkItem,
      context.closeWorkItem,
    ],
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
