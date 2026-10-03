'use client';

import { useYourWork } from './use-your-work-base';
import { useOptionalYourWorkContext } from '../context/your-work.context';

export function useActivityFeed() {
  const context = useOptionalYourWorkContext();
  const base = useYourWork();
  const source = context || base;

  return {
    state: {
      allWorkItems: source.allWorkItems,
      activities: source.activities,
      count: source.activities.length,
      workItemProjectMap: source.workItemProjectMap,
      selectedProjectId: context?.selectedProjectId || null,
      selectedProject: context?.selectedProject || null,
      isLoading: source.isLoading,
      isLoadingActivity: source.isLoadingYourWork,
      isLoadingWorkItems: source.isLoadingYourWork,
      isLoadingProjects: source.isLoadingProjects,
      isError: source.isError,
      error: source.error,
      isEmpty: source.isEmpty,
    },
    actions: {
      refetch: source.refetch,
      selectProject: (id: string | null) => context?.setSelectedProjectId(id),
    },
  };
}

export default useActivityFeed;


