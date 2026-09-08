'use client';

import { useYourWorkBase } from './use-your-work-base';

export function useSubscribedWork() {
  const base = useYourWorkBase();
  const subscribedTasks = base.categories.subscribed;

  return {
    state: {
      workspaceId: base.workspaceId,
      allTasks: base.allTasks,
      subscribedTasks,
      count: subscribedTasks.length,
      taskProjectMap: base.taskProjectMap,
      isLoading: base.isLoading,
      isLoadingTasks: base.isLoadingTasks,
      isLoadingProjects: base.isLoadingProjects,
    },
    actions: {
      refetch: base.refetch,
    },
  };
}

export default useSubscribedWork;
