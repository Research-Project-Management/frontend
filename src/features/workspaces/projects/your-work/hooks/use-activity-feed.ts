'use client';

import { useYourWork } from './use-your-work-base';
import { useOptionalYourWorkContext } from '../context/your-work.context';

export function useActivityFeed() {
  const context = useOptionalYourWorkContext();
  const base = useYourWork();
  const source = context || base;

  return {
    state: {
      workspaceId: source.workspaceId,
      allTasks: source.allTasks,
      activities: source.activities,
      count: source.activities.length,
      taskProjectMap: source.taskProjectMap,
      selectedProjectId: context?.selectedProjectId || null,
      selectedProject: context?.selectedProject || null,
      isLoading: source.isLoading,
      isLoadingActivity: source.isLoadingYourWork,
      isLoadingTasks: source.isLoadingYourWork,
      isLoadingProjects: source.isLoadingProjects,
    },
    actions: {
      refetch: source.refetch,
      selectProject: (id: string | null) => context?.setSelectedProjectId(id),
    },
  };
}

export default useActivityFeed;


