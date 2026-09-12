'use client';

import { useMemo } from 'react';
import { useYourWork } from './use-your-work-base';
import { useOptionalYourWorkContext } from '../context/your-work.context';

export function useSummaryWork() {
  const context = useOptionalYourWorkContext();
  const base = useYourWork();

  const source = context || base;

  const state = useMemo(
    () => ({
      workspaceId: source.workspaceId,
      tasks: source.allTasks,
      activities: source.activities,
      categorizedTasks: {
        assigned: source.assigned,
        created: source.created,
        subscribed: source.subscribed,
        statusBreakdown: source.statusBreakdown,
        priorityBreakdown: source.priorityBreakdown,
      },
      statusBreakdown: source.statusBreakdown,
      subscribedStatusBreakdown: source.subscribedStatusBreakdown,
      priorityBreakdown: source.priorityBreakdown,
      projectBreakdown: source.projectBreakdown,
      taskProjectMap: source.taskProjectMap,
      userData: source.userData,
      selectedProjectId: context?.selectedProjectId || null,
      selectedProject: context?.selectedProject || null,
      totalCounts: context?.totalCounts || {
        assigned: source.assigned.length,
        created: source.created.length,
        subscribed: source.subscribed.length,
        activity: source.activities.length,
      },
      isLoading: source.isLoading,
      isLoadingYourWork: source.isLoadingYourWork,
      isLoadingTasks: source.isLoadingTasks,
      isLoadingProjects: source.isLoadingProjects,
      isRefetching: source.isRefetching,
    }),
    [
      source.workspaceId,
      source.allTasks,
      source.activities,
      source.assigned,
      source.created,
      source.subscribed,
      source.statusBreakdown,
      source.subscribedStatusBreakdown,
      source.priorityBreakdown,
      source.projectBreakdown,
      source.taskProjectMap,
      source.userData,
      source.isLoading,
      source.isLoadingYourWork,
      source.isLoadingTasks,
      source.isLoadingProjects,
      source.isRefetching,
      context?.selectedProjectId,
      context?.selectedProject,
      context?.totalCounts,
    ],
  );

  const actions = useMemo(
    () => ({
      refetch: source.refetch,
      invalidate: source.invalidate,
      selectProject: (projectId: string | null) => {
        if (context?.setSelectedProjectId) {
          context.setSelectedProjectId(projectId);
        }
      },
    }),
    [source.refetch, source.invalidate, context],
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

